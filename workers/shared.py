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

worker = celery.Celery(broker=CELERY_BROKER, backend=CELERY_BACKEND)


def _getHdfsClient():
    return pywebhdfs.webhdfs.PyWebHdfsClient(host=WEBHDFS_HOST,
                                             port=WEBHDFS_PORT,
                                             user_name=config.WEBHDFS_USER)


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


def hdfs_to_local_path(hdfs_path):
    contents = getContentsFromHdfs(hdfs_path)

    # Have to store VCF in a file because vcf.Reader can only read from a file.
    filename = '/tmp/' + uuid.uuid4().get_hex() + '.vcf'
    with open(filename, 'w') as fsock:
        fsock.write(contents)

    return filename


def hdfs_to_vcf(hdfs_vcf_path):
    """Return a vcf.Reader, header text for the given VCF residing on HDFS."""
    url = WEBHDFS_URL + hdfs_vcf_path + WEBHDFS_OPEN_OP
    response = requests.get(url)
    if response.status_code != 200:
        raise ValueError('VCF at "' + hdfs_vcf_path + '" cannot be retrieved.')
    text = response.text

    # Have to store VCF in a file because vcf.Reader can only read from a file.
    filename = '/tmp/' + uuid.uuid4().get_hex() + '.vcf'
    with open(filename, 'w') as fsock:
        fsock.write(text)

    header = '\n'.join(l for l in text.split('\n') if l.startswith('#'))

    return pyvcf.Reader(open(filename)), header
