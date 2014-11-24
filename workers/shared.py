import os
import urlparse
import uuid

import vcf as pyvcf
import celery
import config
import pywebhdfs.webhdfs
import pywebhdfs.errors


CELERY_BACKEND = os.environ['CELERY_BACKEND']
CELERY_BROKER = os.environ['CELERY_BROKER']

WEBHDFS_HOST, WEBHDFS_PORT = (
        urlparse.urlparse(config.WEBHDFS_URL).netloc.split(':'))

CYCLEDASH_PORT = os.environ['PORT']
RUNS_URL = 'http://localhost:{}/runs/{}'
CONCORDANCE_URL = 'http://localhost:{}/runs/{}/concordance'

DATABASE_URI = os.environ['DATABASE_URI']

TEMPORARY_DIR = os.environ.get('TEMPORARY_DIR', None)

worker = celery.Celery(broker=CELERY_BROKER, backend=CELERY_BACKEND)


def _get_hdfs_client():
    return pywebhdfs.webhdfs.PyWebHdfsClient(host=WEBHDFS_HOST,
                                             port=WEBHDFS_PORT,
                                             user_name=config.WEBHDFS_USER)


def get_contents_from_hdfs(hdfs_path):
    if not hdfs_path:
        raise ValueError('HDFS path must be provided.')

    if hdfs_path.startswith('/'):
        hdfs_path = hdfs_path[1:]

    return _get_hdfs_client().read_file(hdfs_path)


def does_hdfs_file_exist(hdfs_path):
    """Determine whether a file exists on HDFS. Shouldn't have leading '/'."""
    hdfs = _get_hdfs_client()
    try:
        stat = hdfs.get_file_dir_status(hdfs_path)
    except pywebhdfs.errors.FileNotFound:
        return False
    else:
        return True


class HdfsFileAlreadyExistsError(Exception):
    pass


def put_new_file_to_hdfs(hdfs_path, contents):
    """Place contents in a new file on HDFS.

    hdfs_path should not have a leading '/'.
    Raises HdfsFileAlreadyExistsError is the file already exists.
    """
    if does_hdfs_file_exist(hdfs_path):
        raise HdfsFileAlreadyExistsError(hdfs_path)

    _get_hdfs_client().create_file(hdfs_path, contents)


def hdfs_to_local_path(hdfs_path):
    contents = get_contents_from_hdfs(hdfs_path)

    filename = '/tmp/' + uuid.uuid4().get_hex() + '.vcf'
    with open(filename, 'w') as fsock:
        fsock.write(contents)

    return filename


def load_vcf_from_hdfs(hdfs_vcf_path):
    """Return a vcf.Reader, header text for the given VCF residing on HDFS."""
    if config.ALLOW_LOCAL_VCFS and hdfs_vcf_path.startswith('/tests/'):
        text = open(hdfs_vcf_path[1:]).read()
    else:
        text = get_contents_from_hdfs(hdfs_vcf_path)
    header = '\n'.join(l for l in text.split('\n') if l.startswith('#'))

    return pyvcf.Reader(l for l in text.split('\n')), header
