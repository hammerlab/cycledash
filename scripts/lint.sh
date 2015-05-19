#!/bin/bash
set -o errexit

find cycledash/static/js tests -name '*.js' \
  | grep -v /dist/ | grep -v 'bundled' | grep -v /playground/ \
  | xargs ./node_modules/.bin/jsxhint

git ls-files | grep .py \
  | xargs pylint \
  --errors-only \
  --disable=print-statement,no-member,no-name-in-module \
  --ignored-classes=SQLAlchemy,Run,Concordance,scoped_session,pysam

echo 'Passes jsxhint and pylint check'
