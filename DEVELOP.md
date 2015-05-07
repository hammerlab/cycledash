## Developing on CycleDash

Dependencies:

1. Python 2.7
2. Postgres 9.3 (should work on 9.0+)
3. [virtualenv](http://virtualenv.readthedocs.org/en/latest/) &
   [pip](https://pip.pypa.io/en/latest/quickstart.html)
4. [RabbitMQ](http://www.rabbitmq.com/) for workers


### 1. Install Dependencies

This is for a Mac install. Other OSs will have similar procedures (using e.g. apt-get or yum).

```bash
brew install Python                #brew will install the latest Python 2.7.9, which includes pip
brew install postgres
brew install rabbitmq
pip install virtualenv
```


### 2. Set up CycleDash

```bash
virtualenv venv                    # Initialize a new virtual environment.
source venv/bin/activate           # Activate your virtual environment.
pip install -r requirements.txt    # Install python requirements into virtualenv
npm install                        # Install JS requirements from package.json

```

After the initial setup, the only command you'll need to run is:
```
source venv/bin/activate
```


### 3. Create your `ENV.sh` file

You will need to generate an `ENV.sh` file using 'make initenv'. `ENV.sh` contains environment variables that need to be exported. You may need to tweak some settings for your installation.

```
make initenv                       # Initialize environment file.
$EDITOR ENV.sh                     # Fill in values. (see Step #3)
```


### 4. Set up the Database (Postgres)

We use PostgreSQL as our datastore, with the schema described in `schema.sql`.

On OS X, setting up and running psql might look like this:

```bash
postgres -D /usr/local/var/postgres
createdb cycledash
psql cycledash < schema.sql        # This loads the schema
```


### 5. Set up the JavaScript

You can iterate more quickly on JavaScript with the following:

```
npm install gulp -g     # Make sure you have gulp installed.
gulp                    # Compile the JS and start the automatic
                        # compiler and live-reloader.
```

To regenerate the `bundled.js` file without using the live reloader, run:

```
gulp build
```

This will also minify the JS and not create a source map.

To update BioDalliance, run:

```
npm install
gulp dalliance
```

Run `gulp peg` to update the `PEG.js` generated grammar after modifying CQL.

Run `gulp prod` to update all of the above (BioDalliance, PEG.js grammar, etc.)


### 6. Start CycleDash

To start the application server:

```bash
gulp prod
./run.sh
```


### 7. Run RabbitMQ (and keep it running)

To test the workers locally, you'll need to install and run rabbitmq 
during development. For example, on Mac OS X, you can do this via:

```
/usr/local/opt/rabbitmq/sbin/rabbitmq-server
```


### 8. Start a Worker

Start a worker to process the queue. Make sure RabbitMQ is up and running!

```
./worker.sh Bob         # Or whatever you want to name your worker.
                        # Say, RosieTheRiveter.
```

You can start more workers with `./worker.sh <name>` etc. *with a different
name*.


### Python

If `USE_RELOADER` is True in your `ENV.sh`, then you'll get automatic
code-reloading with the Flask server and JS/CSS reloading via livereload and
gulp's livereload plugin.


## Testing

CycleDash uses [nosetests](https://nose.readthedocs.org/en/latest/) for Python
tests, and [Mocha](http://mochajs.org/) for JavaScript testing.

To run tests:

```
source path/to/bin/activate
source ./tests/ENV.sh    # make sure all our environment variables are around
nosetests tests/python   # Run Python tests
npm test                 # Run JS tests
```

To run an individual JavaScript test, you can use:

```
./node_modules/.bin/mocha --require mocha-clean --compilers .:tests/js/preprocessor.js path/to/test.js [--grep <regex>]
```

#### Perceptual Diff Testing

CycleDash uses [seltest](https://github.com/ihodes/seltest) for perceptual
difference testing. This means the tests operate an actual web browser and take
screenshots of the web-app being used. To update the reference screenshots, run:

```
source path/to/bin/activate
./tests/pdifftests/run.sh
```

Running `git status` after this should indicate whether the screenshots have
changed.

You can pass command-line options to `seltest` through `run.sh`,
e.g. `./tests/pdifftests/run.sh -d chrome` to run with the Chrome driver, or
`./tests/pdifftests/run.sh -c examine -f base` to filter the tests to those in
the 'examine' class with 'base' in their name.

To determine whether there are any pixels that have changed before/after, and to
generate a perceptual diff that will make it clear where the changes are, you
can use [webdiff](https://github.com/danvk/webdiff): `git webdiff`.
