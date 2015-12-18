import datetime
from flask import request
from flask_restful import abort, fields
from sqlalchemy import select, desc, func
import voluptuous
from voluptuous import Schema, Any, Required, Exclusive, Coerce

from cycledash import db
from cycledash.helpers import get_id_where, get_where, abort_if_none_for
from cycledash.validations import Doc, expect_one_of, FilePathString, HttpPathString
from common.helpers import tables
import workers.runner

from . import genotypes, bams, marshal_with, validate_with, projects, Resource


CreateRun = Schema({
    Required('uri'): FilePathString,

    # One of `project` is required, but not supported in voluptuous, so we
    # enforce this in code. cf. https://github.com/alecthomas/voluptuous/issues/115
    Exclusive('project_id', 'project'): Coerce(int),
    Exclusive('project_name', 'project'): unicode,

    Exclusive('normal_bam_id', 'normal_bam'): Coerce(int),
    Exclusive('normal_bam_uri', 'normal_bam'): HttpPathString,
    Exclusive('tumor_bam_id', 'tumor_bam'): Coerce(int),
    Exclusive('tumor_bam_uri', 'tumor_bam'): HttpPathString,

    'caller_name': unicode,
    'project_id': Coerce(int),
    'tumor_dataset_id': Coerce(int),
    'normal_dataset_id': Coerce(int),
    'is_validation': bool,
    'notes': unicode,
    'dataset': unicode,
    'project_name': unicode,
    'vcf_header': unicode,
    'vcf_release': Coerce(int)
})

UpdateRun = Schema({
    'caller_name': unicode,

    Exclusive('normal_bam_id', 'normal_bam'): Coerce(int),
    Exclusive('normal_bam_uri', 'normal_bam'): HttpPathString,
    Exclusive('tumor_bam_id', 'tumor_bam'): Coerce(int),
    Exclusive('tumor_bam_uri', 'tumor_bam'): HttpPathString,

    'notes': unicode,
    'vcf_header': unicode,
    'vcf_release': Coerce(int),

    'true_positive': Coerce(int),
    'false_positive': Coerce(int),
    'precision': Coerce(float),
    'recall': Coerce(float),
    'f1score': Coerce(float)
})

run_fields = {
    Doc('id', 'The internal ID of the Run.'):
        long,
    Doc('extant_columns', 'A list of all the columns the Run has.'):
        Any(basestring, None),
    Doc('uri', 'The URL of the VCF this run was based on.'):
        basestring,
    Doc('caller_name',
        'The name of the variant caller used to generate this Run.'):
        Any(basestring, None),
    Doc('genotype_count', 'The number of genotypes (calls) made in this Run.'):
        Any(long, None),
    Doc('created_at', 'Timestamp when the Run was created.'):
        datetime.datetime,
    Doc('notes', 'Any ancillary notes, parameters, etc of the Run.'):
        Any(basestring, None),
    Doc('vcf_header', 'The raw VCF text of the header.'):
        Any(basestring, None),
    Doc('vcf_release', 'ENSEMBL Release for the reference'):
        Any(int, None),
    Doc('project_id', 'The internal ID of the Project this Run belongs to.'):
        long,
    Doc('normal_bam_id',
        'The internal ID of the normal BAM associated with the Run.'):
        Any(long, None),
    Doc('tumor_bam_id',
        'The internal ID of the normal BAM associated with the Run.'):
        Any(long, None)
}

RunFields = Schema(run_fields)

# Used because on GET /runs/<id> we need some extra fields [for now].
thick_run_fields = run_fields.copy()
thick_run_fields.update({
    'spec': type,
    'contigs': list,
    'normal_bam': object,
    'tumor_bam': object
})
ThickRunFields = Schema(thick_run_fields)


class RunList(Resource):
    require_auth = True
    @marshal_with(RunFields, envelope='runs')
    def get(self):
        """Get list of all runs in order of recency."""
        with tables(db.engine, 'vcfs') as (con, runs):
            q = select(runs.c).order_by(desc(runs.c.id))
            return [dict(r) for r in q.execute().fetchall()]

    @validate_with(CreateRun)
    @marshal_with(RunFields)
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
            projects.set_and_verify_project_id_on(run)
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
        return dict(run), 201


class Run(Resource):
    require_auth = True
    @marshal_with(ThickRunFields)
    def get(self, run_id):
        """Return a vcf with a given ID."""
        with tables(db.engine, 'vcfs') as (con, runs):
            q = select(runs.c).where(runs.c.id == run_id)
            run = dict(_abort_if_none(q.execute().fetchone(), run_id))
        bams.attach_bams_to_vcfs([run])
        return run

    @validate_with(UpdateRun)
    @marshal_with(RunFields)
    def put(self, run_id):
        """Update the run by its ID."""
        with tables(db.engine, 'vcfs') as (con, runs):
            q = runs.update(runs.c.id == run_id).values(
                **request.validated_body
            ).returning(*runs.c)
            return dict(_abort_if_none(q.execute().fetchone(), run_id))

    @marshal_with(RunFields)
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
