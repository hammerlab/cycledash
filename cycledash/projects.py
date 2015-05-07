"""Defines the API for Projects."""
from flask import request, redirect, jsonify, url_for, render_template

from sqlalchemy import exc, select, func, desc
import voluptuous

from common.helpers import tables, find
from cycledash import db
import cycledash.tasks
import cycledash.validations
import cycledash.comments
import cycledash.bams
from cycledash.helpers import (prepare_request_data, error_response,
                               request_wants_json, get_where, get_id_where)


def get_project(project_id):
    with tables(db, 'projects') as (con, projects):
        q = select(projects.c).where(projects.c.id == project_id)
        project = con.execute(q).fetchone()
    if project:
        return jsonify(dict(project))
    else:
        msg = 'No project with id={} found'.format(project_id)
        return jsonify(error='No project found', message=msg), 404


def get_projects():
    """Return list of projects ordered by recency."""
    with tables(db, 'projects') as (con, projects):
        q = select(projects.c).order_by(desc(projects.c.id))
        return jsonify({'projects': [dict(r) for r in con.execute(q).fetchall()]})


def create_project():
    """Create a project, return the project."""
    try:
        data = cycledash.validations.CreateProject(
            prepare_request_data(request))
    except voluptuous.MultipleInvalid as e:
        errors = [str(err) for err in e.errors]
        return error_response('Project validation', errors)
    try:
        with tables(db, 'projects') as (con, projects):
            result = projects.insert(data).returning(*projects.c).execute()
            project = dict(result.fetchone())
    except Exception as e:
        return error_response('Could not create project {}'.format(data),
                              str(e))
    if request_wants_json():
        return jsonify(project), 201  # HTTP 201 Created
    elif 'text/html' in request.accept_mimetypes:
        return redirect(url_for('list_runs'))


def update_project(project_id):
    """Update the project, return the updated project."""
    try:
        data = cycledash.validations.UpdateProject(
            prepare_request_data(request))
    except voluptuous.MultipleInvalid as e:
        errors = [str(err) for err in e.errors]
        return error_response('Project validation', errors)
    try:
        with tables(db, 'projects') as (con, projects):
            result = projects.update().where(
                projects.c.id == project_id).values(
                    **data).returning(*projects.c).execute()
            project = dict(result.fetchone())
    except Exception as e:
        msg  = 'Could not update project {}'.format(project)
        return error_response(message=str(e),
                              error=msg)
    if request_wants_json():
        return jsonify(project)
    elif 'text/html' in request.accept_mimetypes:
        return redirect(url_for('list_runs'))


def delete_project(project_id):
    """Delete project and return the project, or None if no project
    was deleted.
    """
    with tables(db, 'projects') as (con, projects):
        result = projects.delete(
            projects.c.id == project_id).returning(*projects.c).execute()
    if result.rowcount > 0:
        return jsonify(dict(result.fetchone()))
    else:
        msg = 'No project with id={} found'.format(project_id)
        return jsonify(error='No project found for deletion', message=msg), 404


def set_and_verify_project_id_on(data):
    project_name = data.get('project_name')
    if project_name:
        project_id = get_id_where('projects', db, name=project_name)
        data['project_id'] = project_id
        del data['project_name']
        if project_id is None:
            raise voluptuous.Invalid('no project with name {}'.format(project_name))
    else:
        project_id = data['project_id']
        if get_where('projects', db, id=project_id) is None:
            raise voluptuous.Invalid('no project with id {}'.format(project_id))


def _get_projects_tree():
    """Return a list of all projects, with their respective vcfs and bams.

    { "projects": [
      { "name": "Project Name",
        "notes": "Some test notes"
        "vcfs": [...]
        "bams": [
          { "name": "a dataset", ... }, ...
      ]}, ...
    ]}
    """
    with tables(db, 'vcfs', 'user_comments', 'bams', 'projects') as \
         (con, vcfs, user_comments, bams, projects):
        joined = (vcfs
            .outerjoin(user_comments, vcfs.c.id == user_comments.c.vcf_id))
        num_comments = func.count(user_comments.c.vcf_id).label('num_comments')
        q = (select(vcfs.c + [num_comments])
            .select_from(joined)
            .group_by(vcfs.c.id)
            .order_by(desc(vcfs.c.id)))
        vcfs = [dict(v) for v in con.execute(q).fetchall()]

        q = select(bams.c)
        bams = [dict(b) for b in con.execute(q).fetchall()]

        q = select(projects.c)
        projects = [dict(b) for b in con.execute(q).fetchall()]

        cycledash.bams.attach_bams_to_vcfs(vcfs)

        for vcf in vcfs:
            project_id = vcf.get('project_id')

            vcf['project'] = dict(find(projects,
                                       lambda x: x.get('id') == project_id) or {})

        _join_task_states(vcfs)

        for project in projects:
            project_id = project['id']
            project_bams = [bam for bam in bams
                            if bam.get('project_id') == project_id]
            project_vcfs = [vcf for vcf in vcfs
                            if vcf.get('project_id') == project_id]
            project['bams'] = project_bams
            project['vcfs'] = project_vcfs
        return projects


def _join_task_states(vcfs):
    """Add a task_states field to each VCF in a list of VCFs."""
    ts = cycledash.tasks.all_non_success_tasks()

    for vcf in vcfs:
        vcf['task_states'] = ts.get(vcf['id'], [])


def get_projects_tree():
    if request_wants_json():
        vcfs = _get_projects_tree()
        return jsonify({'runs': vcfs})
    elif 'text/html' in request.accept_mimetypes:
        vcfs = _get_projects_tree()
        comments = cycledash.comments.get_last_comments()
        return render_template('runs.html', last_comments=comments, runs=vcfs)
