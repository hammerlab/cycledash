#!/bin/bash
# These are large files which aren't tracked in version control.
# Contact your friendly local CycleDash developer if you'd like a copy.
export RUN_VCF=__tests__/data/run40k.vcf
export TRUTH_VCF=__tests__/data/truth40k.vcf

jest __tests__/ExaminePage-perf.js
