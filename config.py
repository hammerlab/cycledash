import os

# ensure that false in config isn't interpreted as True
use_reloader = os.environ.get('USE_RELOADER', False)
if use_reloader and use_reloader.lower() == 'false':
    use_reloader = False
USE_RELOADER = use_reloader

SQLALCHEMY_DATABASE_URI = os.environ['DATABASE_URL']
PORT = int(os.environ.get('PORT', 5000))
WEBHDFS_USER = os.environ['WEBHDFS_USER']
WEBHDFS_URL = os.environ['WEBHDFS_URL']
IGV_HTTPFS_URL = os.environ['IGV_HTTPFS_URL']
ALLOW_LOCAL_VCFS = os.environ.get('ALLOW_LOCAL_VCFS', USE_RELOADER)

TYPEKIT_URL = os.environ.get('TYPEKIT_URL', None)

# These are the same as Compress's defaults, but with 'text/plain' added.
# This is important to us because VCF file are transmitted as 'text/plain'.
COMPRESS_MIMETYPES=['text/html', 'text/plain', 'text/css', 'text/xml',
                    'application/json', 'application/javascript']

import subprocess
DEPLOYED_GIT_HASH = subprocess.check_output(['git', 'rev-parse', 'HEAD'])[:-1]

del os
