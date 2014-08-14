"""Run Dream Evaluator and submit results to CycleDash

This worker accepts a VCF HDFS path and the truth VCF HDFS path to evaluate
against and posts the f1score, recall, and precision scores to CycleDash.
"""
import os
import uuid

import celery
import pysam
import requests
import vcf

import workers.scripts.dream_evaluator as dream
from workers.shared import hdfsToLocalPath



CELERY_BACKEND = os.environ.get('CELERY_BACKEND')
CELERY_BROKER = os.environ.get('CELERY_BROKER')

PORT = os.environ.get('PORT')

worker = celery.Celery('score',
                       broker=CELERY_BROKER, backend=CELERY_BACKEND)


@worker.task
def score(run_id, hdfs_vcf_path, hdfs_truth_vcf_path):
    """Runs the dream evaluator on a VCF and it's Truth on HDFS, submits the
    result back to the CycleDash front-end.
    """
    submission_path = hdfsToLocalPath(hdfs_vcf_path)
    truth_path = hdfsToLocalPath(hdfs_truth_vcf_path)
    pysam.tabix_index(truth_path, preset='vcf')
    results = dream.evaluate(submission_path, truth_path+'.gz')

    requests.put('http://localhost:{}/runs/{}'.format(PORT, str(run_id)),
                 data=results)
    return results
