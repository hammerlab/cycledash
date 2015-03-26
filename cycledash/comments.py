"""API for user comments."""
from collections import defaultdict
from datetime import datetime
from flask import jsonify, request
from functools import wraps, partial
from sqlalchemy import exc, select, func, desc

from common.helpers import tables, CRUDError
from cycledash import db
from cycledash.helpers import (prepare_request_data, success_response,
                               error_response)


def get_all_comments():
    """Return a list of all comments."""
    with tables(db, 'user_comments') as (con, user_comments):
        q = select(user_comments.c).order_by(
            desc(user_comments.c.last_modified))
        return [dict(c) for c in con.execute(q).fetchall()]


def user_comments_db(f=None, use_transaction=False):
    """This decorator handles setting up the user_comments metadata, beginning a
    transaction if need be, committing or rolling back the transaction as
    appropriate, and returning an HTTP response (either via a caught error, or
    just passing through f's return value).
    """
    if f is None:
        return partial(user_comments_db, use_transaction=use_transaction)
    @wraps(f)
    def wrapper(*args, **kwargs):
        with tables(db, 'user_comments') as (conn, user_comments):
            use_transaction = True
            data = prepare_request_data(request)
            transaction = conn.begin() if use_transaction else None
            try:
                response = f(user_comments=user_comments, conn=conn,
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


@user_comments_db
def create_comment(vcf_id, conn, user_comments, data):
    """Create a user comment for this VCF ID, and return the created 
    comment ID and last_modified_timestamp as a response.
    """
    cols = user_comments.c
    stmt = user_comments.insert().returning(
        cols.id, cols.last_modified).values(
            vcf_id=vcf_id,
            sample_name=data[cols.sample_name.name],
            contig=data[cols.contig.name],
            position=data[cols.position.name],
            reference=data[cols.reference.name],
            alternates=data[cols.alternates.name],
            comment_text=data[cols.comment_text.name],
            author_name=data.get(cols.author_name.name))
    result = conn.execute(stmt)
    if result.rowcount > 0:
        one_result = result.fetchone()
        col_name_to_val = {
            user_comments.c.id.name: one_result[0],
            user_comments.c.last_modified.name: one_result[1]
        }
        return jsonify(col_name_val_to_response(col_name_to_val, user_comments))
    else:
        raise CRUDError('No Rows', 'No comment was created')


@user_comments_db
def get_vcf_comments(vcf_id, conn, user_comments, data):
    """Return all user comments in the following format:
    {
      "comments": {
        "<row_key STRING>":
           [
             {
              "alternates": "<STRING>",
              "author_name": "<STRING>",
              "comment_text": "<STRING>",
              "contig": "<STRING>",
              "created_date": <DATETIME>,
              "last_modified_timestamp": <INT>,
              "id": <INT>,
              "position": <INT>,
              "reference": "<STRING>",
              "sample_name": "<STRING>",
              "vcf_id": <INT>
            },
            {
              "alternates": "<STRING>",
              ...
            }
          ]
        },
        "<row_key>": {
          ...
        },
    """
    # .c represents all columns
    stmt = select(user_comments.c).where(
        user_comments.c.vcf_id == vcf_id)
    results = conn.execute(stmt)

    # Turn results into a dictionary
    results_map = defaultdict(list)
    for comment in [dict(result) for result in results]:
        row_key = get_row_key(comment, user_comments)
        results_map[row_key].append(col_name_val_to_response(
            comment, user_comments))

    response = {'comments': results_map}
    return jsonify(response)


def get_last_comments(n=5):
    with tables(db, 'user_comments') as (con, user_comments):
        q = select(user_comments.c).order_by(
            desc(user_comments.c.last_modified)).limit(n)
        return [dict(c) for c in con.execute(q).fetchall()]


def get_row_key(comment, table):
    """Each VCF row should have a unique key, and we key rows in our
    JSON comment represention by this value. Also see getRowKey in
    RecordStore.js.
    """
    cols = [table.c.contig.name,
            table.c.position.name,
            table.c.reference.name,
            table.c.alternates.name,
            table.c.sample_name.name]
    return get_key(comment, cols, table)


def get_key(comment, cols, table):
    values = [str(convert_col_value(col, comment[col], table)) \
               for col in cols]
    return ''.join(values)


@user_comments_db(use_transaction=True)
def delete_comment(comment_id, conn, user_comments, data):
    """To delete a comment, format PUT data as:
    {"last_modified_timestamp": <DATETIME>} to prevent clobbering.
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
def update_comment(comment_id, conn, user_comments, data):
    """To update a comment, format PUT data as:
    {"comment_text": "<STRING>",
     "author_name": "<STRING>",
     "last_modified_timestamp": <DATETIME>}

    Here, timestamp represents the timestamp of the comment as last retrieved
    from the DB. It allows us to ensure that multiple API updates don't
    clobber each other.

    Returns the updated last_modified_timestamp timestamp if the update was a
    success.

    Uses a transaction to ensure that this select and update are atomic.
    """
    # Don't allow clobbering due to an out-of-sync client.
    if is_stale(comment_id, conn, user_comments, data):
        return stale_error_response()

    stmt = user_comments.update().where(
        user_comments.c.id == comment_id).returning(
            user_comments.c.last_modified).values(
                comment_text=data[user_comments.c.comment_text.name],
                author_name=data.get(user_comments.c.author_name.name),

                # Update the last_modified timestamp, now that we're actually
                # making a modification.
                last_modified=func.now())
    result = conn.execute(stmt)
    if result.rowcount > 0:
        updated_timestamp = result.fetchone()[0]

        # Return the updated last_modified_timestamp
        col_name_to_val = {user_comments.c.last_modified.name: updated_timestamp}
        return jsonify(col_name_val_to_response(col_name_to_val, user_comments))
    else:
        raise CRUDError('No Rows', 'No comment was updated')


def is_stale(comment_id, conn, user_comments, data):
    """Return True if the comment was updated since the client last loaded it.
    """
    current_last_modified = get_last_modified_timestamp(
        comment_id, conn, user_comments)
    comment_last_modified = int(data[convert_col_name(
        user_comments.c.last_modified.name,
        user_comments)])
    return current_last_modified != comment_last_modified


def stale_error_response():
    return error_response(
        'Stale Comment',
        'Trying to modify a comment when the client is out of sync'
    )


def get_last_modified_timestamp(comment_id, conn, user_comments):
    """Retrieve the last modified timestamp for this comment ID, or
    None if it cannot be retrieved for whatever reason."""
    stmt = select([user_comments.c.last_modified]).where(
        user_comments.c.id == comment_id)
    try:
        result = conn.execute(stmt)
        if result.rowcount > 0:
            return date_as_int(result.fetchone()[0])
    except exc.SQLAlchemyError:
        return None


def convert_col_name(name, user_comments):
    """Map columns in the DB with keys in the JSON response."""
    if name == user_comments.c.last_modified.name:
        return 'last_modified_timestamp'
    if name == user_comments.c.created.name:
        return 'created_date'
    return name


def date_as_int(dt):
    """Get dt represented as microseconds since 1970. jsonify will strip out
    microseconds, so we use this simpler format."""
    delta = dt - datetime.fromtimestamp(0)
    return int(delta.total_seconds() * (10**6))


def convert_col_value(name, value, user_comments):
    """Do any column-specific value conversions."""
    if name == user_comments.c.last_modified.name:
        return date_as_int(value)
    if name == user_comments.c.created.name:
        return value.isoformat()
    return value


def col_name_val_to_response(col_name_to_val, user_comments):
    """Converts a dictionary of DB column names to values into a proper
    response (JSON keys to converted values)."""
    response = {
        convert_col_name(name, user_comments): convert_col_value(
            name, col_name_to_val[name], user_comments)
        for name in col_name_to_val
    }
    return response
