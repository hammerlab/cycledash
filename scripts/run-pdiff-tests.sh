./tests/create-test-db.sh
echo 'starting dev server for debug!'
echo 'travis_job_number='
echo $TRAVIS_JOB_NUMBER
python run.py
RUN_PID=$!
echo pid of test server is $RUN_PID
echo logging to tests/pdifftests/log.txt

function finish {
    kill $RUN_PID
}
trap finish EXIT

sel test -b remote \
    --remote-capabilities="{\"tunnel-identifier\": \"$TRAVIS_JOB_NUMBER\", \
                            \"platform\":\"Mac OS X 10.9\", \
                            \"browserName\": \"chrome\", \
                            \"browserVersion\": \"31\"}" \
    --remote-command-executor="http://$SAUCE_USERNAME:$SAUCE_ACCESS_KEY@ondemand.saucelabs.com:80/wd/hub" \
    --imgur_client_id=$IMGUR_CLIENT_ID \
    -o tests/pdifftests/images tests/pdifftests
