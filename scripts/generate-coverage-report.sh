#!/bin/bash
set -o errexit

mocha --require blanket -R html-cov __tests__/js/*-test.js > coverage.html

echo 'Wrote coverage report to coverage.html'
