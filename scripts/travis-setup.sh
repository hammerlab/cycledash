#!/bin/bash
# Install all deps & build everything for the Python & JS tests.
set -o errexit

pip install -r <(grep -v 'pysam' requirements.txt)
npm install
make initenv

gulp prod
