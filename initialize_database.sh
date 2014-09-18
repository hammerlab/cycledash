#!/bin/bash

source ENV.sh

python -c '
from cycledash import app, db

ctx = app.test_request_context()
ctx.push()
db.create_all()
'
