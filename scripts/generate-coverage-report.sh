#!/bin/bash
set -o errexit

mocha --require blanket -R html-cov tests/js/*-test.js > coverage.html

echo 'Wrote coverage report to coverage.html'
