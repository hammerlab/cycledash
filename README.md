## CycleDash

CycleDash tracks variant caller runs and carries out analyses on them. It
provides a RESTful interface and exports visualizations for comparing VCFs
within and across callers.

Very much a WIP and unstable.

### About

For now, see `/` in the running webapp.

### Running

Start the webserver:

`python run.py`

Start worker:

`celery -A workers.scorer worker --loglevel=info`


### Config

Environment variables which must be exported:

```
export DATABASE_URL='sqlite:///test.db'
export CELERY_BACKEND='db+sqlite:///celery.db'
export CELERY_BROKER='amqp://localhost'
```
