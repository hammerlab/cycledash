import os
import requests
import uuid

import celery
import pywebhdfs.webhdfs
import pywebhdfs.errors


CELERY_BACKEND = os.environ.get('CELERY_BACKEND')
CELERY_BROKER = os.environ.get('CELERY_BROKER')

WEBHDFS_HOST = 'demeter.hpc.mssm.edu'
WEBHDFS_PORT = 14000
WEBHDFS_USER = 'cycledash'

CYCLEDASH_PORT = os.environ.get('PORT')
RUNS_URL = 'http://localhost:{}/runs/{}'
CONCORDANCE_URL = 'http://localhost:{}/runs/{}/concordance'

worker = celery.Celery(broker=CELERY_BROKER, backend=CELERY_BACKEND)


def _getHdfsClient():
    return pywebhdfs.webhdfs.PyWebHdfsClient(
            host=WEBHDFS_HOST, port=WEBHDFS_PORT, user_name=WEBHDFS_USER)


def getContentsFromHdfs(hdfs_path):
    if not hdfs_path:
        raise ValueError('HDFS path must be provided.')

    if hdfs_path.startswith('/'):
        hdfs_path = hdfs_path[1:]

    return _getHdfsClient().read_file(hdfs_path)


def doesHdfsFileExist(hdfs_path):
    """Determine whether a file exists on HDFS. Shouldn't have leading '/'."""
    hdfs = _getHdfsClient()
    try:
        stat = hdfs.get_file_dir_status(hdfs_path)
    except pywebhdfs.errors.FileNotFound:
        return False
    else:
        return True


class HdfsFileAlreadyExistsError(Exception):
    pass


def putNewFileToHdfs(hdfs_path, contents):
    """Place contents in a new file on HDFS.

    hdfs_path should not have a leading '/'.
    Raises HdfsFileAlreadyExistsError is the file already exists.
    """
    if doesHdfsFileExist(hdfs_path):
        raise HdfsFileAlreadyExistsError(hdfs_path)

    _getHdfsClient().create_file(hdfs_path, contents)


def hdfsToLocalPath(hdfs_path):
    contents = getContentsFromHdfs(hdfs_path)

    # Have to store VCF in a file because vcf.Reader can only read from a file.
    filename = '/tmp/' + uuid.uuid4().get_hex() + '.vcf'
    with open(filename, 'w') as fsock:
        fsock.write(contents)

    return filename
