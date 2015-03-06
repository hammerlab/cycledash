from flask import redirect, jsonify, url_for

from sqlalchemy import exc, select, func, desc

from common.helpers import tables
from cycledash import db
import cycledash.validations
from cycledash.helpers import (prepare_request_data, error_response,
                               request_wants_json)


def get_project(project_id):
    """Return project, or None is no matching project is found."""
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


def create_project(request):
    """Create a project, return the project."""
    try:
        data = cycledash.validations.CreateProjectSchema(
            prepare_request_data(request))
    except Exception as e:
        return error_response('Project validation', str(e))
    try:
        with tables(db, 'projects') as (con, projects):
            result = projects.insert(data).returning(*projects.c).execute()
            project = dict(result.fetchone())
    except Exception as e:
        msg  = 'Could not create project {}'.format(data)
        return error_response(message=str(e),
                              error=msg)
    if request_wants_json():
        return jsonify(project), 201
    elif 'text/html' in request.accept_mimetypes:
        return redirect(url_for('project', project_id=project.get('id'))), 201


def update_project(project_id, request):
    """Update the project, return the updated project."""
    try:
        data = cycledash.validations.UpdateProjectSchema(
            prepare_request_data(request))
    except Exception as e:
        return error_response('Project validation', str(e))
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
        return redirect(url_for('project', project_id=project.get('id')))


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

