"""Defines all views for CycleDash."""
import collections
import json
import requests
import tempfile

from celery import chain
from flask import (request, redirect, Response, render_template, jsonify,
                   url_for, send_file)
import sqlalchemy as sql

from cycledash import app, db
import cycledash.genotypes as gt
from cycledash.helpers import (prepare_request_data, make_error_response,
                               get_secure_unique_filename)
from cycledash.validations import CreateRunSchema

from common.relational_vcf import genotypes_to_file
from common.helpers import tables

import workers.indexer
from workers.genotype_extractor import extract as extract_genotype
from workers.gene_annotator import annotate as annotate_genes


WEBHDFS_ENDPOINT = app.config['WEBHDFS_URL'] + '/webhdfs/v1/'
WEBHDFS_OPEN_OP = '?user.name={}&op=OPEN'.format(app.config['WEBHDFS_USER'])

RUN_ADDL_KVS = {'Tumor BAM': 'tumor_bam_uri',
                'Normal BAM': 'normal_bam_uri',
                'VCF URI': 'uri',
                'Notes': 'notes'}

VCF_FILENAME = 'cycledash-run-{}.vcf'


@app.route('/about')
def about():
    return render_template('about.html')


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
        with tables(db, 'vcfs') as (con, vcfs):
            q = sql.select(vcfs.c).order_by(sql.desc(vcfs.c.id))
            vcfs = [dict(v) for v in con.execute(q).fetchall()]
        if 'text/html' in request.accept_mimetypes:
            return render_template('runs.html', runs=vcfs, run_kvs=RUN_ADDL_KVS)
        elif 'application/json' in request.accept_mimetypes:
            return jsonify({'runs': vcfs})


@app.route('/runs/<run_id>/genotypes')
def genotypes(run_id):
    return jsonify(gt.get(run_id, json.loads(request.args.get('q'))))


@app.route('/runs/<run_id>/download')
def download_vcf(run_id):
    query = json.loads(request.args.get('query'))
    genotypes = gt.genotypes_for_records(run_id, query)
    fd = tempfile.NamedTemporaryFile(mode='w+b')
    with tables(db, 'vcfs') as (con, vcfs):
        q = sql.select(
            [vcfs.c.extant_columns, vcfs.c.vcf_header]
        ).where(vcfs.c.id == run_id)
        (extant_columns, vcf_header) = con.execute(q).fetchone()
    extant_columns = json.loads(extant_columns)
    genotypes_to_file(genotypes, vcf_header, extant_columns, fd)
    filename = VCF_FILENAME.format(run_id)
    return send_file(fd, as_attachment=True, attachment_filename=filename)


@app.route('/runs/<run_id>/examine')
def examine(run_id):
    with tables(db, 'vcfs') as (con, vcfs):
        q = sql.select(vcfs.c).where(vcfs.c.id == run_id)
        run = dict(con.execute(q).fetchone())
    run['spec'] = gt.spec(run_id)
    run['contigs'] = gt.contigs(run_id)
    return render_template('examine.html', run=run)


# Path must not start with a '/'.
# Flask seems to have some trouble dealing with forward-slashes in URLs.
# (It is added on automatically when requesting a HDFS file).
@app.route('/vcf/<path:vcf_path>')
def hdfs_vcf(vcf_path):
    # We only load test data that we mean to load locally:
    if app.config['ALLOW_LOCAL_VCFS'] and vcf_path.startswith('tests/'):
        vcf_text = open(vcf_path).read()
    else:
        url = WEBHDFS_ENDPOINT + vcf_path + WEBHDFS_OPEN_OP
        vcf_text = requests.get(url).text
    return Response(vcf_text, mimetype='text/plain')


@app.route('/upload', methods=['POST'])
def upload():
    """Write the user-uploaded file to a temporary directory and return the path
    to it.
    """
    f = request.files['file']
    if not f:
        return make_error_response('Missing file', 'Must post a file to /upload')
    if not f.filename.endswith('.vcf'):
        return make_error_response('Invalid extension', 'File must end with .vcf')

    tmp_dir = app.config['TEMPORARY_DIR']
    dest_path = get_secure_unique_filename(f.filename, tmp_dir)
    f.save(dest_path)
    return 'file://' + dest_path


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
