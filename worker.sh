#!/bin/bash

set -o errexit

source ./ENV.sh

celery --loglevel=info \
    -A workers.shared \
    -I workers.concordance,workers.scorer,workers.indexer \
    worker \
    -n worker.$1
