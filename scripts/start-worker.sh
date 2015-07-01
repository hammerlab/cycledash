#!/bin/bash
# Starts celery workers using the current environment variables.

celery --loglevel=info \
    -A workers.shared \
    -I workers.indexer,workers.genotype_extractor,workers.varcode_annotator \
    worker \
    -n worker.$1
