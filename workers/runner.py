from celery import chain
import json

import indexer
from genotype_extractor import extract as extract_genotype
from gene_annotator import annotate as annotate_genes


def start_workers_for_vcf_id(vcf_id, run):
    def index_bai(bam_path):
        indexer.index.delay(vcf_id, bam_path[1:])
    if run.get('normal_path'):
        index_bai(run['normal_path'])
    if run.get('tumor_path'):
        index_bai(run['tumor_path'])

    # Run the genotype extractor, and then run the gene annotator with its
    # vcf_id set to the result of the extractor
    chain(extract_genotype.s(vcf_id), annotate_genes.s()).delay()
