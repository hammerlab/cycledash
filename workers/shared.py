import os
import requests
import uuid

import celery


CELERY_BACKEND = os.environ.get('CELERY_BACKEND')
CELERY_BROKER = os.environ.get('CELERY_BROKER')

worker = celery.Celery(broker=CELERY_BROKER, backend=CELERY_BACKEND)

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
