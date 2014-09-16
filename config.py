import os


SQLALCHEMY_DATABASE_URI = os.environ['DATABASE_URL']
PORT = int(os.environ.get('PORT', 5000))
DEBUG = os.environ.get('DEBUG', True) # TODO(ihodes): unsafe, but this doesn't
                                      # matter here.
WEBHDFS_USER = os.environ['WEBHDFS_USER']
WEBHDFS_URL = os.environ['WEBHDFS_URL']

TYPEKIT_URL = os.environ.get('TYPEKIT_URL', None)


del os
