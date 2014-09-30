import os

# ensure that false in config isn't interpreted as True
debug = os.environ.get('DEBUG', False)
if debug and debug.lower() == 'false':
    debug = False
assert debug == False, 'This environment variable is deprecated.'

SQLALCHEMY_DATABASE_URI = os.environ['DATABASE_URL']
PORT = int(os.environ.get('PORT', 5000))
USE_RELOADER = os.environ.get('USE_RELOADER', False)
WEBHDFS_USER = os.environ['WEBHDFS_USER']
WEBHDFS_URL = os.environ['WEBHDFS_URL']
IGV_HTTPFS_URL = os.environ['IGV_HTTPFS_URL']

TYPEKIT_URL = os.environ.get('TYPEKIT_URL', None)


del os
