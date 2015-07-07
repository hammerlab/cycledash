"""Defines the API for BAMs."""
from flask import request
from flask.ext.restful import abort, fields
from sqlalchemy import select, desc
import voluptuous

from common.helpers import tables, find
from cycledash.validations import CreateBam, UpdateBam, expect_one_of
from cycledash import db
from cycledash.helpers import validate_with, abort_if_none_for, marshal_with
import workers.indexer

import projects
from . import Resource


bam_fields = {
    "id": fields.Integer,
    "project_id": fields.Integer,
    "name": fields.String,
    "normal": fields.Boolean,
    "notes": fields.String,
    "resection_date": fields.String,
    "tissues": fields.String,
    "uri": fields.String
}


class BamList(Resource):
    require_auth = True
    @marshal_with(bam_fields, envelope='bams')
    def get(self):
        """Get list of all BAMs."""
        with tables(db.engine, 'bams') as (con, bams):
            q = select(bams.c).order_by(desc(bams.c.id))
            return [dict(r) for r in con.execute(q).fetchall()]

    @validate_with(CreateBam)
    @marshal_with(bam_fields)
    def post(self):
        """Create a new BAM.

        This will index the BAM index on HDFS if it's not already indexed."""
        try:
            expect_one_of(request.validated_body, 'project_name', 'project_id')
        except voluptuous.MultipleInvalid as e:
            errors = [str(err) for err in e.errors]
            abort(409, message='Validation error', errors=errors)
        try:
            projects.set_and_verify_project_id_on(request.validated_body)
        except voluptuous.Invalid as e:
            abort(404, message='Project not found.', error=str(e))
        with tables(db.engine, 'bams') as (con, bams):
            result = bams.insert(
                request.validated_body).returning(*bams.c).execute()
            bam = dict(result.fetchone())
        workers.indexer.index.delay(bam['id'])
        return bam, 201


class Bam(Resource):
    require_auth = True
    @marshal_with(bam_fields)
    def get(self, bam_id):
        """Get a BAM by its ID."""
        with tables(db.engine, 'bams') as (con, bams):
            q = select(bams.c).where(bams.c.id == bam_id)
            return dict(_abort_if_none(q.execute().fetchone(), bam_id))

    @validate_with(UpdateBam)
    @marshal_with(bam_fields)
    def put(self, bam_id):
        """Update the BAM by its ID."""
        with tables(db.engine, 'bams') as (con, bams):
            q = bams.update(bams.c.id == bam_id).values(
                **request.validated_body
            ).returning(*bams.c)
            return dict(_abort_if_none(q.execute().fetchone(), bam_id))

    @marshal_with(bam_fields)
    def delete(self, bam_id):
        """Delete a BAM by its ID."""
        with tables(db.engine, 'bams') as (con, bams):
            q = bams.delete(bams.c.id == bam_id).returning(*bams.c)
            q = q.execute()
            res = q.fetchone()
            return dict(_abort_if_none(res, bam_id))


_abort_if_none = abort_if_none_for('bam')


def attach_bams_to_vcfs(vcfs):
    """Attach tumor_bam and normal_bam to all VCFs."""
    with tables(db.engine, 'bams') as (con, bams):
        q = select(bams.c)
        bams = [dict(b) for b in con.execute(q).fetchall()]
    for vcf in vcfs:
        normal_bam_id = vcf.get('normal_bam_id')
        tumor_bam_id = vcf.get('tumor_bam_id')

        vcf['tumor_bam'] = (
            dict(find(bams, lambda x: x.get('id') == tumor_bam_id) or {}))
        vcf['normal_bam'] = (
            dict(find(bams, lambda x: x.get('id') == normal_bam_id) or {}))

