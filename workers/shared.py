import json
import os
import urlparse
import uuid
import tempfile

import vcf as pyvcf
import celery
from sqlalchemy import create_engine, MetaData
import pywebhdfs.webhdfs
import pywebhdfs.errors

import config

CELERY_BACKEND = os.environ['CELERY_BACKEND']
CELERY_BROKER = os.environ['CELERY_BROKER']

WEBHDFS_HOST, WEBHDFS_PORT = (
        urlparse.urlparse(config.WEBHDFS_URL).netloc.split(':'))

CYCLEDASH_PORT = os.environ['PORT']
RUNS_URL = 'http://localhost:{}/runs/{}'
CONCORDANCE_URL = 'http://localhost:{}/runs/{}/concordance'

DATABASE_URI = os.environ['DATABASE_URI']

TEMPORARY_DIR = config.TEMPORARY_DIR

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


def load_vcf(vcf_path):
    """Return a vcf.Reader, header text for the given VCF."""
    if config.ALLOW_LOCAL_VCFS and vcf_path.startswith('/tests/'):
        text = open(vcf_path[1:]).read()
    elif vcf_path.startswith('file://'):
        text = open(vcf_path[6:]).read()
    elif vcf_path.startswith('hdfs://'):
        return load_vcf(vcf_path[6:])
    else:
        text = get_contents_from_hdfs(vcf_path)
    header = '\n'.join(l for l in text.split('\n') if l.startswith('#'))

    return pyvcf.Reader(l for l in text.split('\n')), header


def initialize_database(database_uri):
    """Return engine, connection, metadata (reflected) for the given DB URI."""
    engine = create_engine(database_uri)
    connection = engine.connect()
    metadata = MetaData(bind=connection)
    metadata.reflect()
    return engine, connection, metadata


def temp_csv(mode, tmp_dir=None):
    """Create a temporary csv file and return it. Don't delete on close.
    Finally, do a chmod 644 on the file in any a different process owner needs
    to read it.
    """
    # TODO(tavi) Address the fact that these files are not going to be deleted.
    csvfile = tempfile.NamedTemporaryFile(mode=mode, delete=False, dir=tmp_dir)

    # In case a different process owner, e.g. postgres, needs to read it.
    os.chmod(csvfile.name, 0o644)
    return csvfile


def update_extant_columns(metadata, connection, vcf_id):
    """Determine which columns actually exist in this VCF, and cache them
    (as this is a time-consuming operation) in the vcfs table for later use.
    """
    extant_cols = json.dumps(extant_columns(metadata, connection, vcf_id))
    vcfs = metadata.tables.get('vcfs')
    vcfs.update().where(vcfs.c.id == vcf_id).values(
        extant_columns=extant_cols).execute()


def extant_columns(metadata, connection, vcf_id):
    """Return list of column names which have values in this VCF."""
    genotypes = metadata.tables.get('genotypes')
    columns = (col.name for col in genotypes.columns
               if col.name.startswith('info:') or
               col.name.startswith('sample:') or
               col.name.startswith('annotations:'))
    query = 'SELECT '
    query += ', '.join('max("{c}") as "{c}"'.format(c=col) for col in columns)
    query += ' FROM genotypes WHERE vcf_id = ' + str(vcf_id)

    maxed_columns = dict(connection.execute(query).fetchall()[0])
    return [k for k, v in maxed_columns.iteritems() if v is not None]
