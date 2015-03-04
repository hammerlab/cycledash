#!/bin/bash
# Creates a test database for use with tests.
#
# See tests/pdifftests/README.md for details.

set -o errexit

DB=cycledash-test

# --if-exists means to not report an error if the DB doesn't exist.
dropdb --if-exists $DB

createdb $DB
psql $DB < schema.sql
psql $DB < tests/data.sql
