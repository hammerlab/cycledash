#!/bin/bash
# See tests/pdifftests/README.md for details.

set -o errexit

DB=cycledash-test

# --if-exists means to not report an error if the DB doesn't exist.
dropdb --if-exists $DB

createdb $DB
python scripts/init_db.py force
psql $DB < tests/data.sql
