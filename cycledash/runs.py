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


def get_vcf(vcf_id):
    """Return a vcf with a given ID, and the spec and list of contigs for that
    run for use by the /examine page."""
    with tables(db, 'vcfs') as (con, vcfs):
        q = select(vcfs.c).where(vcfs.c.id == vcf_id)
        vcf = dict(con.execute(q).fetchone())
    vcf['spec'] = genotypes.spec(vcf_id)
    vcf['contigs'] = genotypes.contigs(vcf_id)
    return vcf


def get_related_vcfs(vcf):
    """Return a list of vcfs in the same project as vcf."""
    with tables(db, 'vcfs') as (con, vcfs):
        q = select(vcfs.c).where(
            vcfs.c.project_id == vcf['project_id']).where(
                vcfs.c.id != vcf['id'])
        vcfs = [dict(v) for v in con.execute(q).fetchall()]
    return vcfs


def create_vcf():
    """Create a new vcf, inserting it into the vcfs table and starting workers.

    This raises an exception if anything goes wrong.
    """
    try:
        run = validations.CreateRun((prepare_request_data(request)))
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
    """After calling this, run['(bam_type)_bam_id'] will be set to a valid BAM ID.

    If there is not a matching BAM, it will raise voluptuous.Invalid.
    """
    id_key = bam_type + '_bam_id'
    uri_key = bam_type + '_bam_uri'
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
