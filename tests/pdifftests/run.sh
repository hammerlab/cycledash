source venv/bin/activate
source tests/ENV.sh
python run.py > tests/pdifftests/log.txt 2>&1 &
RUN_PID=$!
echo pid of test server is $RUN_PID
echo logging to tests/pdifftests/log.txt
sel update -o tests/pdifftests/images $@ tests/pdifftests
kill $RUN_PID
