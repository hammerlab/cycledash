"""API for user comments."""
from collections import defaultdict
from flask import jsonify, request
from flask.ext.restful import abort, fields
from sqlalchemy import select, func, desc

from common.helpers import tables, to_epoch
from cycledash import db
from cycledash.helpers import (prepare_request_data, success_response,
                               validate_with, abort_if_none_for, EpochField,
                               marshal_with, camelcase_dict)
from cycledash.validations import CreateComment, DeleteComment, UpdateComment

from . import Resource


comment_fields = {
    "id": fields.Integer,
    "vcf_id": fields.Integer,
    "sample_name": fields.String,
    "contig": fields.String,
    "position": fields.Integer,
    "reference": fields.String,
    "alternates": fields.String,
    "comment_text": fields.String,
    "author_name": fields.String,
    "created": EpochField,
    "last_modified": EpochField
}


class CommentList(Resource):
    require_auth = True
    @marshal_with(comment_fields, envelope='comments')
    def get(self, run_id):
        """Get a list of all comments."""
        with tables(db.engine, 'user_comments') as (con, comments):
            q = select(comments.c).where(
                comments.c.vcf_id == run_id).order_by(desc(comments.c.id))
            return [dict(c) for c in q.execute().fetchall()]

    @validate_with(CreateComment)
    @marshal_with(comment_fields)
    def post(self, run_id):
        """Create a comment."""
        with tables(db.engine, 'user_comments') as (con, comments):
            q = comments.insert().values(
                vcf_id=run_id,
                **request.validated_body
            ).returning(*comments.c)
            return dict(q.execute().fetchone()), 201


class Comment(Resource):
    require_auth = True
    @marshal_with(comment_fields)
    def get(self, run_id, comment_id):
        """Get comment with the given ID."""
        with tables(db.engine, 'user_comments') as (con, comments):
            return _get_comment(comments, id=comment_id, vcf_id=run_id)

    @validate_with(UpdateComment)
    @marshal_with(comment_fields)
    def put(self, run_id, comment_id):
        """Update the comment with the given ID.

        Must include `last_modified_timestamp`: if it's different than the
        comment's current `last_modified_timestamp`, the update is rejected.
        """
        last_modified = request.validated_body['last_modified']
        with tables(db.engine, 'user_comments') as (conn, comments), \
             conn.begin() as trans:
            comment = _get_comment(comments, id=comment_id, vcf_id=run_id)
            _ensure_not_out_of_date(comment, last_modified)
            request.validated_body['last_modified'] = func.now()
            q = (comments.update()
                 .where(comments.c.id == comment_id)
                 .values(**request.validated_body)
                 .returning(*comments.c))
            return dict(q.execute().fetchone())

    @validate_with(DeleteComment)
    @marshal_with(comment_fields)
    def delete(self, run_id, comment_id):
        """Delete the comment with the given ID.

        Must include `last_modified_timestamp`: if it's different than the
        comment's current `last_modified_timestamp`, the deletion is rejected.
        """
        last_modified = request.validated_body['last_modified']
        with tables(db.engine, 'user_comments') as (conn, comments), \
             conn.begin() as trans:
            comment = _get_comment(comments, id=comment_id, vcf_id=run_id)
            _ensure_not_out_of_date(comment, last_modified)
            comments.delete(comments.c.id == comment_id).execute()
        return comment


class CommentsForVcf(Resource):
    require_auth = True
    def get(self, run_id):
        """Returns comments keys by their record ID."""
        # Ideally, this would be done on the client-side with the basic API
        # provided by the other classes: not sure this is desirable.
        return get_vcf_comments(run_id)


def get_vcf_comments(vcf_id):
    """Return all user comments in the following format:

    {
      "comments": {
        "<row_key STRING>": [<comment_fields>, ...],
        "<row_key STRING>": [...], ...
      }
    }
    """
    def _row_key(comment, table):
        cols = ['contig', 'position', 'reference', 'alternates', 'sample_name']
        return ':'.join([str(comment[col]) for col in cols])

    with tables(db.engine, 'user_comments') as (conn, user_comments):
        cols = user_comments.c
        stmt = select(cols.values()).where(cols.vcf_id == vcf_id)
        results = conn.execute(stmt)
        results_map = defaultdict(list)
        for comment in (dict(c) for c in results):
            row_key = _row_key(comment, user_comments)
            comment['last_modified'] = to_epoch(comment['last_modified'])
            comment['created'] = to_epoch(comment['created'])
            comment = camelcase_dict(comment)
            results_map[row_key].append(comment)
    return {'comments': results_map}


def get_last_comments(n=5):
    """Return list of the last `n` comments."""
    with tables(db.engine, 'user_comments') as (con, user_comments):
        cols = user_comments.c
        q = select(cols.values()).order_by(
            desc(cols.created)).limit(n)
        comments = [camelcase_dict(dict(c)) for c in con.execute(q).fetchall()]
    return epochify_comments(comments)


def epochify_comments(comments):
    """Sets `lastModified` and `created` to be epoch time instead of iso8061."""
    for c in comments:
        c['lastModified'] = to_epoch(c['lastModified'])
        c['created'] = to_epoch(c['created'])
    return comments


def _ensure_not_out_of_date(comment, last_modified):
    """Assert that the comment has the same last_modified time,
    otherwise abort(409).
    """
    current_time = to_epoch(comment['last_modified'])
    if current_time != last_modified:
        abort(409, message=('Comment id={} is out of date.'
                            .format(comment['id'])),
              current_time=current_time)


def _get_comment(comment_table, id=None, **query_kwargs):
    """Return comment with the given `id`, and any additional keyword arguments
    to modify the WHERE of the SQL query with.
    """
    if id is None:
        raise ValueError('Must provide a comment ID.')
    q = comment_table.select().where(comment_table.c.id == id)
    for colname, val in query_kwargs.items():
        q = q.where(comment_table.c[colname] == val)
    return dict(abort_if_none_for('comment')(q.execute().fetchone(), id))
