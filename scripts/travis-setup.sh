#!/bin/bash
# Install all deps & build everything for the Python & JS tests.
set -o errexit

DB=cycledash-test

# --if-exists means to not report an error if the DB doesn't exist.
dropdb --if-exists $DB

createdb $DB
psql $DB < schema.sql

pip install -r <(grep -v 'pysam\|dpxdt\|pyensembl' requirements.txt)
npm install
make initenv

gulp prod
