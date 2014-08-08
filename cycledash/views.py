# -*- coding: utf-8 -*-
import datetime
import json
import os

from flask import request, redirect, Response, render_template, jsonify, url_for

from cycledash import app, db
from cycledash.models import Run, Concordance
import cycledash.plaintext as plaintext

import workers.concordance
import workers.scorer



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
        run = Run(variant_caller_name=data.get('name'),
                  dataset=data.get('dataset'),
                  vcf_path=data.get('vcf_path'),
                  truth_vcf_path=data.get('truth_vcf_path'),
                  tumor_path=data.get('tumor_path'),
                  normal_path=data.get('normal_path'),
                  reference_path=data.get('reference_path'),
                  notes=data.get('notes'))
        db.session.add(run)
        db.session.commit()
        if data.get('truth_vcf_path'):
            workers.scorer.score.delay(run.id,
                                       data.get('vcf_path'),
                                       data.get('truth_vcf_path'))
        return redirect(url_for('runs'))
    elif request.method == 'GET':
        runs = [(run.to_camel_dict(), _additional_info(run.to_camel_dict()))
                for run in Run.query.all()]
        if 'text/html' in request.accept_mimetypes:
            return render_template('runs.html', runs=runs)
        elif 'application/json' in request.accept_mimetypes:
            return jsonify({'runs': [run[0] for run in runs]})


@app.route('/runs/<run_id>/examine')
def examine(run_id):
    run = Run.query.get(run_id)
    return render_template('examine.html', run=run.to_camel_dict())


@app.route('/runs/<run_ids_key>/concordance', methods=['GET', 'PUT'])
def concordance(run_ids_key):
    # TODO(ihodes): validation.
    runs = map(int, run_ids_key.split(','))
    runs.sort()
    run_ids_key = ','.join(map(str, runs))
    if request.method == 'PUT':
        concordance = Concordance.query.filter_by(run_ids_key=run_ids_key).first()
        print request.form
        if not concordance or not request.form.get('concordance_json'):
            # TODO(ihodes): handle error properly
            raise KeyError
        else:
            concordance.concordance_json = request.form.get('concordance_json')
            concordance.state = 'complete'
            db.session.add(concordance)
            db.session.commit()
        return redirect(url_for('concordance'), run_ids_key=run_ids_key)
    if request.method == 'GET':
        concordance = Concordance.query.filter_by(run_ids_key=run_ids_key).first()
        if not concordance:
            concordance = Concordance(run_ids_key=run_ids_key)
            db.session.add(concordance)
            db.session.commit()
            workers.concordance.concordance.delay(run_ids_key)

        print request.accept_mimetypes
        if 'text/html' in request.accept_mimetypes:
            concordance_json = None
            if concordance:
                concordance_json = concordance.concordance_json
            return render_template('concordance.html',
                                   concordance_json=concordance_json,
                                   run_ids_key=run_ids_key)
        else: # then 'application/json' in request.accept_mimetypes:
            return jsonify(concordance.to_camel_dict())


@app.route('/runs/<run_id>', methods=['GET', 'PUT', 'DELETE'])
def run(run_id):
    run = Run.query.get(run_id)
    if request.method == 'PUT':
        data = request.json or request.form
        run.precision = data.get('precision')
        run.recall = data.get('recall')
        run.f1score = data.get('f1score')
        run.true_positive = data.get('truePositive')
        run.false_positive = data.get('falsePositive')
        db.session.commit()
    if request.method == 'DELETE':
        db.session.delete(run)
        db.session.commit()
    return jsonify(run.to_camel_dict())


@app.route('/callers')
def callers():
    callers = db.engine.execute("""
SELECT variant_caller_name, f1score, precision, recall, count(*) AS num_runs
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
