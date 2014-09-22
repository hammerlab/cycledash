## CycleDash

CycleDash tracks variant caller runs and facilitates analyses on them. It
provides a RESTful(ish) interface and faciliates the analysis of VCFs.

### About

For now, see `/` in the running webapp.

### Setting up CycleDash

```bash
virtualenv venv                    # Initialize a new virtual environment.
source venv/bin/activate           # Activate your virtual environment.
pip install -r requirements.txt    # Install requirements into virtualenv.
make initenv                       # Initialize environment file.
$EDITOR ENV.sh                     # Fill in values.
./initialize_database.sh           # Create database tables
```

For hammerlab folks, you'll want to set `WEBHDFS_URL` to
`http://demeter.hpc.mssm.edu:14000`.

### Start CycleDash

To start the application server:

```bash
./run.sh
```

Start a worker to process the queue:

```
./worker.sh Bob # Or whatever you want to name your worker.
                # Say, RosieTheRiveter.
```

You can start more workers with `./worker.sh <name>` etc. *with a different
name*.

### Development


#### JavaScript

You can make working with Javascript very easy with the following:

```
npm install             # Installs all packages in package.json.
npm install gulp -g     # Make sure you have gulp installed.
gulp                    # Compile the JS and start the automatic compiler
                        # and live-reloader.
```

To regenerate the `bundled.js` file without using the live reloader, run:

```
gulp build
```

#### Python

If `DEBUG` is True in your ENV.sh, then you'll get automatic code-reloading with
the Flask server. There's not much else to it.

### Config

(Edit ENV.sh file, generated by `make initenv`).

Environment variables which must be exported--edit them in the ENV.sh file make
made for you.

```
export PORT=5000
export DATABASE_URL='sqlite:///test.db'
export CELERY_BACKEND='db+sqlite:///celery.db'
export CELERY_BROKER='amqp://localhost'
export WEBHDFS_USER=username
export WEBHDFS_URL=http://example.com:5000
export TYPEKIT_URL="yourtypekitURLwithfontsincluded"
```

### API Usage

The primary endpoint for posting data to from an external source is `/runs`.

Additional information can be found on `/`, on the running webserver.

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


### Testing

CycleDash uses [nosetests](https://nose.readthedocs.org/en/latest/) for Python tests, and [Mocha.js](http://visionmedia.github.io/mocha/) for JavaScript testing.

To run tests:

```
nosetests   # Run Python tests
mocha       # Run JS tests
```
