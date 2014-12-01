#!/bin/bash
# Run either as:
# ./scripts/run-js-tests.sh
# ./scripts/run-js-tests.sh reversed


if [ "$1" == 'reversed' ]; then
  files=$(ls tests/js/*-test.js | perl -e 'print reverse <>')
else
  files=$(ls tests/js/*-test.js)
fi

./node_modules/.bin/mocha --compilers .:tests/js/preprocessor.js $files
