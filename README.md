## CycleDash

CycleDash tracks variant caller runs and carries out analyses on them. It
provides a RESTful interface and exports visualizations for comparing VCFs
within and across callers.

Very much a WIP and unstable.

### About

For now, see `/` in the running webapp.

### Running

(After setting up your virtual environment and sourcing your environment
variables, below) Start the webserver:

`python run.py`

Start workers:

`celery -A workers.scorer worker.scorer.1 --loglevel=info`

`celery -A workers.concordance worker.concordance.1 --loglevel=info`


### Config

Environment variables which must be exported:

```
export PORT=5000
export DATABASE_URL='sqlite:///test.db'
export CELERY_BACKEND='db+sqlite:///celery.db'
export CELERY_BROKER='amqp://localhost'
```
