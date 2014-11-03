#!/bin/bash
# Generates LCOV data to post to coveralls.io when running on Travis.
set -o errexit

NODE_ENV=test ./node_modules/.bin/mocha \
  --require blanket \
  --reporter mocha-lcov-reporter \
  __tests__/js/*-test.js \
  | ./node_modules/coveralls/bin/coveralls.js
