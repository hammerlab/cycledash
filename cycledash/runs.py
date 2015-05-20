from flask import request
from flask.ext.restful import abort, Resource, fields
from sqlalchemy import select, desc, func
import voluptuous

from cycledash import db, genotypes
from cycledash.helpers import (get_id_where, get_where, abort_if_none_for,
                               validate_with, marshal_with)
import cycledash.bams
import cycledash.projects
from cycledash.validations import CreateRun, UpdateRun, expect_one_of
from common.helpers import tables
import workers.runner


run_fields = {
    'id': fields.Integer,

    'extant_columns': fields.String,
    'uri': fields.String,
    'caller_name': fields.String,
    'genotype_count': fields.Integer,
    'created_at': fields.DateTime(dt_format='iso8601'),
    'notes': fields.String,
    'vcf_header': fields.String,

    'project_id': fields.Integer,
    'normal_bam_id': fields.Integer,
    'tumor_bam_id': fields.Integer
}

# Used because on GET /runs/<id> we want the spec and contig, too [for now].
thick_run_fields = dict(
    run_fields, spec=fields.Raw, contigs=fields.List(fields.String))


class RunList(Resource):
    @marshal_with(run_fields, envelope='runs')
    def get(self):
        """Get list of all runs in order of recency."""
        with tables(db.engine, 'vcfs') as (con, runs):
            q = select(runs.c).order_by(desc(runs.c.id))
            return [r for r in q.execute().fetchall()]

    @validate_with(CreateRun)
    @marshal_with(run_fields)
    def post(self):
        """Create a new run.

        This will import the VCF's genotypes into the database in a worker, as
        well as annotate it with gene names.
        """
        run = request.validated_body
        try:
            expect_one_of(request.validated_body, 'project_name', 'project_id')
        except voluptuous.MultipleInvalid as e:
            errors = [str(err) for err in e.errors]
            abort(409, message='Validation error', errors=errors)
        try:
            cycledash.projects.set_and_verify_project_id_on(run)
        except voluptuous.Invalid as e:
            abort(404, message='Project not found.', errors=[str(e)])
        try:
            _set_or_verify_bam_id_on(run, bam_type='normal')
            _set_or_verify_bam_id_on(run, bam_type='tumor')
        except voluptuous.Invalid as e:
            abort(404, message='BAM not found.', errors=[str(e)])

        with tables(db.engine, 'vcfs') as (con, runs):
            run = runs.insert(
                request.validated_body).returning(*runs.c).execute().fetchone()
        workers.runner.start_workers_for_vcf_id(run['id'])
        return run, 201


class Run(Resource):
    @marshal_with(thick_run_fields)
    def get(self, run_id):
        """Return a vcf with a given ID."""
        with tables(db.engine, 'vcfs') as (con, runs):
            q = select(runs.c).where(runs.c.id == run_id)
            run = dict(_abort_if_none(q.execute().fetchone(), run_id))
        cycledash.bams.attach_bams_to_vcfs([run])
        return run

    @validate_with(UpdateRun)
    @marshal_with(run_fields)
    def put(self, run_id):
        """Update the run by its ID."""
        with tables(db.engine, 'vcfs') as (con, runs):
            q = runs.update(runs.c.id == run_id).values(
                **request.validated_body
            ).returning(*runs.c)
            return dict(_abort_if_none(q.execute().fetchone(), run_id))

    @marshal_with(run_fields)
    def delete(self, run_id):
        """Delete a run by its ID."""
        with tables(db.engine, 'vcfs') as (con, runs):
            q = (runs.delete()
                 .where(runs.c.id == run_id)
                 .returning(*runs.c))
            # TODO: unattach BAMs and projects before deleting?
            # TODO: cascade tasks & genotypes deletion?
            return dict(_abort_if_none(q.execute().fetchone(), run_id))


_abort_if_none = abort_if_none_for('run')


def get_related_vcfs(run):
    """Return a list of vcfs in the same project as vcf."""
    with tables(db.engine, 'vcfs') as (con, runs):
        q = select(runs.c).where(
            runs.c.project_id == run['project_id']).where(
                runs.c.id != run['id'])
        return [dict(r) for r in q.execute().fetchall()]


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
