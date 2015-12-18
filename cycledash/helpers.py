"""Module containing helper methods for the app in general."""
import functools
import json
import os
import re
from urlparse import urlparse, urljoin

from cycledash import db
from common.helpers import tables, to_epoch

from flask import jsonify, request, url_for, redirect
import flask_restful, flask_restful.fields
import voluptuous
from werkzeug.utils import secure_filename


RE_CAMELCASE_1 = re.compile('((?!^)[A-Z](?=[a-z0-9][^A-Z])|(?<=[a-z])[A-Z])')
RE_CAMELCASE_2 = re.compile('([a-z]+[0-9]+)([A-Z])')


def underscorize(value):
    """Returns underscored version of a camelCase string.

    e.g. camelCase => camel_case

    Raises ValueError if a value other than a string is passed.
    """
    res = RE_CAMELCASE_1.sub(r'_\1', value)
    res = RE_CAMELCASE_2.sub(r'\1_\2', res)
    return res.lower()


def camelcase(value):
    """Returns camelCased version of a under_scored string.

    Raises ValueError if a value other than a string is passed.
    """
    parts = value.split('_')
    parts = [p.capitalize() for p in parts]
    cameled = ''.join(parts)
    return cameled[0].lower() + cameled[1:]


def underscorize_dict(value):
    """Return a dictionary with all keys and sub-keys underscorized.

    e.g. camelCase => camel_case
    """
    return {underscorize(key): underscorize_dict(val)
            if isinstance(val, dict) else val
            for key, val in value.iteritems()}


def camelcase_dict(value):
    """Return a dictionary with all keys and sub-keys camelCased."""
    if isinstance(value, list):
        return [camelcase_dict(o) for o in value]
    elif isinstance(value, dict):
        return {camelcase(key): camelcase_dict(val)
                for key, val in value.iteritems()}
    return value


def parsimonious_dict(d):
    """Return dict without keyvals for empty vals, destructures seqs of len 1.

    Used to tidy up ImmutableMultiDicts used in Flask's request.{form,json}.
    """
    return {key: val[0]
            if isinstance(val, list) and len(val) == 1 else val
            for key, val in dict(d).iteritems()
            if not hasattr(val, '__len__') or len(val) > 0}


def remove_empty_strings(d):
    """Return dict without empty string vals."""
    return {key: val
            for key, val in dict(d).iteritems()
            if (len(val) > 0 if isinstance(val, basestring) else True)}


def prepare_request_data(request):
    """Return a dictionary taken from Flask's request.form or request.json in a
    more easily usable form. That is, removes empty strings and empty lists; if
    a list is of length 0, it is removed. If it is of length 1, it is
    deconstructed. All keys are "underscorized" from camelCase.
    """
    data = dict(request.json or request.form or json.loads(request.data))
    simplified_dict = parsimonious_dict(data)
    stringval_dict = remove_empty_strings(simplified_dict)
    return underscorize_dict(stringval_dict)


def get_where(table_name, db, **kwargs):
    """Returns the first record in the table which matches the criteria in
    kwargs.

    kwargs is a dict of column_name: column_value.
    """
    with tables(db.engine, table_name) as (_, table):
        q = table.select()
        for key, val in kwargs.iteritems():
            q = q.where(table.c[key] == val)
        obj = q.execute().fetchone()
    if obj:
        return dict(obj)


def get_id_where(table_name, db, **kwargs):
    """Returns the id of the first record in the table which matches the
    criteria in kwargs.

    kwargs is a dict of column_name: column_value.
    """
    obj = get_where(table_name, db, **kwargs)
    if obj:
        return obj.get('id')


def update_object(obj, update):
    """Sets attributes for all key, vals in update on obj.

    Used to batch-update values on SQLAlchemy objects.

    Returns obj."""
    for key, value in update.iteritems():
        obj.__setattr__(key, value)
    return obj


def get_secure_unique_filename(filename, tmp_dir):
    """Returns a safe, absolute path to a non-existent file.

    This is just like werkzeug.secure_filename, except that it will modify the
    file name to ensure that the file it returns doesn't already exists.
    """
    # keep adding different digits to the file name until it doesn't exist.
    count = 0
    while True:
        prefix = str(count) if count else ''
        dest_filename = secure_filename(prefix + filename)
        path = os.path.join(tmp_dir, dest_filename)
        if not os.path.exists(path):
            return path
        count += 1


def success_response():
    response = jsonify({'success': True})
    return response


def error_response(error, message):
    response = jsonify({'error': error, 'message': message})
    response.status_code = 400
    return response


# See http://flask.pocoo.org/snippets/45/
def request_wants_json():
    """Is a JSON response most appropriate for the current request?"""
    best = request.accept_mimetypes.best_match(['application/json', 'text/html'])
    return (best == 'application/json' and
        request.accept_mimetypes[best] > request.accept_mimetypes['text/html'])


def is_safe_url(target):
    """Make sure a redirect target is to the same server

    This is used to prevent open redirects.

    cf. http://flask.pocoo.org/snippets/62/."""
    ref_url = urlparse(request.host_url)
    test_url = urlparse(urljoin(request.host_url, target))
    return test_url.scheme in ('http', 'https') and \
           ref_url.netloc == test_url.netloc


def safely_redirect_to_next(fallback_endpoint, **values):
    """Redirect to `next` endpoint if safe, else to `fallback_endpoint`."""
    target = request.form.get('next')
    if not target or not is_safe_url(target):
        target = url_for(fallback_endpoint, **values)
    return redirect(target)


def abort_if_none_for(obj_name):
    def abort_if_none(obj, obj_id):
        """Abort request with a 404 if object is None."""
        if obj is None:
            flask_restful.abort(
                404,
                message='No {} with id={} found.'.format(obj_name, obj_id))
        else:
            return obj
    return abort_if_none

class CollisionError(Exception):
    pass
