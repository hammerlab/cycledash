#!/bin/bash
# Run both the Python & JS tests.
set -o errexit

. ./ENV.sh
nosetests

npm test
./scripts/travis-coverage.sh
