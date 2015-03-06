from flask import redirect, jsonify, url_for

from sqlalchemy import exc, select, func, desc

from common.helpers import tables
import cycledash.validations
from cycledash import db
from cycledash.helpers import (prepare_request_data, error_response,
                               request_wants_json)


def get_bam(bam_id):
    """Return JSON of BAM, or error is no matching bam is found."""
    with tables(db, 'bams') as (con, bams):
        q = select(bams.c).where(bams.c.id == bam_id)
        bam = con.execute(q).fetchone()
    if bam:
        return jsonify(dict(bam))
    else:
        msg = 'No bam with id={} found'.format(bam_id)
        return jsonify(error='No bam found', message=msg), 404


def get_bams():
    """Return json list of BAMs ordered by recency."""
    with tables(db, 'bams') as (con, bams):
        q = select(bams.c).order_by(desc(bams.c.id))
        return jsonify({'bams': [dict(r) for r in con.execute(q).fetchall()]})


def create_bam(request):
    """Create a bam, return the JSON of BAM or error.

    Redirect if the request was HTML.
    """
    try:
        data = cycledash.validations.CreateBamSchema(
            prepare_request_data(request))
    except Exception as e:
        return error_response('Bam validation', str(e))
    with tables(db, 'projects') as (con, projects):
        project_id = data.get('project_id')
        q = select(projects.c).where(projects.c.id == project_id)
        project = con.execute(q).fetchone()
    if project is None:
        return error_response('Invalid BAM',
                              'project_id={} does not exist'.format(project_id))
    try:
        with tables(db, 'bams') as (con, bams):
            result = bams.insert(data).returning(*bams.c).execute()
            bam = dict(result.fetchone())
    except Exception as e:
        msg  = 'Could not create bam {}'.format(data)
        return error_response(message=str(e),
                              error=msg)
    if request_wants_json():
        return jsonify(bam), 201
    elif 'text/html' in request.accept_mimetypes:
        return redirect(url_for('bam', bam_id=bam.get('id'))), 201


def update_bam(bam_id, request):
    """Update the bam, return the updated BAM as JSON, or error.

    Redirect if the request was HTML.
    """
    try:
        data = cycledash.validations.UpdateBamSchema(
            prepare_request_data(request))
    except Exception as e:
        return error_response('Bam validation', str(e))
    try:
        with tables(db, 'bams') as (con, bams):
            result = bams.update().where(
                bams.c.id == bam_id).values(
                    **data).returning(*bams.c).execute()
            bam = dict(result.fetchone())
    except Exception as e:
        msg  = 'Could not update bam {}'.format(bam)
        return error_response(message=str(e),
                              error=msg)
    if request_wants_json():
        return jsonify(bam)
    elif 'text/html' in request.accept_mimetypes:
        return redirect(url_for('bam', bam_id=bam.get('id')))



def delete_bam(bam_id):
    """Delete BAM and return the BAM, or error if no BAM
    was deleted.
    """
    with tables(db, 'bams') as (con, bams):
        result = bams.delete(
            bams.c.id == bam_id).returning(*bams.c).execute()
    if result.rowcount > 0:
        return jsonify(dict(result.fetchone()))
    else:
        msg = 'No bam with id={} found'.format(bam_id)
        return jsonify(error='No bam found for deletion', message=msg), 404
