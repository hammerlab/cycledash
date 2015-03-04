"""Annotate genotype data with gene annotations.

Given genotype data that exists in the DB, joins that data with Ensembl
to arrive at gene name(s) for each locus.

We currently create a CSV file and COPY it into a temporary Postgres table as a
mechanism for bulk loading the annotation data. The resultant UPDATE becomes a
single join.

Steps:

    1. Get contig and position data from the genotypes table.
    2. Look up each (contig, position) in Ensembl.
    3. Create a CSV file, and write the Ensembl gene names to it.
    4. Create a temporary DB table, and write the CSV file to it.
    5. Update the genotypes table by joining with the temporary table.
    6. Update the list of extant columns.
"""
from contextlib import contextmanager
import csv
from sqlalchemy import select, Table, Column
from sqlalchemy.types import Text, Integer
import time

import config

from workers.shared import (worker, DATABASE_URI, TEMPORARY_DIR,
                            initialize_database, temp_csv,
                            update_extant_columns, register_running_task)

if not config.TRAVIS:
    from pyensembl import EnsemblRelease


# TODO(tavi) Handle inconsistent states and retries.
@worker.task(bind=True)
def annotate(self, vcf_ids):
    if vcf_ids == False:
        return  # An error must have occurred earlier.
    for vcf_id in vcf_ids:
        register_running_task(self, vcf_id=vcf_id)
    for vcf_id in vcf_ids:
        _annotate_one(vcf_id)


def _annotate_one(vcf_id):
    time.sleep(20)
    _, connection, metadata = initialize_database(DATABASE_URI)
    with close_and_discard(connection):
        gene_names = get_gene_names(
            connection, metadata, vcf_id, ensembl_release_num=75)

        # Open file for both writing (the gene annotations) and reading that
        # out to Postgres
        with temp_csv(mode='r+', tmp_dir=TEMPORARY_DIR) as csv_file:
            # Don't use commas as a delim, as commas are part of gene_names
            csv.writer(csv_file, delimiter='\t').writerows(gene_names)

            # Back to the beginning of the file
            csv_file.seek(0, 0)

            with connection.connection.cursor() as cursor:
                tmp_table = Table('gene_annotations',
                    metadata,
                    Column('contig', Text, nullable=False),
                    Column('position', Integer, nullable=False),
                    Column('gene_names', Text, nullable=True),
                    prefixes=['TEMPORARY'])
                tmp_table.create()

                cursor.copy_from(csv_file, sep='\t', null='',
                    table=tmp_table.name)
                connection.connection.commit()

                # Join genotypes with the temporary table created above
                genotypes = metadata.tables.get('genotypes')
                genotypes.update().where(
                    genotypes.c.contig == tmp_table.c.contig).where(
                    genotypes.c.position == tmp_table.c.position).where(
                    genotypes.c.vcf_id == vcf_id).values(
                        {'annotations:gene_names': tmp_table.c.gene_names}
                    ).execute()

                # Update the list of extant columns for the UI
                update_extant_columns(metadata, connection, vcf_id)


def get_gene_names(connection, metadata, vcf_id, ensembl_release_num):
    """Get contig and position data from the genotypes table, and look up
    each (contig, position) in Ensembl. Return a list of the form:
    [[contig, position, "NAME,NAME,..."], [contig...], ...]
    """
    genotypes = metadata.tables.get('genotypes')
    stmt = select([genotypes.c.contig, genotypes.c.position]).where(
        genotypes.c.vcf_id == vcf_id)
    results = connection.execute(stmt)

    # TODO(tavi) Read the Ensembl release from the VCF.
    # TODO(tavi) Workers should prefetch Ensembl data.
    data = EnsemblRelease(ensembl_release_num)

    gene_names = []
    for contig, position in results:
        # TODO(tavi) Use ref/alt to expand the set of gene names beyond the
        # starting position of the mutation. This will only expand the gene
        # names in rare cases, unless we're considering structural variants.
        gene_names_for_locus = data.gene_names_at_locus(
        str(contig), int(position))
        gene_name_str = ','.join(gene_names_for_locus)
        gene_names.append([contig, position, gene_name_str])

    return gene_names


@contextmanager
def close_and_discard(connection):
    """Discard any temporary tables before closing a connection."""
    try:
        yield connection
    finally:
        try:
            connection.execute("DISCARD TEMP")
        finally:
            connection.close()
