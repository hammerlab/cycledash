#!/bin/bash
# Run both the Python & JS tests.
set -o errexit

. ./ENV.sh
nosetests --where=__tests__/python

npm test
