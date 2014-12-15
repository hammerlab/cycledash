"""API for user comments."""
from datetime import datetime
from flask import jsonify, request
from functools import wraps, partial
from sqlalchemy import exc, MetaData, Table, select

from cycledash import db
from cycledash.helpers import (prepare_request_data, success_response,
                               error_response)


def user_comments_db(func=None, use_transaction=False):
    """This decorator handles setting up the user_comments metadata, beginning a
    transaction if need be, committing or rolling back the transaction as
    appropriate, and returning an HTTP response (either via a caught error, or
    just passing through func's return value).
    """
    if func is None:
        return partial(user_comments_db, use_transaction=use_transaction)
    @wraps(func)
    def wrapper(*args, **kwargs):
        with db.engine.connect() as conn:
            use_transaction = True
            metadata = MetaData(bind=conn)
            user_comments = Table('user_comments', metadata, autoload=True)
            data = prepare_request_data(request)
            transaction = conn.begin() if use_transaction else None
            try:
                response = func(user_comments=user_comments, conn=conn,
                                data=data, *args, **kwargs)
                if use_transaction:
                    transaction.commit()
                return response
            except CRUDError, e:
                if use_transaction:
                    transaction.rollback()
                return error_response(e.subject, e.message)
            except exc.SQLAlchemyError, e:
                if use_transaction:
                    transaction.rollback()
                return error_response('SQL Exception', e.message)
    return wrapper


class CRUDError(Exception):
    """Represents an issue with results from a CRUD operation."""
    def __init__(self, subject, message):
        self.subject = subject
        self.message = message


@user_comments_db
def create_comment(vcf_id, conn=None, user_comments=None, data=None):
    """Create a user comment for this VCF ID, and return the created comment ID
    and last_modified_us timestamp as a response.
    """
    cols = user_comments.c
    stmt = user_comments.insert().returning(
        cols.id, cols.last_modified_us).values(
            vcf_id=vcf_id,
            sample_name=data[cols.sample_name.name],
            contig=data[cols.contig.name],
            position=data[cols.position.name],
            reference=data[cols.reference.name],
            alternates=data[cols.alternates.name],
            comment_text=data[cols.comment_text.name])
    result = conn.execute(stmt)
    if result.rowcount > 0:
        one_result = result.fetchone()
        response = {}
        response['comment_id'] = one_result[0]
        response['last_modified_us'] = get_epoch_microseconds(one_result[1])
        return jsonify(response)
    else:
        raise CRUDError('No Rows', 'No comment was created')


@user_comments_db
def get_comments(vcf_id, conn=None, user_comments=None, data=None):
    """Return all user comments in the following format:
    {
      "comments": {
        "<row_key STRING>": {
          "alternates": "<STRING>",
          "comment_text": "<STRING>",
          "contig": "<STRING>",
          "last_modified_us" : <INT>,
          "id": <INT>,
          "position": <INT>,
          "reference": "<STRING>",
          "sample_name": "<STRING>",
          "vcf_id": <INT>
        },
        "<row_key>": {
          "alternates": "<STRING>",
          ...
        },
    """
    # .c represents all columns
    stmt = select(user_comments.c).where(
        user_comments.c.vcf_id == vcf_id)
    results = conn.execute(stmt)

    # Turn results into a dictionary
    results_map = {}
    for result in results:
        comment = dict(result)
        last_mod_key = user_comments.c.last_modified_us.name
        comment[last_mod_key] = get_epoch_microseconds(comment[last_mod_key])
        row_key = get_row_key(comment, user_comments)
        results_map[row_key] = comment

    response = {}
    response['comments'] = results_map
    return jsonify(response)


def get_row_key(comment, table):
    """Each variant row should have a unique row key, and we key our JSON
    comment represention by this value. Also see getRowKey in RecordStore.js.
    """
    return '%s%d%s%s%s' % (
        comment[table.c.contig.name],
        comment[table.c.position.name],
        comment[table.c.reference.name],
        comment[table.c.alternates.name],
        comment[table.c.sample_name.name]
    )


@user_comments_db(use_transaction=True)
def delete_comment(comment_id, conn=None, user_comments=None, data=None):
    """To delete a comment, format PUT data as:
    {"last_modified_us": <INT_MICROSECONDS>} to prevent clobbering.
    See update_comment.

    Use a transaction to ensure that this select and update are atomic.
    """
    # Don't allow clobbering due to an out-of-sync client.
    if is_stale(comment_id, conn, user_comments, data):
        return stale_error_response()

    stmt = user_comments.delete(user_comments.c.id == comment_id)
    result = conn.execute(stmt)
    if result.rowcount > 0:
        return success_response()
    else:
        raise CRUDError('No Rows', 'No comment was deleted')


@user_comments_db(use_transaction=True)
def update_comment(comment_id, conn=None, user_comments=None, data=None):
    """To update a comment, format PUT data as:
    {"comment_text": "<comment text>", "last_modified_us": <INT_MICROSECONDS>}

    Here, timestamp represents the timestamp of the comment as last retrieved
    from the DB. It allows us to ensure that multiple API updates don't
    clobber each other.

    Returns the updated last_modified_us timestamp if the update was a success.

    Uses a transaction to ensure that this select and update are atomic.
    """
    # Don't allow clobbering due to an out-of-sync client.
    if is_stale(comment_id, conn, user_comments, data):
        return stale_error_response()

    stmt = user_comments.update().where(
        user_comments.c.id == comment_id).returning(
            user_comments.c.last_modified_us).values(
                comment_text=data[user_comments.c.comment_text.name],

                # Update the last_modified_us timestamp, now that we're actually
                # making a modification.
                last_modified_us=db.func.now())
    result = conn.execute(stmt)
    if result.rowcount > 0:
        updated_timestamp = get_epoch_microseconds(result.fetchone()[0])

        # Return the updated last_modified_us timestamp
        response = {}
        response['last_modified_us'] = updated_timestamp
        return jsonify(response)
    else:
        raise CRUDError('No Rows', 'No comment was updated')


def is_stale(comment_id, conn, user_comments, data):
    """Return True if the comment was updated since the client last loaded it.
    """
    current_last_modified = get_last_modified_timestamp(
        comment_id, conn, user_comments)
    comment_last_modified = int(data[user_comments.c.last_modified_us.name])
    return current_last_modified != comment_last_modified


def stale_error_response():
    return error_response(
        'Stale Comment',
        'Trying to modify a comment when the client is out of sync'
    )


def get_last_modified_timestamp(comment_id, conn, user_comments):
    """Retrieve the last modified UNIX timestamp for this comment ID."""
    stmt = select([user_comments.c.last_modified_us]).where(
        user_comments.c.id == comment_id)
    try:
        result = conn.execute(stmt)
        if result.rowcount > 0:
            return get_epoch_microseconds(result.fetchone()[0])
    except exc.SQLAlchemyError:
        return None
    return None


def get_epoch_microseconds(dt):
    """Get dt represented as microseconds since 1970."""
    delta = dt - datetime.fromtimestamp(0)
    return int(delta.total_seconds() * (10**6))
