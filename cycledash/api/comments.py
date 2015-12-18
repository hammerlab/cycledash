"""API for user comments."""
from collections import defaultdict
from flask import jsonify, request
from flask_restful import abort, fields
from flask_login import current_user
from sqlalchemy import select, func, desc
from voluptuous import Any, Required, Coerce, Schema

from common.helpers import tables, to_epoch
from cycledash import db
from cycledash.helpers import (prepare_request_data, success_response,
                               abort_if_none_for, camelcase_dict)
from cycledash.validations import Doc, to_epoch

from . import Resource, validate_with, marshal_with


CreateComment = Schema({
    Required("sample_name"): basestring,
    Required("contig"): basestring,
    Required("position"): Coerce(int),
    Required("reference"): basestring,
    Required("alternates"): basestring,
    Required("comment_text"): basestring
})

DeleteComment = Schema({
    Required('last_modified'): Coerce(float),
})

UpdateComment = Schema({
    Required('last_modified'): Coerce(float),
    "comment_text": basestring
})

CommentFields = Schema({
    Doc('id', 'The internal ID of the Comment.'):
        long,
    Doc('vcf_id', 'The ID of the Run this comment is associated with.'):
        long,
    Doc('sample_name', 'The name of the sample this comment is on.'):
        basestring,
    Doc('contig', 'The contig of the variant this comment is on.'):
        basestring,
    Doc('position', 'The position of the variant this comment is on.'):
        int,
    Doc('reference', 'The reference of the variant this comment is on.'):
        basestring,
    Doc('alternates',
        'The alternate allele of the variant this comment is on.'):
        basestring,
    Doc('comment_text', 'The text of the comment.'):
        Any(basestring, None),
    Doc('user_id', 'The ID of the User this comment is associated with.'):
        Any(long, None),
    Doc('created',
        'The time at which the comment was created (in epoch time).'):
        Coerce(to_epoch),
    Doc('last_modified',
        'The last modified time of the comment (in epoch time).'):
        Coerce(to_epoch)
})


class CommentList(Resource):
    require_auth = True
    @marshal_with(CommentFields, envelope='comments')
    def get(self, run_id):
        """Get a list of all comments."""
        with tables(db.engine, 'user_comments') as (con, comments):
            q = select(comments.c).where(
                comments.c.vcf_id == run_id).order_by(desc(comments.c.id))
            return [dict(c) for c in q.execute().fetchall()]

    @validate_with(CreateComment)
    @marshal_with(CommentFields)
    def post(self, run_id):
        """Create a comment."""
        with tables(db.engine, 'user_comments') as (con, comments):
            q = comments.insert().values(
                vcf_id=run_id,
                user_id=current_user['id'],
                **request.validated_body
            ).returning(*comments.c)
            return dict(q.execute().fetchone()), 201


class Comment(Resource):
    require_auth = True
    @marshal_with(CommentFields)
    def get(self, run_id, comment_id):
        """Get comment with the given ID."""
        with tables(db.engine, 'user_comments') as (con, comments):
            return _get_comment(comments, id=comment_id, vcf_id=run_id)

    @validate_with(UpdateComment)
    @marshal_with(CommentFields)
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
    @marshal_with(CommentFields)
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

    where comments have an additional "user" field.
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
            comment = add_user_to_comment(comment)
            results_map[row_key].append(comment)
    return {'comments': results_map}


def get_last_comments(n=5):
    """Return list of the last `n` comments."""
    with tables(db.engine, 'user_comments') as (con, user_comments):
        cols = user_comments.c
        q = select(cols.values()).order_by(
            desc(cols.created)).limit(n)
        comments = [camelcase_dict(dict(c)) for c in con.execute(q).fetchall()]
    return add_user_to_comments(epochify_comments(comments))

def add_user_to_comments(comments):
    """Given comments with userIds, attaches the relevant user
    info to the comments.
    """
    for comment in comments:
        add_user_to_comment(comment)
    return comments

def add_user_to_comment(comment):
    """Given a comment with userId, attaches the relevant user
    information (user: id, username) to the comment (comment: user).
    """
    if 'userId' in comment:
        with tables(db.engine, 'users') as (con, users):
            q = select([users.c.username, users.c.id]).where(
                users.c.id == comment['userId'])
            user = q.execute().fetchone()
            if user:
                user = dict(user)
            comment['user'] = user
    else:
        comment['user'] = None
    return comment

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
    comment = q.execute().fetchone()
    return dict(abort_if_none_for('comment')(comment, id))
