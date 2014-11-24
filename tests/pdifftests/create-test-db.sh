#!/bin/bash
# Creates a test database for use with dpxdt tests.
#
# See tests/pdifftests/README.md for details.

set -o errexit

DB=cycledash-dpxdt

# --if-exists means to not report an error if the DB doesn't exist.
dropdb --if-exists $DB

createdb $DB
psql $DB < schema.sql
psql $DB < tests/pdifftests/data.sql
