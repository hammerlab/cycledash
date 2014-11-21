"""Defines all views for CycleDash."""
import collections
import json

from flask import (request, redirect, Response, render_template, jsonify,
                   url_for, abort)
import requests

from cycledash import app, db
import cycledash.genotypes as gt
from cycledash.helpers import prepare_request_data, update_object
from cycledash.models import Run, Concordance
import cycledash.plaintext as plaintext
from cycledash.validations import (UpdateRunSchema, CreateRunSchema,
                                   UpdateConcordanceSchema)

import workers.concordance
import workers.scorer
import workers.indexer
import workers.genotype_extractor


WEBHDFS_ENDPOINT = app.config['WEBHDFS_URL'] + '/webhdfs/v1/'
WEBHDFS_OPEN_OP = '?user.name={}&op=OPEN'.format(app.config['WEBHDFS_USER'])

RUN_ADDL_KVS = {'Tumor BAM': 'tumor_bam_uri',
                'Normal BAM': 'normal_bam_uri',
                'VCF': 'uri',
                'Notes': 'notes'}


@app.route('/')
def home():
    if 'text/html' in request.accept_mimetypes:
        return render_template('home.html')
    else:
        return Response(plaintext.HOME_TEXT, mimetype='text/plain')


@app.route('/docs/format')
def format_doc():
    return Response(plaintext.FORMAT_TEXT, mimetype='text/plain')


def start_workers_for_run(run):
    # if run.truth_vcf_path:
    #     TODO: This is broken, as run does not have an ID at this point...
    #     workers.scorer.score.delay(run.id, run.vcf_path, run.truth_vcf_path)
    def index_bai(bam_path):
        workers.indexer.index.delay(bam_path[1:])
    if run.get('normal_path'):
        index_bai(run['normal_path'])
    if run.get('tumor_path'):
        index_bai(run['tumor_path'])
    workers.genotype_extractor.extractor.delay(json.dumps(run))


@app.route('/runs', methods=['POST', 'GET'])
def runs():
    if request.method == 'POST':
        try:
            data = CreateRunSchema(prepare_request_data(request))
        except Exception as e:
            response = jsonify({'error': 'Run validation', 'message': str(e)})
            response.status_code = 400
            return response
        start_workers_for_run(data)
        return redirect(url_for('runs'))
    elif request.method == 'GET':
        con = db.engine.connect()
        select_vcfs_sql = 'select * from vcfs order by id desc;'
        vcfs = [dict(v)
                for v in con.execute(select_vcfs_sql).fetchall()]
        con.close()
        if 'text/html' in request.accept_mimetypes:
            return render_template('runs.html', runs=vcfs, run_kvs=RUN_ADDL_KVS)
        elif 'application/json' in request.accept_mimetypes:
            return jsonify({'runs': vcfs})


@app.route('/runs/<run_id>/genotypes')
def genotypes(run_id):
    return jsonify(gt.get(run_id, json.loads(request.args.get('q'))))


@app.route('/runs/<run_id>/spec')
def examine_spec(run_id):
    return jsonify({'spec': gt.spec(run_id)})


@app.route('/runs/<run_id>/contigs')
def contigs(run_id):
    return jsonify({'contigs': gt.contigs(run_id)})


@app.route('/runs/<run_id>/examine')
def examine(run_id):
    with db.engine.connect() as con:
        select_vcf_sql = 'select * from vcfs where id = {};'.format(run_id)
        vcf = dict(con.execute(select_vcf_sql).fetchall()[0])
    return render_template('examine.html', run=dict(vcf))


@app.route('/runs/<run_ids_key>/concordance', methods=['GET', 'PUT'])
def concordance(run_ids_key):
    runs = [int(run) for run in run_ids_key.split(',')]
    runs.sort()
    run_ids_key = ','.join(str(run) for run in runs)
    concordance = Concordance.query.filter_by(run_ids_key=run_ids_key).first()
    if request.method == 'PUT':
        if not concordance:
            return abort(404)
        try:
            data = UpdateConcordanceSchema(prepare_request_data(request))
        except Exception as e:
            return jsonify({'error': 'Concordance update validation',
                            'message': str(e)})
        update_object(concordance, data)
        db.session.commit()
    elif request.method == 'GET':
        if not concordance:
            concordance = Concordance(run_ids_key=run_ids_key)
            db.session.add(concordance)
            db.session.commit()
            workers.concordance.concordance.delay(run_ids_key)

    if 'text/html' in request.accept_mimetypes:
        return render_template('concordance.html', run_ids_key=run_ids_key,
                               concordance_json=concordance.concordance_json)
    elif 'application/json' in request.accept_mimetypes:
        return jsonify(concordance.to_camel_dict())


@app.route('/runs/<run_id>', methods=['GET', 'PUT', 'DELETE'])
def run(run_id):
    run = Run.query.get_or_404(run_id)
    if request.method == 'PUT':
        try:
            data = UpdateRunSchema(prepare_request_data(request))
        except Exception as e:
            return jsonify({'error': 'Run update validation',
                            'message': str(e)})
        update_object(run, data)
        db.session.commit()
    elif request.method == 'DELETE':
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
    runs = sorted((run.to_camel_dict() for run in runs), key=lambda r: r['id'])
    if 'text/html' in request.accept_mimetypes:
        datasets = collections.defaultdict(list)
        for run in runs:
            datasets[run.get('dataset')].append(run)
        return render_template('trend.html', runs=runs,
                               dataset_runs=datasets,
                               caller_name=caller_name)
    else:
        return jsonify({'runs': runs})

# Path must not start with a '/'.
# Flask seems to have some trouble dealing with forward-slashes in URLs.
# (It is added on automatically when requesting a HDFS file).
@app.route('/vcf/<path:vcf_path>')
def hdfs_vcf(vcf_path):
    if app.config['ALLOW_LOCAL_VCFS'] and vcf_path.startswith('tests/'):
        # we only load test data that we mean to load locally
        vcf_text = open(vcf_path).read()
    else:
        url = WEBHDFS_ENDPOINT + vcf_path + WEBHDFS_OPEN_OP
        vcf_text = requests.get(url).text
    return Response(vcf_text, mimetype='text/plain')
