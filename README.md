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

```
celery -A workers.shared -I workers.concordance,workers.scorer worker -n worker.1 --loglevel=info
```

### Config

Environment variables which must be exported:

```
export PORT=5000
export DATABASE_URL='sqlite:///test.db'
export CELERY_BACKEND='db+sqlite:///celery.db'
export CELERY_BROKER='amqp://localhost'
```

### Usage

The primary endpoint for posting data to from an external source is `/runs`.

JSON should be posted to this URL with following fields:

**Required**
`vcfPath` -- The path on HDFS where the VCF can be found. This should be immutable, as CycleDash expects to be able to find the VCF here at any time.
`variantCallerName` -- The name of the variant caller which produced this VCF. This should remain constrant between VCFs with the same caller in order to compare runs to one another.

**Optional, highly recommended if truth VCF exists**
`truthVcfPath` -- The path on HDFS for the truth (or "reference") VCF. This should be immutable.

**Optional**
`dataset` -- The name of the dataset on which the caller was run (e.g. Dream Chromosome 20).
`tumorPath` -- The path on HDFS of the tumor BAM on which the caller was run.
`normalPath` -- The path on HDFS of the normalBAM on which the caller was run.
`params` -- Params that the caller was run with, or other notes relevant to the run.
