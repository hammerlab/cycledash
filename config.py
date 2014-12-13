import os

def handle_false(value):
    if value and value.lower() == 'false':
        value = False
    return value

# ensure that false in config isn't interpreted as True
USE_RELOADER = handle_false(os.environ.get('USE_RELOADER', False))
SQLALCHEMY_DATABASE_URI = os.environ['DATABASE_URI']
PORT = int(os.environ.get('PORT', 5000))
WEBHDFS_USER = os.environ['WEBHDFS_USER']
WEBHDFS_URL = os.environ['WEBHDFS_URL']
IGV_HTTPFS_URL = os.environ['IGV_HTTPFS_URL']
ALLOW_LOCAL_VCFS = os.environ.get('ALLOW_LOCAL_VCFS', USE_RELOADER)
ALLOW_VCF_OVERWRITES = handle_false(
    os.environ.get('ALLOW_VCF_OVERWRITES', False))

TYPEKIT_URL = os.environ.get('TYPEKIT_URL', None)

import subprocess
try:
    DEPLOYED_GIT_HASH = subprocess.check_output(['git', 'rev-parse', 'HEAD'])[:-1]
except subprocess.CalledProcessError:
    DEPLOYED_GIT_HASH = '<No hash: not in git repository>'

TEMPORARY_DIR = os.environ.get('TEMPORARY_DIR', '/tmp')

TRAVIS = os.environ.get('TRAVIS')

del os
