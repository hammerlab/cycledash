"""Run Concordance over VCFs and submit results to CycleDash

This worker accepts several run IDs with a common truth VCF and executes the
concordance script on them, posting the calls in common back to CycleDash.
"""
import uuid

import json
import requests

from workers.shared import (hdfsToLocalPath, worker, CYCLEDASH_PORT, RUNS_URL,
                            CONCORDANCE_URL)


@worker.task
def concordance(run_ids_key):
    """Run concordance on the VCFs identified by a comma-separated string of run
    ids and PUT the result to CycleDash.
    """
    submit_url = CONCORDANCE_URL.format(CYCLEDASH_PORT, run_ids_key)
    vcfs = {}
    truth_vcfs = set()
    try:
        import workers.scripts.concordance_counter
        run_ids = (int(run_id) for run_id in run_ids_key.split(','))
        for run_id in run_ids:
            run_json = requests.get(RUNS_URL.format(CYCLEDASH_PORT, run_id)).text
            run = json.loads(run_json)
            concordance_name = run['variantCallerName'] + '-' + str(run['id'])
            vcfs[concordance_name] = hdfsToLocalPath(run['vcfPath'])
            if run['truthVcfPath']:
                truth_vcfs.add(run['truthVcfPath'])
        if len(truth_vcfs) == 1:
            vcfs['Truth'] = hdfsToLocalPath(truth_vcfs.pop())
        concordance_data = workers.scripts.concordance_counter.concordance(vcfs)
        print concordance_data
        results = {'concordance_json': concordance_data,
                   'state': 'complete'}
    except Exception as e:
        error_message = str(e)
        results = {'error': error_message, 'state': 'failed'}
        raise e
    finally:
        requests.put(submit_url, data=json.dumps(results),
                     headers={'Content-Type': 'application/json'})
    return json.dumps(results)
