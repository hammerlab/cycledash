#!/bin/bash

source tests/ENV.sh

source tests/create-test-db.sh

python run.py > tests/pdifftests/log.txt 2>&1 &
RUN_PID=$!
echo pid of test server is $RUN_PID
echo logging to tests/pdifftests/log.txt

function finish {
    kill $RUN_PID
}
trap finish EXIT

sel update -b phantomjs -o tests/pdifftests/images "$@" tests/pdifftests
