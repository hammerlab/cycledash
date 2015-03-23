Notes on working with perceptual diff tests
-------------------------------------------

There are some notes in [DEVELOP.md](/DEVELOP.md) about how to run the
perceptual diff tests to check for changes. This document describes how to
update and extend them.

CycleDash requires a PostgreSQL database to run, and a rabbitmq workqueue to
process new inputs. For the tests to be reproducible, it needs its own
instances of each of these.

You must have Postgres running to update the tests, e.g. by running:

    postgres -D /usr/local/var/postgres

If a test is failing or you'd like to create a new test, you may find it
helpful to run a CycleDash server using the test DB. You can do this via:

    gulp prod
    ./tests/create-test-db.sh
    ./tests/start-cycledash.sh

And then visiting http://localhost:5001/. Note that the server is started
without the Flask reloader, since this isn't necessary for automated testing.
You'll have to modify `tests/pdifftests/ENV.sh` if you want that functionality.

If you'd like to submit new runs, you'll need to start a separate workqueue and
Celery workers. This can be done by running these commands:

    brew install rabbitmq
    /usr/local/opt/rabbitmq/sbin/rabbitmq-server
    ./tests/pdifftests/worker.sh

You can submit the new run using either the web UI or the the REST interface.

To export the new run to the CSV file, you generate a database dump:

    pg_dump --data-only cycledash-test > tests/data.sql

For database migrations, it may be easiest to just resubmit all the runs.

[1]: /README.md
