import datetime
import json
import os

from flask import request, Response

from cycledash import app, db
from cycledash.models import Run



def plaintext(string):
    return Response(string, mimetype='text/plain')


@app.route('/')
def home():
    return """<html><pre>
~~~~~~~~~~~~~~~~~~~~~~~~~
| Welcome to CycleDash. |
~~~~~~~~~~~~~~~~~~~~~~~~~

We use JSON. Recommend using httpie[1] to interface with this from the CLI.

You may be looking for...

POST    /runs                       -- submit a new run to cycledash [<a href="/format">format spec.</a>]
GET     <a href="/runs">/runs</a>                       -- list all runs
GET     <a href="/runs/1,2,3">/runs/&lt;run_id&gt;(,&lt;run_id&gt;)*</a>  -- display concordance of given runs [TODO]
GET     <a href="/run/1">/run/&lt;run_id&gt;</a>               -- return a particular run

-------- __@      __@       __@       __@      __~@
----- _`\<,_    _`\<,_    _`\<,_     _`\<,_    _`\<,_
---- (*)/ (*)  (*)/ (*)  (*)/ (*)  (*)/ (*)  (*)/ (*)
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

[1]: http://httpie.org
"""


@app.route('/runs', methods=['POST', 'GET'])
def runs():
    if request.method == 'POST':
        data = request.json
        print(data)
        run = Run(data.get('name'), data.get('sha1'),
                  data.get('f1score'), data.get('precision'), data.get('recall'))
        db.session.add(run)
        db.session.commit()
        return plaintext(json.dumps(run.json(), indent=4))
    elif request.method == 'GET':
        runs = [run.json() for run in Run.query.all()]
        return plaintext(json.dumps({'runs': runs}, indent=4))

@app.route('/runs/<run_ids>')
def concordance(run_ids):
    return u"Concordance: ▂▁▄▃▆▅█▇"

@app.route('/format')
def format():
    return plaintext("""
{
  "name": "name of the variant caller",
  "sha1": "hash of git commit for this run",
  "f1score": 0.xxx,
  "precision": 0.xxx,
  "recall": 0.xxx,
}
""")

@app.route('/run/<run_id>')
def run(run_id):
    return plaintext(json.dumps(Run.query.get(run_id).json(), indent=4))
