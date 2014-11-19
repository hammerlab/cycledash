#!/bin/bash

set -o errexit

source ./ENV.sh

celery --loglevel=info \
    -A workers.shared \
    -I workers.concordance,workers.scorer,workers.indexer,workers.genotype_extractor \
    worker \
    -n worker.$1
