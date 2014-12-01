#!/bin/bash
# Run both the Python & JS tests.
set -o errexit

. ./ENV.sh
nosetests tests/python

./scripts/run-js-tests.sh
echo 'Running tests in reverse...'
./scripts/run-js-tests.sh reversed

echo 'Linting...'
./scripts/lint.sh
./scripts/travis-coverage.sh
