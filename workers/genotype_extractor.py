"""Prepares, and inserts, a submitted run into CycleDash's database.

This is a Celery worker.

Adds run metadata to the vcf table, then extracts genotypes from the VCF itself,
adding them to the genotypes table. Finally, determines which columns in the vcf
actually contain values, and stores a list of them in the vcf table.
"""
import json
from sqlalchemy import create_engine, MetaData

from workers.shared import load_vcf_from_hdfs, worker, DATABASE_URI
from workers.relational_vcfs import insert_vcf_with_copy


@worker.task
def extractor(run):
    """Extract the genotype and VCF metadata required to insert a VCF into the
    CycleDash database, and insert it.
    """
    run = json.loads(run)
    engine, connection, metadata = initialize_database(DATABASE_URI)

    if vcf_exists(connection, run):
        print 'VCF already exists with URI {}'.format(run['vcf_path'])
        return False

    reader, header = load_vcf_from_hdfs(run['vcf_path'])
    insert_vcf_metadata(metadata, run, header)
    vcf_id = get_vcf_id(connection, run)
    insert_vcf_with_copy(reader, 'genotypes', engine,
                         default_values={'vcf_id': vcf_id})

    # Now we determine which columns actually exist in this VCF, and cache them
    # (as this is a time-consuming operation) in the vcfs table for later use.
    extant_cols = json.dumps(extant_columns(metadata, connection, vcf_id))
    vcfs = metadata.tables.get('vcfs')
    vcfs.update().where(vcfs.c.id == vcf_id).values(header_spec=extant_cols).execute()

    connection.close()
    return True


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


def insert_vcf_metadata(metadata, run, header):
    """Insert runs metadata into the vcfs table."""
    metadata.tables.get('vcfs').insert({
        'caller_name': run['variant_caller_name'],
        'dataset_name': run['dataset'],
        'normal_bam_uri': run.get('normal_path'),
        'tumor_bam_uri': run.get('tumor_path'),
        'uri': run['vcf_path'],
        'vcf_header': header,
        'validation_vcf': True if run.get('is_validation') else False
    }).execute()


def get_vcf_id(con, run):
    """Return id from vcfs table for the vcf corresponding to the given run."""
    query = "SELECT * FROM vcfs WHERE uri = '" + run['vcf_path'] + "'"
    return con.execute(query).first().id


def vcf_exists(connection, run):
    """Return True if the VCF exists in teh vcfs table, else return False."""
    query = "SELECT * FROM vcfs WHERE uri = '" + run['vcf_path'] + "'"
    vcf_relation = connection.execute(query).first()
    return True if vcf_relation else False
