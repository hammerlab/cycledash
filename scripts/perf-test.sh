#!/bin/bash
# These are large files which aren't tracked in version control.
# Contact your friendly local CycleDash developer if you'd like a copy.
if [[ $# -ne 2 ]]; then
  >&2 echo "Usage: $0 path/to/run.vcf path/to/truth.vcf"
  exit 1
fi

export RUN_VCF=$1
export TRUTH_VCF=$2

mocha --compilers .:__tests__/js/preprocessor.js __tests__/js/ExaminePage-perf-test.js
