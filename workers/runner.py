from celery import chain
import json

import indexer
from genotype_extractor import extract as extract_genotype
from gene_annotator import annotate as annotate_genes


def start_workers_for_vcf_id(vcf_id):
    # Run the genotype extractor, and then run the gene annotator with its
    # vcf_id set to the result of the extractor
    chain(extract_genotype.s(vcf_id), annotate_genes.s()).delay()
