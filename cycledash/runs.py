from flask import request, jsonify, redirect, render_template, url_for
from sqlalchemy import select, desc, func
import voluptuous

import config
from cycledash import db, validations, genotypes
from cycledash.helpers import (prepare_request_data, error_response,
                               get_id_where, get_where, request_wants_json)
import cycledash.tasks
import cycledash.comments
import cycledash.projects

from common.helpers import tables, CRUDError, find
import workers.runner


class CollisionError(Exception):
    pass


def _get_runs(as_project_tree=False):
    """Return a list of all runs.

    If `as_project_tree` is True, pivot the runs on projects so that the
    returned object is:

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

        for vcf in vcfs:
            normal_bam_id = vcf.get('normal_bam_id')
            tumor_bam_id = vcf.get('tumor_bam_id')
            project_id = vcf.get('project_id')

            vcf['project'] = dict(find(projects,
                                       lambda x: x.get('id') == project_id) or {})
            vcf['tumor_bam'] = dict(find(bams,
                                         lambda x: x.get('id') == tumor_bam_id) or {})
            vcf['normal_bam'] = dict(find(bams,
                                          lambda x: x.get('id') == normal_bam_id) or {})
        _join_task_states(vcfs)

        if as_project_tree:
            for project in projects:
                project_id = project['id']
                project_bams = [bam for bam in bams
                                if bam.get('project_id') == project_id]
                project_vcfs = [vcf for vcf in vcfs
                                if vcf.get('project_id') == project_id]
                project['bams'] = project_bams
                project['vcfs'] = project_vcfs
            return projects
        return vcfs


def get_runs():
    if request_wants_json():
        vcfs = _get_runs(as_project_tree=True)
        return jsonify({'runs': vcfs})
    elif 'text/html' in request.accept_mimetypes:
        vcfs = _get_runs(as_project_tree=True)
        last_comments = cycledash.comments.get_last_comments()
        return render_template('runs.html',
                               last_comments=last_comments,
                               runs=vcfs)


def get_run(run_id):
    """Return a run with a given ID, and the spec and list of contigs for that
    run for use by the /examine page."""
    with tables(db, 'vcfs') as (con, vcfs):
        q = select(vcfs.c).where(vcfs.c.id == run_id)
        run = dict(con.execute(q).fetchone())
    run['spec'] = genotypes.spec(run_id)
    run['contigs'] = genotypes.contigs(run_id)
    return run


def create_run():
    """Create a new run, inserting it into the vcfs table and starting workers.

    This raises an exception if anything goes wrong.

    Args:
        request: validations.CreateRunSchema
    """
    try:
        run = validations.CreateRunSchema((prepare_request_data(request)))
        project_attr = validations.expect_one_of(run, 'project_name', 'project_id')
    except voluptuous.MultipleInvalid as err:
        return error_response('Run validation', [str(e) for e in err.errors])

    try:
        cycledash.projects.set_and_verify_project_id_on(run)
    except voluptuous.Invalid as e:
        return error_response('Project not found', str(e)), 404

    try:
        _set_or_verify_bam_id_on(run, bam_type='normal')
        _set_or_verify_bam_id_on(run, bam_type='tumor')
    except voluptuous.Invalid as e:
        return error_response('BAM not found', str(e)), 404

    with tables(db, 'vcfs') as (con, vcfs_table):
        try:
            _ensure_no_existing_vcf(vcfs_table, run['uri'])
        except CollisionError as e:
            return error_response('VCF already submitted', str(e))

        vcf_id = _insert_vcf(run, vcfs_table, con)

    workers.runner.start_workers_for_vcf_id(vcf_id)

    return redirect(url_for('list_runs'))


def _set_or_verify_bam_id_on(run, bam_type):
    id_key = bam_type+'_bam_id'
    uri_key = bam_type+'_bam_uri'
    bam_id = run.get(id_key)
    if bam_id:
        if get_where('bams', db, id=bam_id) is None:
            raise voluptuous.Invalid(
                'bam with id "{}" does not exist'.format(bam_id))
    elif run.get(uri_key):
        bam_id = get_id_where('bams', db, uri=run[uri_key])
        if bam_id is None:
            raise voluptuous.Invalid(
                'bam with uri "{}" does not exist'.format(run[uri_key]))
        run[id_key] = bam_id
        del run[uri_key]


def _ensure_no_existing_vcf(vcfs_table, vcf_uri):
    """Ensures no other VCFs with the same path. Raises if this isn't so."""
    if not _vcf_exists(vcfs_table, vcf_uri):
        return
    if config.ALLOW_VCF_OVERWRITES:
        was_deleted = _delete_vcf(vcfs_table, vcf_uri)
        if not was_deleted:
            raise CRUDError('Rows should have been deleted if we are '
                            'deleting a VCF that exists')
    else:
        raise CollisionError(
            'VCF already exists with URI {}'.format(vcf_uri))


def _insert_vcf(run, vcfs_table, connection):
    """Insert a new row in the vcfs table, if it's not there already."""
    if _vcf_exists(vcfs_table, run['uri']):
        return None
    record = {
        'uri': run['uri'],
        'caller_name': run.get('variant_caller_name'),
        'normal_bam_id': run.get('normal_bam_id'),
        'tumor_bam_id': run.get('tumor_bam_id'),
        'notes': run.get('params'),
        'project_id': run.get('project_id'),
        'vcf_header': '(pending)',
    }
    vcfs_table.insert(record).execute()
    return _get_vcf_id(connection, run['uri'])


def _get_vcf_id(connection, uri):
    """Return id from vcfs table for the vcf corresponding to the given run."""
    query = "SELECT * FROM vcfs WHERE uri = '" + uri + "'"
    return connection.execute(query).first().id


def _delete_vcf(vcfs_table, uri):
    """Delete VCFs with this URI, and return True if rows were deleted."""
    result = vcfs_table.delete().where(vcfs_table.c.uri == uri).execute()
    return result.rowcount > 0


def _vcf_exists(vcfs_table, uri):
    """Return True if the VCF exists in the vcfs table, else return False."""
    q = select([vcfs_table.c.id]).where(vcfs_table.c.uri == uri)
    result = q.execute()
    return result.rowcount > 0


def _join_task_states(vcfs):
    """Add a task_states field to each VCF in a list of VCFs."""
    ts = cycledash.tasks.all_non_success_tasks()

    for vcf in vcfs:
        vcf['task_states'] = ts.get(vcf['id'], [])
