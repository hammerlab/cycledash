# -*- coding: utf-8 -*-
import datetime
import json
import os

from flask import request, Response, render_template, jsonify

from cycledash import app, db
from cycledash.models import Run
import cycledash.plaintext as plaintext



@app.route('/')
def home():
    if 'text/html' in request.accept_mimetypes:
        return render_template('home.html')
    else:
        return Response(plaintext.HOME_TEXT, mimetype='text/plain')


@app.route('/docs/format')
def format_doc():
    return Response(plaintext.FORMAT_TEXT, mimetype='text/plain')


@app.route('/runs', methods=['POST', 'GET'])
def runs():
    if request.method == 'POST':
        data = request.json or request.form
        # TODO(ihodes): Validation.
        run = Run(data.get('name'), data.get('sha1'),
                  float(data.get('f1score')),
                  float(data.get('precision')),
                  float(data.get('recall')),
                  dataset=data.get('dataset'))
        db.session.add(run)
        db.session.commit()
        return jsonify(run.to_camel_dict(), indent=4)
    elif request.method == 'GET':
        runs = [(run.to_camel_dict(), _additional_info(run.to_camel_dict()))
                for run in Run.query.all()]
        if 'text/html' in request.accept_mimetypes:
            return render_template('runs.html', runs=runs)
        elif 'application/json' in request.accept_mimetypes:
            return jsonify({'runs': [run[0] for run in runs]})


@app.route('/runs/<run_id>')
def run(run_id):
    run = Run.query.get(run_id).to_camel_dict()
    return jsonify(run)


@app.route('/callers')
def callers():
    callers = db.engine.execute("""
SELECT variant_caller_name, f1score, precision, recall, count(*) as num_runs
FROM run
GROUP BY variant_caller_name
ORDER BY submitted_at ASC
""")
    callers = callers.fetchall()
    if 'text/html' in request.accept_mimetypes:
        return render_template('callers.html', callers=callers)
    else:
        return jsonify({'callers':
                        [{'variantCallerName': caller.variant_caller_name,
                          'f1score': caller.f1score,
                          'precision': caller.precision,
                          'recall': caller.recall,
                          'numRuns': caller.num_runs}
                         for caller in callers]})


@app.route('/callers/<caller_name>')
def trends(caller_name):
    runs = Run.query.filter_by(variant_caller_name=caller_name)
    runs = runs.order_by(Run.submitted_at.desc())
    runs = [run.to_camel_dict() for run in runs]
    runs_json = runs
    runs = [(run, _additional_info(run)) for run in runs]
    if 'text/html' in request.accept_mimetypes:
        return render_template('trend.html', runs_json=runs_json, runs=runs,
                               caller_name=caller_name)
    else:
        return jsonify({'runs': runs_json})


def _additional_info(run):
    addl = {'Tumor BAM': run['tumorPath'], 'Normal BAM': run['tumorPath'],
            'Reference': run['referencePath'], 'VCF': run['vcfPath'],
            'Notes': run['notes']}
    if any(addl.itervalues()):
        return addl
    else:
        return None
