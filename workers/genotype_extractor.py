"""Inserts VCF data into the genotypes table for an already-existing run.

This is a Celery worker.

Extracts genotypes from the VCF itself, adding them to the genotypes table.
Finally, determines which columns in the vcf actually contain values, and
stores a list of them in the vcf table.
"""
import json

import sqlalchemy

import config
from workers.shared import (load_vcf, worker,
                            initialize_database, DATABASE_URI,
                            TEMPORARY_DIR, update_extant_columns,
                            update_vcf_count, register_running_task)
from common.relational_vcf import insert_genotypes_with_copy
from common.helpers import tables


@worker.task(bind=True)
def extract(self, vcf_id):
    register_running_task(self, vcf_id)
    return _extract(vcf_id)


def _extract(vcf_id):
    """Extract the genotypes from a VCF and insert into the DB.

    This also fills in a few fields in the vcfs table which aren't available
    until the entire VCF has been read, e.g. the variant count.

    Returns the vcf_id, or False if an error occurred.
    """
    engine = sqlalchemy.create_engine(DATABASE_URI)
    with tables(engine, 'vcfs') as (con, vcfs_table):
        metadata = sqlalchemy.MetaData(bind=con)
        metadata.reflect()
        vcf = vcfs_table.select().where(vcfs_table.c.id == vcf_id).execute().fetchone()

        # Validate the contents of the VCF before modifying the database.
        reader, header_text, release = load_vcf(vcf['uri'])

        # Fill in VCF header text, which is now available.
        (vcfs_table.update()
         .where(vcfs_table.c.id == vcf_id)
         .values(vcf_header=header_text, vcf_release=release)
         .execute())

        insert_genotypes_with_copy(reader, engine,
                                   default_values={'vcf_id': vcf_id},
                                   temporary_dir=TEMPORARY_DIR)

        update_extant_columns(metadata, con, vcf_id)
        update_vcf_count(metadata, con, vcf_id)
    return vcf_id
