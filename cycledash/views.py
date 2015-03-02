# pylint: disable=no-value-for-parameter
"""Defines all views for CycleDash.
"""
import json
import tempfile

from flask import (request, redirect, Response, render_template, jsonify,
                   url_for, send_file)

from sqlalchemy import select, desc, func

from cycledash import app, db
from cycledash.helpers import (prepare_request_data, error_response,
                               success_response, get_secure_unique_filename)
import cycledash.validations as valid
import cycledash.genotypes
import cycledash.comments
import cycledash.runs

from common.relational_vcf import genotypes_to_file
from common.helpers import tables

import workers.runner


WEBHDFS_ENDPOINT = app.config['WEBHDFS_URL'] + '/webhdfs/v1/'
WEBHDFS_OPEN_OP = '?user.name={}&op=OPEN'.format(app.config['WEBHDFS_USER'])

RUN_ADDL_KVS = {'Tumor BAM': 'tumor_bam_uri',
                'Normal BAM': 'normal_bam_uri',
                'VCF URI': 'uri',
                'Notes': 'notes',
                'Project': 'project_name'}

VCF_FILENAME = 'cycledash-run-{}.vcf'


@app.route('/about')
def about():
    return render_template('about.html')


@app.route('/', methods=['POST', 'GET'])
@app.route('/runs', methods=['POST', 'GET'])
def list_runs():
    if request.method == 'POST':
        try:
            data = valid.CreateRunSchema(prepare_request_data(request))
        except Exception as e:
            return error_response('Run validation', str(e))
        workers.runner.start_workers_for_run(data)
        return redirect(url_for('runs'))
    elif request.method == 'GET':
        vcfs, last_comments, completions = cycledash.runs.get_runs()
        if 'text/html' in request.accept_mimetypes:
            return render_template('runs.html', runs=vcfs, run_kvs=RUN_ADDL_KVS,
                                   last_comments=last_comments,
                                   completions=completions)
        elif 'application/json' in request.accept_mimetypes:
            return jsonify({'runs': vcfs})


@app.route('/runs/<run_id>/examine')
def examine(run_id):
    return render_template('examine.html', run=cycledash.runs.get_run(run_id))


@app.route('/runs/<run_id>/genotypes')
def genotypes(run_id):
    gts = cycledash.genotypes.get(run_id, json.loads(request.args.get('q')))
    return jsonify(gts)


@app.route('/comments')
def all_comments():
    return render_template('comments.html',
                           comments=cycledash.comments.get_all_comments())


@app.route('/runs/<vcf_id>/comments', methods=['GET', 'POST'])
def comments(vcf_id):
    if request.method == 'POST':
        return cycledash.comments.create_comment(vcf_id)
    elif request.method == 'GET':
        return cycledash.comments.get_vcf_comments(vcf_id)


@app.route('/runs/<run_id>/comments/<comment_id>', methods=['PUT', 'DELETE'])
def comment(run_id, comment_id):
    if request.method == 'PUT':
        return cycledash.comments.update_comment(comment_id)
    elif request.method == 'DELETE':
        return cycledash.comments.delete_comment(comment_id)


@app.route('/runs/<run_id>/download')
def download_vcf(run_id):
    query = json.loads(request.args.get('query'))
    genotypes = cycledash.genotypes.genotypes_for_records(run_id, query)
    fd = tempfile.NamedTemporaryFile(mode='w+b')
    with tables(db, 'vcfs') as (con, vcfs):
        q = select(
            [vcfs.c.extant_columns, vcfs.c.vcf_header]
        ).where(vcfs.c.id == run_id)
        extant_columns, vcf_header = con.execute(q).fetchone()
    extant_columns = json.loads(extant_columns)
    genotypes_to_file(genotypes, vcf_header, extant_columns, fd)
    filename = VCF_FILENAME.format(run_id)
    return send_file(fd, as_attachment=True, attachment_filename=filename)


@app.route('/upload', methods=['POST'])
def upload():
    """Write the uploaded file to a temporary directory and return its path."""
    f = request.files['file']
    if not f:
        return error_response('Missing file', 'Must post a file to /upload')
    if not f.filename.endswith('.vcf'):
        return error_response('Invalid extension', 'File must end with .vcf')
    tmp_dir = app.config['TEMPORARY_DIR']
    dest_path = get_secure_unique_filename(f.filename, tmp_dir)
    f.save(dest_path)
    return 'file://' + dest_path
