#!/bin/bash
# Starts celery workers using the current environment variables.

celery --loglevel=info \
    -A workers.shared \
    -I workers.concordance,workers.scorer,workers.indexer,workers.genotype_extractor \
    worker \
    -n worker.$1
