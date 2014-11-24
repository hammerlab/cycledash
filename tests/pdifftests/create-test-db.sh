#!/bin/bash
# Creates a test database for use with dpxdt tests.
#
# If you'd like to update the CSV file which gets loaded into the DB, you can
# run this script, use psql or cycledash to make your changes, and re-export
# using:
# pg_dump --data-only cycledash-dpxdt > tests/pdifftests/data.sql

set -o errexit

DB=cycledash-dpxdt

# --if-exists means to not report an error if the DB doesn't exist.
dropdb --if-exists $DB

createdb $DB
psql $DB < schema.sql
psql $DB < tests/pdifftests/data.sql
