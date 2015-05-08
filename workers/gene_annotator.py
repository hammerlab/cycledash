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
import sqlalchemy
from sqlalchemy import select, Table, Column
from sqlalchemy.types import Text, Integer

import config

from common.helpers import tables

from workers.shared import (worker, DATABASE_URI, TEMPORARY_DIR,
                            initialize_database, temp_csv,
                            update_extant_columns, register_running_task)

if not config.TRAVIS:
    from pyensembl import EnsemblRelease


@worker.task(bind=True)
def annotate(self, vcf_id):
    if vcf_id == False:
        return  # An error must have occurred earlier.
    register_running_task(self, vcf_id)

    EnsemblRelease(config.ENSEMBL_RELEASE).install()  # Only runs the first time for this release.

    engine = sqlalchemy.create_engine(DATABASE_URI)
    with tables(engine, 'genotypes') as (con, genotypes):
        metadata = sqlalchemy.MetaData(bind=con)
        metadata.reflect()
        gene_names = get_gene_names(genotypes, vcf_id, config.ENSEMBL_RELEASE)

        tmp_table = Table('gene_annotations',
                          metadata,
                          Column('contig', Text, nullable=False),
                          Column('position', Integer, nullable=False),
                          Column('gene_names', Text, nullable=True),
                          prefixes=['TEMPORARY'])
        try:
            tmp_table.create()
            write_to_table_via_csv(tmp_table, rows=gene_names, connection=con)
            # Add gene names from temp table to genotypes.
            (genotypes.update()
             .where(genotypes.c.contig == tmp_table.c.contig)
             .where(genotypes.c.position == tmp_table.c.position)
             .where(genotypes.c.vcf_id == vcf_id)
             .values(
                 {'annotations:gene_names': tmp_table.c.gene_names}
             )).execute()
        finally:
            con.execute("DISCARD TEMP")

        # We've added annotations:gene_names, so update the columns to display.
        update_extant_columns(metadata, con, vcf_id)


def write_to_table_via_csv(table, rows, connection):
    with temp_csv(mode='r+', tmp_dir=TEMPORARY_DIR) as csv_file:
        # Don't use commas as a delim, as commas are part of gene_names.
        csv.writer(csv_file, delimiter='\t').writerows(rows)
        csv_file.seek(0, 0)
        connection.connection.cursor().copy_from(csv_file, sep='\t', null='',
                                                 table=table.name)
        connection.connection.commit()


def get_gene_names(genotypes, vcf_id, ensembl_release_num):
    """Get contig and position data from the genotypes table, and look up
    each (contig, position) in Ensembl. Return a list of the form:
    [[contig, position, "NAME,NAME,..."], [contig...], ...]
    """
    results = select([genotypes.c.contig, genotypes.c.position]).where(
        genotypes.c.vcf_id == vcf_id).execute()

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
