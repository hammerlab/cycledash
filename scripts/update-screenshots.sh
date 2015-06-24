#! /bin/bash

# This script updates the visual test screenshots by starting a test server
# locally, connecting to SauceLabs, and having a SauceLabs browser carry out the
# tests remotely.

source tests/ENV.sh
mkdir tests/pdifftests/logs 2> /dev/null

BASE=tests/pdifftests
SELTEST_CAPABILITIES=scripts/seltest-remote-capabilities.json
DB_LOGS=$BASE/logs/DB_LOGs.txt
SC_READYFILE=$BASE/logs/SC_READYFILE
SC_CREDS=$BASE/SAUCE_CREDS
SC_LOGS=$BASE/logs/SC_LOGS.txt
SC_TIMEOUT=30
SAUCE_URL='ondemand.saucelabs.com:80/wd/hub'
RUN_SERVER_LOGS=$BASE/logs/TEST_SERVER_LOGS.txt
KEEP_SC_LOGS=0

# Make sure the ready file isn't there already.
[ -e "$SC_READYFILE" ] && rm $SC_READYFILE

function cleanup {
    echo -n "Cleaning up..."
    kill $RUN_PID
    ! [ -z $SC_PID ] && kill $SC_PID
    [ -e "$SC_READYFILE" ] && rm $SC_READYFILE
    [ "$KEEP_SC_LOGS" -ne 1 ] && [ -e "$SC_LOGS" ] && rm $SC_LOGS
    echo "done."
}
trap cleanup EXIT SIGTERM SIGKILL

function no_creds {
    echo "Need SAUCE_USERNAME and SAUCE_ACCESS_KEY to be set, or defined in $SC_CREDS."
    exit 1
}

# Look for Sauce Labs credentials in the environment, else try to require them
# from a known file.
if [ -z "$SAUCE_USERNAME" ] || [ -z "$SAUCE_ACCESS_KEY" ]; then
    if [ -e $SC_CREDS ]; then
        source $SC_CREDS
        if [ -z "$SAUCE_USERNAME" ] || [ -z "$SAUCE_ACCESS_KEY" ]; then
            no_creds
        fi
    else
        no_creds
    fi
fi

echo -n "Creating test DB, logging to $DB_LOGS..."
./tests/create-test-db.sh > $DB_LOGS 2>&1
echo "done."

echo -n "Starting test server, logging to $RUN_SERVER_LOGS..."
python run.py > $RUN_SERVER_LOGS 2>&1 &
RUN_PID=$!
echo "done."

if [ -z "$(ps aux | grep "sc .*-u $SAUCE_USERNAME" | grep -v grep)" ]; then
    echo -n "Opening SauceConnect tunnel from localhost"
    sc -u $SAUCE_USERNAME -k $SAUCE_ACCESS_KEY --readyfile $SC_READYFILE 1>$SC_LOGS 2>&1 &
    SC_PID=$!
    # This is how we wait until the SauceConnect tunnel is ready--waiting for the
    # touched file to appear.
    sleep_count=0
    while ! [ -e "$SC_READYFILE" ]; do
        echo -n "."
        if (( $sleep_count > $SC_TIMEOUT ))
        then
            echo "Couldn't start SauceConnect in $SC_TIMEOUT seconds, see logs in $SC_LOGS."
            KEEP_SC_LOGS=1
            exit 1
        fi
        sleep 1
        sleep_count=$(($sleep_count + 1))
    done
    echo "done."
else
    echo "SauceConnect tunnel detected already running, will attempt to use that."
fi

# Run the actual tests now that we're ready.
sel update -b remote \
    --remote-capabilities="$(cat $SELTEST_CAPABILITIES)" \
    --remote-command-executor="http://$SAUCE_USERNAME:$SAUCE_ACCESS_KEY@$SAUCE_URL" \
    -o $BASE/images \
    "$@" \
    $BASE

exit 0
