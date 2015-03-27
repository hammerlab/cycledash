# pylint: disable=no-value-for-parameter
"""Defines all views for CycleDash."""
import json
import tempfile

from flask import (request, redirect, Response, render_template, jsonify,
                   url_for, send_file)
from sqlalchemy import select, desc, func
import voluptuous

from common.relational_vcf import genotypes_to_file
from common.helpers import tables

from cycledash import app, db
from cycledash.helpers import (prepare_request_data, error_response,
                               success_response, get_secure_unique_filename,
                               request_wants_json)
import cycledash.genotypes
import cycledash.comments
import cycledash.runs
import cycledash.tasks
import cycledash.bams
import cycledash.projects


  ###########
 ## About ##
###########

@app.route('/about')
def about():
    return render_template('about.html')


  ##########
 ## Runs ##
##########

@app.route('/', methods=['POST', 'GET'])
@app.route('/runs', methods=['POST', 'GET'])
def list_runs():
    if request.method == 'POST':
        return cycledash.runs.create_vcf()
    elif request.method == 'GET':
        return cycledash.projects.get_projects_tree()


@app.route('/tasks/<vcf_id>', methods=['GET', 'DELETE'])
def get_tasks(vcf_id):
    if request.method == 'GET':
        tasks = cycledash.tasks.get_tasks(vcf_id)
        if request_wants_json():
            return jsonify({'tasks': tasks})
        else:
            return render_template('tasks.html', tasks=tasks)
    elif request.method == 'DELETE':
        cycledash.tasks.delete_tasks(vcf_id)
        return success_response()


  ##############
 ## Projects ##
##############

@app.route('/projects', methods=['POST', 'GET'])
def projects():
    if request.method == 'POST':
        return cycledash.projects.create_project()
    elif request.method == 'GET':
        return cycledash.projects.get_projects()


@app.route('/projects/<project_id>', methods=['PUT', 'GET', 'DELETE'])
def project(project_id):
    if request.method == 'PUT':
        return cycledash.projects.update_project(project_id)
    elif request.method == 'GET':
        return cycledash.projects.get_project(project_id)
    elif request.method == 'DELETE':
        return cycledash.projects.delete_project(project_id)


  ##########
 ## BAMs ##
##########

@app.route('/bams', methods=['POST', 'GET'])
def bams():
    if request.method == 'POST':
        return cycledash.bams.create_bam()
    elif request.method == 'GET':
        return cycledash.bams.get_bams()


@app.route('/bams/<bam_id>', methods=['PUT', 'GET', 'DELETE'])
def bam(bam_id):
    if request.method == 'PUT':
        return cycledash.bams.update_bam(bam_id)
    elif request.method == 'GET':
        return cycledash.bams.get_bam(bam_id)
    elif request.method == 'DELETE':
        return cycledash.bams.delete_bam(bam_id)


  #############
 ## Examine ##
#############

@app.route('/runs/<run_id>/examine')
def examine(run_id):
    vcf = cycledash.runs.get_vcf(run_id)
    return render_template('examine.html',
                           vcf=vcf,
                           vcfs=cycledash.runs.get_related_vcfs(vcf))


@app.route('/runs/<run_id>/genotypes')
def genotypes(run_id):
    gts = cycledash.genotypes.get(run_id, json.loads(request.args.get('q')))
    return jsonify(gts)


  ##############
 ## Comments ##
##############

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


  ##########################
 ## VCFs Upload/Download ##
##########################

VCF_FILENAME = 'cycledash-run-{}.vcf'

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
