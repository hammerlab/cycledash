import os
import requests
import uuid

import celery


CELERY_BACKEND = os.environ.get('CELERY_BACKEND')
CELERY_BROKER = os.environ.get('CELERY_BROKER')

WEBHDFS_URL = 'http://demeter.hpc.mssm.edu:14000/webhdfs/v1'
WEBHDFS_OPEN_OP = '?user.name=hodesi01&op=OPEN'

CYCLEDASH_PORT = os.environ.get('PORT')
RUNS_URL = 'http://localhost:{}/runs/{}'
CONCORDANCE_URL = 'http://localhost:{}/runs/{}/concordance'

worker = celery.Celery(broker=CELERY_BROKER, backend=CELERY_BACKEND)


def hdfsToLocalPath(hdfs_path):
    if not hdfs_path:
        raise ValueError('HDFS path to VCF must be provided.')

    url = WEBHDFS_URL + hdfs_path + WEBHDFS_OPEN_OP
    response = requests.get(url)
    if response.status_code != 200:
        raise ValueError('VCF at "' + hdfs_path + '" cannot be retrieved.')

    # Have to store VCF in a file because vcf.Reader can only read from a file.
    filename = '/tmp/' + uuid.uuid4().get_hex() + '.vcf'
    with open(filename, 'w') as fsock:
        fsock.write(response.text)

    return filename
