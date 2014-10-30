"""Run Dream Evaluator and submit results to CycleDash

This worker accepts a VCF HDFS path and the truth VCF HDFS path to evaluate
against and posts the f1score, recall, and precision scores to CycleDash.
"""
import uuid

import json
import requests

from workers.shared import hdfsToLocalPath, worker, CYCLEDASH_PORT, RUNS_URL


@worker.task
def score(run_id, hdfs_vcf_path, hdfs_truth_vcf_path):
    """Run the DREAM evaluator on a VCF and its Truth on HDFS, PUT the
    result to CycleDash.
    """
    import pysam
    import workers.scripts.dream_evaluator as dream
    submit_url = RUNS_URL.format(CYCLEDASH_PORT, run_id)
    try:
        submission_path = hdfsToLocalPath(hdfs_vcf_path)
        truth_path = hdfsToLocalPath(hdfs_truth_vcf_path)
        pysam.tabix_index(truth_path, preset='vcf') # Required for DREAM evaluator.
        results = dream.evaluate(submission_path, truth_path+'.gz')
    except Exception as e:
        # Currently this error is uncaught. TODO(ihodes): make this work.
        error_message = str(e)
        results = {'error': error_message}
        raise e
    finally:
        requests.put(submit_url, data=json.dumps(results),
                     headers={'Content-Type': 'application/json'})
    return results
