#!/bin/bash
# Run both the Python & JS tests.
set -o errexit

cat -n /home/travis/build/hammerlab/cycledash/cycledash/static/lib/react/lib/ReactCompositeComponent.js

. ./ENV.sh
nosetests

npm test
