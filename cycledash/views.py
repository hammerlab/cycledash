"""Defines all views for CycleDash."""
import collections
import json
import os

from celery import chain
from flask import (request, redirect, Response, render_template, jsonify,
                   url_for, abort)
import requests
from werkzeug.utils import secure_filename

from cycledash import app, db
import cycledash.genotypes as gt
from cycledash.helpers import prepare_request_data, update_object, make_error_response
from cycledash.validations import UpdateRunSchema, CreateRunSchema

import workers.indexer
from workers.genotype_extractor import extract as extract_genotype
from workers.gene_annotator import annotate as annotate_genes

WEBHDFS_ENDPOINT = app.config['WEBHDFS_URL'] + '/webhdfs/v1/'
WEBHDFS_OPEN_OP = '?user.name={}&op=OPEN'.format(app.config['WEBHDFS_USER'])

RUN_ADDL_KVS = {'Tumor BAM': 'tumor_bam_uri',
                'Normal BAM': 'normal_bam_uri',
                'VCF URI': 'uri',
                'Notes': 'notes'}


@app.route('/about')
def about():
    return render_template('about.html')


def start_workers_for_run(run):
    def index_bai(bam_path):
        workers.indexer.index.delay(bam_path[1:])
    if run.get('normal_path'):
        index_bai(run['normal_path'])
    if run.get('tumor_path'):
        index_bai(run['tumor_path'])

    # Run the genotype extractor, and then run the gene annotator with its
    # vcf_id set to the result of the extractor
    chain(extract_genotype.s(json.dumps(run)), annotate_genes.s()).delay()


@app.route('/', methods=['POST', 'GET'])
@app.route('/runs', methods=['POST', 'GET'])
def runs():
    if request.method == 'POST':
        try:
            data = CreateRunSchema(prepare_request_data(request))
        except Exception as e:
            return make_error_response('Run validation', str(e))
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


@app.route('/runs/<run_id>/examine')
def examine(run_id):
    with db.engine.connect() as con:
        select_vcf_sql = 'select * from vcfs where id = {};'.format(run_id)
        vcf = dict(con.execute(select_vcf_sql).fetchall()[0])
    run = dict(vcf)
    run['spec'] = gt.spec(run_id)
    run['contigs'] = gt.contigs(run_id)
    return render_template('examine.html', run=run)


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


# Write the user-uploaded file to a temporary directory and return the path to it.
@app.route('/upload', methods=['POST'])
def upload():
    f = request.files['file']
    if not f:
        return make_error_response('Missing file', 'Must post a file to /upload')
    if not f.filename.endswith('.vcf'):
        return make_error_response('Invalid extension', 'File must end with .vcf')

    dest_filename = secure_filename(f.filename)
    tmp_dir = app.config['TEMPORARY_DIR'] or '/tmp'
    dest_path = os.path.join(tmp_dir, dest_filename)
    f.save(dest_path)
    
    return 'file://' + dest_path
