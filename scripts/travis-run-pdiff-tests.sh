#! /bin/bash

# This script runs the visual tests on Travis.

source tests/ENV.sh
gulp prod
./tests/create-test-db.sh
SELTEST_CAPABILITIES=scripts/seltest-remote-capabilities.json
SAUCE_URL='ondemand.saucelabs.com:80/wd/hub'

python run.py > test-server-logs.txt 2>&1 &
RUN_PID=$!
trap "kill $RUN_PID" EXIT

# We need to tell SauceLabs which Travis job to connect to via the tunnel:
capabilities=$(python <<EOF
import json
capabilities = json.loads(open('$SELTEST_CAPABILITIES').read())
capabilities['tunnel-identifier'] = '$TRAVIS_JOB_NUMBER'
print(json.dumps(capabilities))
EOF
)

sel test -b remote \
    --remote-capabilities="$capabilities" \
    --remote-command-executor="http://$SAUCE_USERNAME:$SAUCE_ACCESS_KEY@$SAUCE_URL" \
    --imgur_client_id=$IMGUR_CLIENT_ID \
    -o tests/pdifftests/images tests/pdifftests
SELTEST_EXIT_CODE=$?

echo 'Logs from test server:'
cat test-server-logs.txt

exit $SELTEST_EXIT_CODE
