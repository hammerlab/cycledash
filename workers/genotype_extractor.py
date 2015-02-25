"""Prepares, and inserts, a submitted run into CycleDash's database.

This is a Celery worker.

Adds run metadata to the vcf table, then extracts genotypes from the VCF itself,
adding them to the genotypes table. Finally, determines which columns in the vcf
actually contain values, and stores a list of them in the vcf table.
"""
import json

import config
from workers.shared import (load_vcf, worker,
                            initialize_database, DATABASE_URI,
                            TEMPORARY_DIR, update_extant_columns)
from common.relational_vcf import insert_genotypes_with_copy


@worker.task
def extract(run):
    """Extract the genotype and VCF metadata required to insert a VCF into the
    CycleDash database, and insert it.

    Returns a list of IDs for the VCFs which were inserted, or False if an
    error occurred.
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

    vcf_ids = insert_run(run, engine, connection, metadata)

    connection.close()
    return vcf_ids


def insert_run(run, engine, connection, metadata):
    """Insert the run into the database.

    This inserts both the run's VCF and the truth VCF, if it hasn't been
    inserted, and their genotypes. Returns the inserted VCF IDs, or False if an
    error occurred.
    """
    vcfs_table = metadata.tables.get('vcfs')
    vcfs = [{'uri': run['vcf_path'], 'is_validation': False}]
    if run.get('truth_vcf_path'):
        vcfs.append({'uri': run['truth_vcf_path'], 'is_validation': True})

    # Validate the contents of the VCFs before modifying the database.
    vcfs = [v for v in vcfs if not vcf_exists(connection, v['uri'])]
    for vcf in vcfs:
        reader, header_text = load_vcf(vcf['uri'])
        if vcf['is_validation'] and len(reader.samples) > 1:
            print 'Validation VCFs may only have one sample. {} has {}'.format(
                    vcf['uri'], reader.samples)
            return False
        vcf['reader'] = reader
        vcf['header_text'] = header_text


    vcf_ids = []
    for vcf in vcfs:
        uri = vcf['uri']
        is_validation = vcf['is_validation']
        reader = vcf['reader']
        header_text = vcf['header_text']

        vcf = {
            'uri': uri,
            'dataset_name': run.get('dataset'),
            'caller_name': run.get('variant_caller_name'),
            'normal_bam_uri': run.get('normal_path'),
            'tumor_bam_uri': run.get('tumor_path'),
            'notes': run.get('params'),
            'project_name': run.get('project_name'),
            'vcf_header': header_text,
            'validation_vcf': is_validation
        }
        vcfs_table.insert(vcf).execute()

        vcf_id = get_vcf_id(connection, uri)
        insert_genotypes_with_copy(reader, engine,
                                   default_values={'vcf_id': vcf_id},
                                   temporary_dir=TEMPORARY_DIR)

        update_extant_columns(metadata, connection, vcf_id)
        vcf_ids.append(vcf_id)

    return vcf_ids


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
