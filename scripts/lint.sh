#!/bin/bash
set -o errexit

find cycledash/static/js -name '*.js' \
  | grep -v /dist/ | grep -v 'bundled' \
  | xargs ./node_modules/.bin/jsxhint

find . -name '*.py' \
  | xargs pylint \
  --errors-only \
  --disable=print-statement \
  --ignored-classes=SQLAlchemy,Run,Concordance,scoped_session,pysam

echo 'Passes jsxhint and pylint check'
