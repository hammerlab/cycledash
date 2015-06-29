# See tests/pdifftests/README.md for details.
export PORT=5001
export DATABASE_URI='postgres://localhost/cycledash-test'
export WEBHDFS_USER=testing
export WEBHDFS_URL='http://example.com:123456'
export IGV_HTTPFS_URL='http://example.com:123456'
export ALLOW_LOCAL_VCFS=true
export CELERY_BACKEND='db+sqlite:///celery-dpxdt.db'
export CELERY_BROKER='amqp://localhost'
export SECRET_KEY='TESTSECRETS'
export BCRYPT_LOG_ROUNDS=1
