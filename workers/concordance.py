"""Run Concordance over VCFs and submit results to CycleDash

This worker accepts several run IDs with a common truth VCF and executes the
concordance script on them, posting the calls in common back to CycleDash.
"""
import os
import uuid

import celery
import json
import requests
import vcf

import workers.scripts.concordance_counter
from workers.shared import hdfsToLocalPath


# TODO(ihodes): do we really need to keep results?
CELERY_BACKEND = os.environ.get('CELERY_BACKEND')
CELERY_BROKER = os.environ.get('CELERY_BROKER')

PORT = os.environ.get('PORT')

worker = celery.Celery('concordance',
                       broker=CELERY_BROKER, backend=CELERY_BACKEND)

@worker.task
def concordance(run_ids_key):
    # TODO(ihodes): If all runs share a truth VCF, then process the truth VCF as
    # well, automatically.
    run_ids = map(int, run_ids_key.split(','))
    vcfs = {}
    for run_id in run_ids:
        run_json = requests.get('http://localhost:{}/runs/{}'.format(PORT, str(run_id))).text
        run = json.loads(run_json)
        if not run:
            # TODO(ihodes): throw &|| record error
            raise KeyError
        vcfs[run['variantCallerName']] = hdfsToLocalPath(run['vcfPath'])
    results = workers.scripts.concordance_counter.concordance(vcfs)
    concordance_data = {'concordance_json': results}
    request_url = 'http://localhost:{}/runs/concordance/{}'.format(PORT, run_ids_key)
    requests.put(request_url, data=concordance_data)
    return json.dumps(concordance_data)
