#!/bin/bash
# Generates LCOV data to post to coveralls.io when running on Travis.
set -o errexit

. ./ENV.sh

# Run the Python tests with coverage -- stores results in coverage.xml
nosetests \
  --cover-xml \
  --with-coverage \
  --cover-tests \
  --cover-package cycledash,common,workers \
  tests/python

# Re-run the JavaScript tests with coverage -- stores results in .jscoverage
NODE_ENV=test ./node_modules/.bin/mocha \
  --require blanket \
  --reporter mocha-lcov-reporter \
  tests/js/*-test.js \
  > .jscoverage

# Convert coverage.xml to LCOV, merge and post to Coveralls.
cat .jscoverage \
  <(./scripts/xml_to_lcov.py coverage.xml) \
  | ./node_modules/coveralls/bin/coveralls.js
