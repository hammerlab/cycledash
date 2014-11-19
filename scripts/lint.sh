#!/bin/bash
set -o errexit

find cycledash/static/js -name '*.js' \
  | grep -v /dist/ | grep -v 'bundled' \
  | xargs ./node_modules/.bin/jsxhint

echo 'Passes jsxhint lint check'
