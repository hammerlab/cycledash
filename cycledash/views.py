# pylint: disable=no-value-for-parameter
"""Defines all views for CycleDash."""
import json
import tempfile

from flask import request, render_template, jsonify, send_file
from sqlalchemy import select, desc

from common.relational_vcf import genotypes_to_file
from common.helpers import tables

from cycledash import app, db, api
from cycledash.helpers import error_response, get_secure_unique_filename, camelcase_dict
import cycledash.genotypes
import cycledash.comments
import cycledash.runs
import cycledash.tasks
import cycledash.bams
import cycledash.projects
from workers.shared import worker


######################
# Cycledash JSON API #
######################

# All paths prefixed with /api/ (cf. __init__.py)
api.add_resource(cycledash.runs.RunList, '/runs',
                 endpoint='api:runlist')
api.add_resource(cycledash.runs.Run, '/runs/<int:run_id>',
                 endpoint='api:run')

api.add_resource(cycledash.projects.ProjectList, '/projects',
                 endpoint='api:projectlist')
api.add_resource(cycledash.projects.Project, '/projects/<int:project_id>',
                 endpoint='api:project')

api.add_resource(cycledash.bams.BamList, '/bams',
                 endpoint='api:bamlist')
api.add_resource(cycledash.bams.Bam, '/bams/<int:bam_id>',
                 endpoint='api:bam')

api.add_resource(cycledash.tasks.TaskList,
                 '/runs/<int:run_id>/tasks',
                 endpoint='api:tasks')
api.add_resource(cycledash.tasks.TasksRestart,
                 '/runs/<int:run_id>/tasks/restart',
                 endpoint='api:tasksrestart')

api.add_resource(cycledash.comments.CommentList,
                 '/runs/<int:run_id>/comments',
                 endpoint='api:commentlist')
api.add_resource(cycledash.comments.Comment,
                 '/runs/<int:run_id>/comments/<int:comment_id>',
                 endpoint='api:comment')
api.add_resource(cycledash.comments.CommentsForVcf,
                 '/runs/<int:run_id>/comments/byrow',
                 endpoint='api:commentsforvcf')

api.add_resource(cycledash.genotypes.Genotypes,
                 '/runs/<int:run_id>/genotypes',
                 endpoint='api:genotypes')


##############
# HTML Views #
##############

@app.route('/')
def home():
    project_trees = cycledash.projects.get_projects_tree()
    comments = cycledash.comments.get_last_comments(n=5)
    return render_template('runs.html', last_comments=comments,
                           project_trees=project_trees)

@app.route('/about')
def about():
    return render_template('about.html')

@app.route('/runs/<int:run_id>/tasks')
def tasks(run_id):
    with tables(db.engine, 'task_states') as (con, tasks):
        tasks = select([tasks.c.task_id, tasks.c.type, tasks.c.state]).where(
            tasks.c.vcf_id == run_id)
        tasks = [{'type': cycledash.tasks._simplify_type(typ),
                  'state': state,
                  # pylint: disable=too-many-function-args
                  'traceback': worker.AsyncResult(task_id).traceback}
                 for task_id, typ, state in tasks.execute().fetchall()]
    return render_template('tasks.html', tasks=tasks)

@app.route('/runs/<int:run_id>/examine')
def examine(run_id):
    with tables(db.engine, 'vcfs', 'bams') as (con, runs, bams):
        q = select(runs.c).where(runs.c.id == run_id)
        run = q.execute().fetchone()
        if not run:
            return error_response('Invalid run', 'Invalid run: %s' % run_id)
        else:
            run = dict(run)
            run['spec'] = cycledash.genotypes.spec(run_id)
            run['contigs'] = cycledash.genotypes.contigs(run_id)
            # Ideally we could use e.g. cycledash.bams.Bam.get(bam_id)
            for bam_type in ['normal', 'tumor']:
                bam_id = run[bam_type + '_bam_id']
                bam = bams.select(bams.c.id == bam_id).execute().fetchone()
                if bam:
                    run[bam_type + '_bam'] = dict(bam)
                    del run[bam_type + '_bam_id']
    return render_template('examine.html',
                           vcf=run,
                           vcfs=cycledash.runs.get_related_vcfs(run))

@app.route('/comments')
def comments():
    with tables(db.engine, 'user_comments') as (con, comments):
        comments = comments.select().order_by(desc(comments.c.id))
        comments = [camelcase_dict(dict(c))
                    for c in comments.execute().fetchall()]
        comments = cycledash.comments.epochify_comments(comments)
    return render_template('comments.html', comments=comments)


##########################
## VCFs Upload/Download ##
##########################

VCF_FILENAME = 'cycledash-run-{}.vcf'

@app.route('/runs/<int:run_id>/download')
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
