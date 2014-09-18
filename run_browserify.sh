#!/bin/bash
browserify cycledash/static/js/examine/*.js \
  -o cycledash/static/js/examine/bundled.js \
  --transform reactify \
  --debug
