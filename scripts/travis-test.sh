#!/bin/bash
# Run both the Python & JS tests.
set -o errexit

. ./tests/ENV.sh
./scripts/run-python-tests.sh

./scripts/run-js-tests.sh
echo 'Running tests in reverse...'
./scripts/run-js-tests.sh reversed

echo 'Linting...'
./scripts/lint.sh

if [ $CI ]; then
  set +o errexit
  ./scripts/travis-coverage.sh
  echo ''  # reset last exit code
fi

./scripts/travis-run-pdiff-tests.sh
