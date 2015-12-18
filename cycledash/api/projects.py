"""Defines the API for Projects."""
from flask import request, redirect, jsonify, url_for, render_template
from flask_restful import fields, abort
from sqlalchemy import exc, select, func, desc
import voluptuous
from voluptuous import Schema, Required, Any

from common.helpers import tables, find
from cycledash import db
from cycledash.helpers import get_id_where, abort_if_none_for
from cycledash.validations import Doc

from . import bams, tasks, Resource, marshal_with, validate_with


CreateProject = Schema({
    Required('name'): unicode,
    'notes': unicode
})

UpdateProject = Schema({
    'name': unicode,
    'notes': unicode
})

ProjectFields = Schema({
    Doc('id', docstring='The internal ID of the project.'): long,
    Doc('name', docstring='The name of the project (unique).'): Any(basestring, None),
    Doc('notes', docstring='The notes of the project.'): Any(basestring, None)
}, extra=voluptuous.REMOVE_EXTRA)


class ProjectList(Resource):
    require_auth = True
    @marshal_with(ProjectFields, envelope='projects')
    def get(self):
        """Get list of all projects."""
        with tables(db.engine, 'projects') as (con, projects):
            q = select(projects.c).order_by(desc(projects.c.id))
            return [dict(r) for r in con.execute(q).fetchall()]

    @validate_with(CreateProject)
    @marshal_with(ProjectFields)
    def post(self):
        """Create a new project."""
        with tables(db.engine, 'projects') as (con, projects):
            try:
                result = projects.insert(
                    request.validated_body
                ).returning(*projects.c).execute()
            except exc.IntegrityError as e:
                abort(409, message='Project cannot be created.', errors=[str(e)])
            return dict(result.fetchone()), 201


class Project(Resource):
    require_auth = True
    @marshal_with(ProjectFields)
    def get(self, project_id):
        """Get a project by its ID."""
        with tables(db.engine, 'projects') as (con, projects):
            q = select(projects.c).where(projects.c.id == project_id)
            return dict(_abort_if_none(con.execute(q).fetchone(), project_id))

    @validate_with(UpdateProject)
    @marshal_with(ProjectFields)
    def put(self, project_id):
        """Update a project by its ID."""
        with tables(db.engine, 'projects') as (con, projects):
            q = projects.update(projects.c.id == project_id).values(
                **request.validated_body
            ).returning(*projects.c)
            return dict(_abort_if_none(q.execute().fetchone(), project_id))

    @marshal_with(ProjectFields)
    def delete(self, project_id):
        """Delete a project by its ID."""
        with tables(db.engine, 'projects') as (con, projects):
            q = projects.delete(
                projects.c.id == project_id).returning(*projects.c)
            return dict(_abort_if_none(q.execute().fetchone(), project_id))


_abort_if_none = abort_if_none_for('project')


def get_projects_tree():
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
    with tables(db.engine, 'vcfs', 'user_comments', 'bams', 'projects') as \
         (con, vcfs, user_comments, bams_table, projects):
        joined = (vcfs
            .outerjoin(user_comments, vcfs.c.id == user_comments.c.vcf_id))
        num_comments = func.count(user_comments.c.vcf_id).label('num_comments')
        q = (select(vcfs.c + [num_comments])
            .select_from(joined)
            .group_by(vcfs.c.id)
            .order_by(desc(vcfs.c.id)))
        vcfs = [dict(v) for v in con.execute(q).fetchall()]

        q = select(bams_table.c)
        all_bams = [dict(b) for b in con.execute(q).fetchall()]

        q = select(projects.c)
        projects = [dict(b) for b in con.execute(q).fetchall()]

        bams.attach_bams_to_vcfs(vcfs)

        for vcf in vcfs:
            project_id = vcf.get('project_id')

            vcf['project'] = dict(find(projects,
                                       lambda x: x.get('id') == project_id) or {})

        _join_task_states(vcfs)

        for project in projects:
            project_id = project['id']
            project_bams = [bam for bam in all_bams
                            if bam.get('project_id') == project_id]
            project_vcfs = [vcf for vcf in vcfs
                            if vcf.get('project_id') == project_id]
            project['bams'] = project_bams
            project['vcfs'] = project_vcfs
        return projects


def _join_task_states(vcfs):
    """Add a task_states field to each VCF in a list of VCFs."""
    ts = tasks.all_non_success_tasks()

    for vcf in vcfs:
        vcf['task_states'] = ts.get(vcf['id'], [])


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
        if get_id_where('projects', db, id=project_id) is None:
            raise voluptuous.Invalid('no project with id {}'.format(project_id))
