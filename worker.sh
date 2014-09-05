#!/bin/bash

set -e

source ./ENV

celery --loglevel=info \
    -A workers.shared \
    -I workers.concordance,workers.scorer \
    worker \
    -n worker.$1
