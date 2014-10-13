#!/bin/bash
export PORT=5001
export DATABASE_URL='sqlite:///../pdifftests/test.db'
export WEBHDFS_USER=testing
export WEBHDFS_URL='http://example.com'
export IGV_HTTPFS_URL='http://example.com'
export ALLOW_LOCAL_VCFS=true
python ./run.py
