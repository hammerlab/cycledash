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

source ./tests/create-test-db.sh
gulp prod
python run.py > tests/pdifftests/log.txt 2>&1 &
RUN_PID=$!
echo pid of test server is $RUN_PID
echo logging to tests/pdifftests/log.txt

function finish {
    kill $RUN_PID
}
trap finish EXIT

sel update -b remote --remote-capabilities="{\"tunnel-identifier\": \"$TRAVIS_JOB_NUMBER\", \"platform\":\"Mac OS X 10.9\", \"browserName\": \"chrome\", \"browserVersion\": \"31\"}"\
    --remote-command-executor="http://$SAUCE_USERNAME:$SAUCE_ACCESS_KEY@ondemand.saucelabs.com:80/wd/hub"\
    -o tests/pdifftests/images tests/pdifftests
