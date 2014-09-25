export PORT=5000
export DATABASE_URL='sqlite:///test.db'
export CELERY_BACKEND='db+sqlite:///celery.db'
export CELERY_BROKER='amqp://localhost'
export WEBHDFS_USER=username
export WEBHDFS_URL=http://example.com:5000
export IGV_HTTPFS_URL=http://example.com:9876
export DEBUG=False # True for automatic reloading & debugging JS insertion: NB
                   # this is not safe!

#  Optional:
# export TYPEKIT_URL="//use.typekit.net/SOMETHING.js"
