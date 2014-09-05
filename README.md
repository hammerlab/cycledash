## CycleDash

CycleDash tracks variant caller runs and carries out analyses on them. It
provides a RESTful interface and faciliates the analysis  VCFs.

### About

For now, see `/` in the running webapp.

### Running

(After setting up your virtual environment and sourcing your environment
variables, below), run

```bash
python run.py
```

Start a worker (you can start more, as well, by changing the name to
e.g. worker.2, worker.3, etc.):

```
celery -A workers.shared -I workers.concordance,workers.scorer worker -n worker.1 --loglevel=info
```

### Development

You can upgrade packages and move them to the right place within cycledash with:

```
npm install
make
```

### Config

Environment variables which must be exported--put them in the ENV file make made for you.

```
export PORT=5000
export DATABASE_URL='sqlite:///test.db'
export CELERY_BACKEND='db+sqlite:///celery.db'
export CELERY_BROKER='amqp://localhost'
export WEBHDFS_USER=username
export WEBHDFS_URL=http://example.com:5000
```

### Usage

The primary endpoint for posting data to from an external source is `/runs`.

JSON should be posted to this URL with following fields:

**Required**<br />
`vcfPath` -- The path on HDFS where the VCF can be found. This should be immutable, as CycleDash expects to be able to find the VCF here at any time.<br />
`variantCallerName` -- The name of the variant caller which produced this VCF. This should remain constrant between VCFs with the same caller in order to compare runs to one another.<br />

**Optional, highly recommended if truth VCF exists**<br />
`truthVcfPath` -- The path on HDFS for the truth (or "reference") VCF. This should be immutable.<br />

**Optional**<br />
`dataset` -- The name of the dataset on which the caller was run (e.g. Dream Chromosome 20).<br />
`tumorPath` -- The path on HDFS of the tumor BAM on which the caller was run.<br />
`normalPath` -- The path on HDFS of the normalBAM on which the caller was run.<br />
`params` -- Params that the caller was run with, or other notes relevant to the run.<br />
