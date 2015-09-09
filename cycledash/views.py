# pylint: disable=no-value-for-parameter
"""Defines all views for CycleDash."""
import json
import tempfile
from flask import request, redirect, render_template, send_file, Response
from flask.ext.login import login_required
from sqlalchemy import select, desc, exc
import voluptuous

from common.relational_vcf import genotypes_to_file
from common.helpers import tables
from cycledash import app, db, api, login_manager, bcrypt
import cycledash.auth as auth
from cycledash.helpers import (error_response, get_secure_unique_filename,
                               camelcase_dict, prepare_request_data)
import cycledash.api
from workers.shared import worker
from validations import RegisterUser, LoginUser


######################
# Cycledash JSON API #
######################

# All paths prefixed with /api/ (cf. __init__.py)
api.add_resource(cycledash.api.runs.RunList, '/runs',
                 endpoint='api:runlist')
api.add_resource(cycledash.api.runs.Run, '/runs/<int:run_id>',
                 endpoint='api:run')

api.add_resource(cycledash.api.projects.ProjectList, '/projects',
                 endpoint='api:projectlist')
api.add_resource(cycledash.api.projects.Project, '/projects/<int:project_id>',
                 endpoint='api:project')

api.add_resource(cycledash.api.bams.BamList, '/bams',
                 endpoint='api:bamlist')
api.add_resource(cycledash.api.bams.Bam, '/bams/<int:bam_id>',
                 endpoint='api:bam')

api.add_resource(cycledash.api.tasks.TaskList,
                 '/runs/<int:run_id>/tasks',
                 endpoint='api:tasks')
api.add_resource(cycledash.api.tasks.TasksRestart,
                 '/runs/<int:run_id>/tasks/restart',
                 endpoint='api:tasksrestart')

api.add_resource(cycledash.api.comments.CommentList,
                 '/runs/<int:run_id>/comments',
                 endpoint='api:commentlist')
api.add_resource(cycledash.api.comments.Comment,
                 '/runs/<int:run_id>/comments/<int:comment_id>',
                 endpoint='api:comment')
api.add_resource(cycledash.api.comments.CommentsForVcf,
                 '/runs/<int:run_id>/comments/byrow',
                 endpoint='api:commentsforvcf')

api.add_resource(cycledash.api.genotypes.Genotypes,
                 '/runs/<int:run_id>/genotypes',
                 endpoint='api:genotypes')


#############################
# (subset of the) GA4GH API #
#############################
ga4gh_backend = cycledash.api.ga4gh_wrapper.DirectBamBackend(app.config['GA4GH_ROOT'])

@app.route('/ga4gh/reads/search', methods=['POST'])
def searchReads():
    endpoint = ga4gh_backend.runSearchReads
    responseStr = endpoint(request.get_data())
    return Response(responseStr, status=200, mimetype='application/json')


##############
# HTML Views #
##############

@app.route('/login', methods=['GET', 'POST'])
def login():
    if request.method == 'GET':
        return render_template('login.html')
    else:
        return auth.login()


@app.route('/logout', methods=['POST'])
def logout():
    auth.logout()
    return redirect('about')


@app.route('/register', methods=['GET', 'POST'])
def register_user():
    if request.method == 'GET':
        return render_template('register.html')
    else:
        return auth.register()


@app.route('/')
@login_required
def home():
    project_trees = cycledash.api.projects.get_projects_tree()
    comments = cycledash.api.comments.get_last_comments(n=5)
    return render_template('runs.html', last_comments=comments,
                           project_trees=project_trees)


@app.route('/about')
def about():
    return render_template('about.html')


@app.route('/runs/<int:run_id>/tasks')
@login_required
def tasks(run_id):
    with tables(db.engine, 'task_states') as (con, tasks):
        tasks = select([tasks.c.task_id, tasks.c.type, tasks.c.state]).where(
            tasks.c.vcf_id == run_id)
        tasks = [{'type': cycledash.api.tasks._simplify_type(typ),
                  'state': state,
                  # pylint: disable=too-many-function-args
                  'traceback': worker.AsyncResult(task_id).traceback}
                 for task_id, typ, state in tasks.execute().fetchall()]
    return render_template('tasks.html', tasks=tasks, run_id=run_id)


@app.route('/runs/<int:run_id>/examine')
@login_required
def examine(run_id):
    with tables(db.engine, 'vcfs', 'bams') as (con, runs, bams):
        q = select(runs.c).where(runs.c.id == run_id)
        run = q.execute().fetchone()
        if not run:
            return error_response('Invalid run', 'Invalid run: %s' % run_id)
        else:
            run = dict(run)
            run['spec'] = cycledash.api.genotypes.spec(run_id)
            run['contigs'] = cycledash.api.genotypes.contigs(run_id)
            # Ideally we could use e.g. cycledash.bams.Bam.get(bam_id)
            for bam_type in ['normal', 'tumor']:
                bam_id = run[bam_type + '_bam_id']
                bam = bams.select(bams.c.id == bam_id).execute().fetchone()
                if bam:
                    run[bam_type + '_bam'] = dict(bam)
                    del run[bam_type + '_bam_id']
    return render_template('examine.html',
                           vcf=run,
                           vcfs=cycledash.api.runs.get_related_vcfs(run))


@app.route('/comments')
@login_required
def comments():
    with tables(db.engine, 'user_comments') as (con, comments):
        comments = comments.select().order_by(desc(comments.c.id))
        comments = [camelcase_dict(dict(c))
                    for c in comments.execute().fetchall()]
        comments = cycledash.api.comments.epochify_comments(comments)
    return render_template('comments.html', comments=comments)


##########################
## VCFs Upload/Download ##
##########################

VCF_FILENAME = 'cycledash-run-{}.vcf'

@app.route('/runs/<int:run_id>/download')
@login_required
def download_vcf(run_id):
    query = json.loads(request.args.get('query'))
    genotypes = cycledash.api.genotypes.genotypes_for_records(run_id, query)
    fd = tempfile.NamedTemporaryFile(mode='w+b')
    with tables(db.engine, 'vcfs') as (con, vcfs):
        q = select(
            [vcfs.c.extant_columns, vcfs.c.vcf_header]
        ).where(vcfs.c.id == run_id)
        extant_columns, vcf_header = con.execute(q).fetchone()
    extant_columns = json.loads(extant_columns)
    genotypes_to_file(genotypes, vcf_header, extant_columns, fd)
    filename = VCF_FILENAME.format(run_id)
    return send_file(fd, as_attachment=True, attachment_filename=filename)


@app.route('/upload', methods=['POST'])
@login_required
def upload_vcf():
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
