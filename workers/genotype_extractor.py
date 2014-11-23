"""Prepares, and inserts, a submitted run into CycleDash's database.

This is a Celery worker.

Adds run metadata to the vcf table, then extracts genotypes from the VCF itself,
adding them to the genotypes table. Finally, determines which columns in the vcf
actually contain values, and stores a list of them in the vcf table.
"""
import config
import json
from sqlalchemy import create_engine, MetaData

from workers.shared import (load_vcf_from_hdfs, worker,
                            DATABASE_URI, TEMPORARY_DIR)
from workers.relational_vcfs import insert_genotypes_with_copy


@worker.task
def extractor(run):
    """Extract the genotype and VCF metadata required to insert a VCF into the
    CycleDash database, and insert it.
    """
    run = json.loads(run)
    engine, connection, metadata = initialize_database(DATABASE_URI)

    if vcf_exists(connection, run['vcf_path']):
        if config.ALLOW_VCF_OVERWRITES:
            was_deleted = delete_vcf(metadata, connection, run['vcf_path'])
            assert was_deleted, ('Rows should have been deleted if we are '
                                 'deleting a VCF that exists')
        else:
            print 'VCF already exists with URI {}'.format(run['vcf_path'])
            return False

    insert_run(run, engine, connection, metadata)

    connection.close()
    return True


def insert_run(run, engine, connection, metadata):
    """Insert the run into the database.

    This inserts both the run's VCF and the truth VCF, if it hasn't been
    inserted, and their genotypes.
    """
    vcfs_table = metadata.tables.get('vcfs')
    vcf_uris = [(run['vcf_path'], False)]
    if run.get('truth_vcf_path'):
        vcf_uris.append((run['truth_vcf_path'], True))

    for (uri, is_validation) in vcf_uris:
        if vcf_exists(connection, uri):
            continue
        reader, header_text = load_vcf_from_hdfs(uri)
        vcf = {
            'uri': uri,
            'dataset_name': run.get('dataset'),
            'caller_name': run.get('variant_caller_name'),
            'normal_bam_uri': run.get('normal_path'),
            'tumor_bam_uri': run.get('tumor_path'),
            'notes': run.get('params'),
            'vcf_header': header_text,
            'validation_vcf': is_validation
        }
        vcfs_table.insert(vcf).execute()

        vcf_id = get_vcf_id(connection, uri)
        insert_genotypes_with_copy(reader, engine,
                                   default_values={'vcf_id': vcf_id},
                                   temporary_dir=TEMPORARY_DIR)

        # Now we determine which columns actually exist in this VCF, and cache
        # them (as this is a time-consuming operation) in the vcfs table for
        # later use.
        extant_cols = json.dumps(extant_columns(metadata, connection, vcf_id))
        (vcfs_table.update()
         .where(vcfs_table.c.id == vcf_id)
         .values(extant_columns=extant_cols)
         .execute())


def initialize_database(database_uri):
    """Return engine, connection, metadata (reflected) for the given DB URI."""
    engine = create_engine(database_uri)
    connection = engine.connect()
    metadata = MetaData(bind=connection)
    metadata.reflect()
    return engine, connection, metadata


def extant_columns(metadata, connection, vcf_id):
    """Return list of column names which have values in this VCF."""
    genotypes = metadata.tables.get('genotypes')
    columns = (col.name for col in genotypes.columns
               if col.name.startswith('info:') or
               col.name.startswith('sample:'))
    query = 'SELECT '
    query += ', '.join('max("{c}") as "{c}"'.format(c=col) for col in columns)
    query += ' FROM genotypes WHERE vcf_id = ' + str(vcf_id)

    maxed_columns = dict(connection.execute(query).fetchall()[0])
    return [k for k, v in maxed_columns.iteritems() if v is not None]


def get_vcf_id(con, uri):
    """Return id from vcfs table for the vcf corresponding to the given run."""
    query = "SELECT * FROM vcfs WHERE uri = '" + uri + "'"
    return con.execute(query).first().id


def delete_vcf(metadata, connection, uri):
    """Delete VCFs with this URI, and return True if rows were deleted."""
    vcfs = metadata.tables.get('vcfs')
    result = vcfs.delete().where(vcfs.c.uri == uri).execute()
    return result.rowcount > 0


def vcf_exists(connection, uri):
    """Return True if the VCF exists in the vcfs table, else return False."""
    query = "SELECT * FROM vcfs WHERE uri = '" + uri + "'"
    vcf_relation = connection.execute(query).first()
    return True if vcf_relation else False
