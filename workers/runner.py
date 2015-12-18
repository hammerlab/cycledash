from celery import chain
import json

from genotype_extractor import extract as extract_genotype
from varcode_annotator import annotate as varcode_genes


def start_workers_for_vcf_id(vcf_id):
    # Run the genotype extractor, and then run the gene annotator with its
    # vcf_id set to the result of the extractor
    chain(extract_genotype.s(vcf_id), varcode_genes.s()).delay()


def restart_failed_tasks(task_names, vcf_id):
    if 'workers.genotype_extractor.extract' in task_names:
        chain(extract_genotype.s(vcf_id), varcode_genes.s()).delay()
    elif 'workers.varcode_annotator.annotate' in task_names:
        varcode_genes.s(vcf_id).delay()

