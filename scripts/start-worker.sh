#!/bin/bash
# Starts celery workers using the current environment variables.

celery --loglevel=info \
    -A workers.shared \
    -I workers.indexer,workers.genotype_extractor,workers.gene_annotator \
    worker \
    -n worker.$1
