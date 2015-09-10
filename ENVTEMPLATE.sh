export PORT=5000
export DATABASE_URI='postgres:///cycledash'
export CELERY_BACKEND='db+sqlite:///celery.db'
export CELERY_BROKER='amqp://localhost'
export WEBHDFS_USER=username
export WEBHDFS_URL=http://example.com:5000
export IGV_HTTPFS_URL=http://example.com:9876
export ALLOW_VCF_OVERWRITES=False
export BCRYPT_LOG_ROUNDS=12
export SECRET_KEY  # Set to something real + random for deployment

# True for automatic reloading & debugging JS insertion.
export USE_RELOADER=False

###  Optional:
## This is one way to get fancy fonts working in CycleDash.
# export TYPEKIT_URL="//use.typekit.net/SOMETHING.js"

# To serve BAM files using the GA4GH API
# export GA4GH_ROOT=/hdfs

## Useful to specify where CSV files will be written to when importing data into
## Postgres via CSV, which is how workers/genotype_extractor.py works.
## Default = '/tmp'
# export TEMPORARY_DIR='/users/donjoe/tmp'
