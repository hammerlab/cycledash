#!/bin/bash
# Start a CycleDash server pointing at the dpxdt test DB.
# Run this after running create-test-db.sh and "gulp prod"
# See tests/pdifftests/README.md for details.
set -o errexit

source tests/ENV.sh
python ./run.py
