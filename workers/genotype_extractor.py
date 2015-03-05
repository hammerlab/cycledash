"""Inserts VCF data into the genotypes table for an already-existing run.

This is a Celery worker.

Extracts genotypes from the VCF itself, adding them to the genotypes table.
Finally, determines which columns in the vcf actually contain values, and
stores a list of them in the vcf table.
"""
import json

import config
from workers.shared import (load_vcf, worker,
                            initialize_database, DATABASE_URI,
                            TEMPORARY_DIR, update_extant_columns,
                            update_vcf_count, register_running_task)
from common.relational_vcf import insert_genotypes_with_copy


@worker.task(bind=True)
def extract(self, vcf_id):
    """Extract the genotype from an on-disk VCF and insert it into the DB.

    This also fills in a few fields in the vcfs table which aren't available
    until the entire VCF has been read, e.g. the variant count.

    Returns the vcf_id, or False if an error occurred.
    """
    register_running_task(self, vcf_id)
    engine, connection, metadata = initialize_database(DATABASE_URI)
    vcfs_table = metadata.tables.get('vcfs')

    vcf = vcfs_table.select().where(vcfs_table.c.id == vcf_id).execute().fetchone()

    # Validate the contents of the VCFs before modifying the database.
    reader, header_text = load_vcf(vcf['uri'])
    if vcf['validation_vcf'] and len(reader.samples) > 1:
        print 'Validation VCFs may only have one sample. {} has {}'.format(
                vcf['uri'], reader.samples)
        return False

    # Fill in VCF header text, which is now available.
    (vcfs_table.update()
               .where(vcfs_table.c.id == vcf_id)
               .values(vcf_header=header_text)
               .execute())

    insert_genotypes_with_copy(reader, engine,
                               default_values={'vcf_id': vcf_id},
                               temporary_dir=TEMPORARY_DIR)

    update_extant_columns(metadata, connection, vcf_id)
    update_vcf_count(metadata, connection, vcf_id)

    connection.close()
    return vcf_id
