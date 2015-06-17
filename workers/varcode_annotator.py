"""Annotate genotype data with the effects on gene- and protein-level

Given genotype data set that exists in the DB, finds the transcript- and
protein-level effects of variants and adds them as annotations.

The worker utilizes a combination of PyEnsembl and Varcode methods
to do the annotations and save them back into the database.

Steps:

    1. Get contig and position data from the genotypes table.
    2. Look up each (contig, position, ref, alt) from Varcode
    3. Create a CSV file, and write the annotations to it.
    4. Create a temporary DB table, and write the CSV file to it.
    5. Update the genotypes table by joining with the temporary table.
    6. Update the list of extant columns.
"""
from contextlib import contextmanager
import csv
import re
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
    from varcode import Variant

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
        gene_names = get_varcode_annotations(genotypes, vcf_id, config.ENSEMBL_RELEASE)

        tmp_table = Table('gene_annotations',
                          metadata,
                          Column('contig', Text, nullable=False),
                          Column('position', Integer, nullable=False),
                          Column('reference', Text, nullable=False),
                          Column('alternates', Text, nullable=False),
                          Column('gene_name', Text, nullable=True),
                          Column('transcript', Text, nullable=True),
                          Column('notation', Text, nullable=True),
                          Column('effect_type', Text, nullable=True),
                          prefixes=['TEMPORARY'])

        try:
            tmp_table.create()
            write_to_table_via_csv(tmp_table, rows=gene_names, connection=con)
            # Add gene names from temp table to genotypes.
            (genotypes.update()
             .where(genotypes.c.contig == tmp_table.c.contig)
             .where(genotypes.c.position == tmp_table.c.position)
             .where(genotypes.c.reference == tmp_table.c.reference)
             .where(genotypes.c.alternates == tmp_table.c.alternates)
             .where(genotypes.c.vcf_id == vcf_id)
             .values(
                 {
                    'annotations:varcode_gene_name': tmp_table.c.gene_name,
                    'annotations:varcode_transcript': tmp_table.c.transcript,
                    'annotations:varcode_effect_notation': tmp_table.c.notation,
                    'annotations:varcode_effect_type': tmp_table.c.effect_type
                 }
             )).execute()
        finally:
            con.execute("DISCARD TEMP")

        # We've added annotations:varcode_*, so update the columns to display.
        update_extant_columns(metadata, con, vcf_id)
        return(vcf_id)


def write_to_table_via_csv(table, rows, connection):
    with temp_csv(mode='r+', tmp_dir=TEMPORARY_DIR) as csv_file:
        # Don't use commas as a delim, as commas are part of gene_names.
        csv.writer(csv_file, delimiter='\t').writerows(rows)
        csv_file.seek(0, 0)
        connection.connection.cursor().copy_from(csv_file, sep='\t', null='',
                                                 table=table.name)
        connection.connection.commit()


def get_varcode_annotations(genotypes, vcf_id, ensembl_release_num):
    """Get contig, position, ref and alt data from the genotypes table, 
    and get the best effect from Varcode library. Return a list of the form:
    [[contig, position, "NAME,NAME,..."], [contig...], ...]
    """
    results = select([
            genotypes.c.contig,
            genotypes.c.position,
            genotypes.c.reference,
            genotypes.c.alternates
        ]).where(genotypes.c.vcf_id == vcf_id).execute()

    ensembl_rel = EnsemblRelease(ensembl_release_num)

    varcode_annotations = []
    for contig, position, reference, alternates in results:
        variant = Variant(
            contig=contig, 
            start=position, 
            ref=reference.encode('ascii','ignore'),
            alt=alternates.encode('ascii','ignore'), 
            ensembl=ensembl_rel)

        # This will give us a single, yet relevant effect
        best_effect = variant.effects().top_priority_effect()
        gene_name = best_effect.gene_name
        transcript = best_effect.transcript_id
        notation = best_effect.short_description
        effect_type = type(best_effect).__name__
        # Make it human readable
        effect_type = re.sub("([a-z])([A-Z])","\g<1> \g<2>", effect_type)
        varcode_annotations.append([contig, position, reference, alternates, 
            gene_name, transcript, notation, effect_type])

    return varcode_annotations
