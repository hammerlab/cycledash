#!/bin/bash

set -o errexit

source ./ENV.sh

celery --loglevel=info \
    -A workers.shared \
    -I workers.concordance,workers.scorer \
    worker \
    -n worker.$1
