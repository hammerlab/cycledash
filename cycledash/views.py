# -*- coding: utf-8 -*-
import datetime
import json
import os

from flask import request, Response, render_template

from cycledash import app, db
from cycledash.models import Run
import cycledash.utils as utils



@app.route('/')
def home():
    return utils.plaintext("""
~~~~~~~~~~~~~~~~~~~~~~~~~
| Welcome to CycleDash. |
~~~~~~~~~~~~~~~~~~~~~~~~~

We use JSON. Recommend using httpie[1] to interface with this from the CLI.

You may be looking for...

POST    /runs                       -- submit a new run to cycledash
                                       c.f. /docs/format
GET     /runs/submit                -- display form to submit a run
GET     /runs                       -- list all runs
GET     /runs/<run_id>              -- return a particular run
GET     /runs/<run_id>(,<run_id>)*  -- display concordance of given runs [TODO]
GET     /callers                    -- list all callers and latest scores
GET     /callers/<caller_name>      -- display runs for and a graph of scores
                                       for runs of a given caller

-------- __@      __@       __@       __@      __~@
----- _`\<,_    _`\<,_    _`\<,_     _`\<,_    _`\<,_
---- (*)/ (*)  (*)/ (*)  (*)/ (*)  (*)/ (*)  (*)/ (*)
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

[1]: http://httpie.org
""")


@app.route('/docs/format')
def format():
    return utils.plaintext("""
POST to /runs a JSON object of the below format:

    {
      "name": "name of the variant caller",
      "sha1": "hash of git commit for this run",
      "f1score": 0.xxx,
      "precision": 0.xxx,
      "recall": 0.xxx,
    }

NOTE: Be careful that 'name' is constant between submissions for the same
caller, otherwise data will not be aggregated correctly.
""")


@app.route('/runs', methods=['POST', 'GET'])
def runs():
    if request.method == 'POST':
        data = request.json or request.form
        print data
        # TODO(ihodes): validation
        run = Run(data.get('name'), data.get('sha1'),
                  float(data.get('f1score')),
                  float(data.get('precision')),
                  float(data.get('recall')))
        db.session.add(run)
        db.session.commit()
        return utils.json(json.dumps(run.json(), indent=4))
    elif request.method == 'GET':
        runs = [run.json() for run in Run.query.all()]
        return utils.json(json.dumps({'runs': runs}, indent=4))


@app.route('/runs/<run_id>')
def run(run_id):
    run = Run.query.get(run_id).json()
    return utils.json(json.dumps(run, indent=4))


@app.route('/runs/submit')
def submit_run():
    return render_template('submit_run.html')


@app.route('/callers')
def callers():
    callers = db.engine.execute("""
SELECT variant_caller_name, f1score, precision, recall
FROM run
GROUP BY variant_caller_name
ORDER BY submitted_at ASC
""").fetchall()
    return render_template('callers.html', callers=callers)


@app.route('/callers/<caller_name>')
def trends(caller_name):
    runs = Run.query.filter_by(variant_caller_name=caller_name)
    runs = runs.order_by(Run.submitted_at.desc())
    runs = [run.json() for run in runs]
    return render_template('trend.html', runs=runs, caller_name=caller_name)
