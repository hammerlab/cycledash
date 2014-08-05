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



CELERY_BACKEND = os.environ.get('CELERY_BACKEND')
CELERY_BROKER = os.environ.get('CELERY_BROKER')


worker = celery.Celery('scorer', broker=CELERY_BROKER, backend=CELERY_BACKEND)


def lookup(obj, *args):
    return (obj[attr] for attr in args)

def hdfsToLocalPath(hdfs_path):
    # TODO(ihodes): Yes, this is a hack.
    url = 'http://demeter.hpc.mssm.edu:14000/webhdfs/v1'
    url += hdfs_path
    url += '?user.name=hodesi01&op=OPEN'
    result = requests.get(url).text
    filename = '/tmp/' + uuid.uuid4().get_hex() + '.vcf'
    fsock = open(filename, 'w')
    fsock.write(result)
    fsock.close()
    # Have to do all of this (storing in a file) because vcf.Reader can only
    # read from a file. Should probably cache this somewhere useful at least.
    return filename


@worker.task
def score(run_id, hdfs_vcf_path, hdfs_truth_vcf_path):
    """Runs the dream evaluator on a VCF and it's Truth on HDFS, submits the
    result back to the CycleDash front-end.
    """
    submission_path = hdfsToLocalPath(hdfs_vcf_path)
    truth_path = hdfsToLocalPath(hdfs_truth_vcf_path)
    pysam.tabix_index(truth_path, preset='vcf')
    results = dream.evaluate(submission_path, truth_path+'.gz')
    # TODO(ihodes): set URL correctly/from config
    requests.put('http://localhost:5000/runs/'+str(run_id), data=results)
    return results
