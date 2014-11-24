#!/bin/bash

set -o errexit

source ./ENV.sh
./scripts/start-worker.sh $@
