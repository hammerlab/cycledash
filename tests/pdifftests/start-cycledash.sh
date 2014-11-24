#!/bin/bash
# Start a CycleDash server pointing at the dpxdt test DB.
# Run this after running create-test-db.sh and "gulp prod"
set -o errexit

source tests/pdifftests/ENV.sh
python ./run.py
