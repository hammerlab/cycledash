#!/bin/bash
# Install all deps & build everything for the Python & JS tests.
set -o errexit

./tests/create-test-db.sh

pip install -r <(grep -v 'pysam\|dpxdt\|pyensembl' requirements.txt)
npm install
make initenv

gulp prod
