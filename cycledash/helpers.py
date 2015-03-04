"""Module containing helper methods for the app in general."""
import os
import re

from flask import jsonify, request
from werkzeug.utils import secure_filename


RE_CAMELCASE_1 = re.compile('((?!^)[A-Z](?=[a-z0-9][^A-Z])|(?<=[a-z])[A-Z])')
RE_CAMELCASE_2 = re.compile('([a-z]+[0-9]+)([A-Z])')


def underscorize(value):
    """Returns underscored version of a camelCase string.

    Raises ValueError if a value other than a string is passed.
    """
    res = RE_CAMELCASE_1.sub(r'_\1', value)
    res = RE_CAMELCASE_2.sub(r'\1_\2', res)
    return res.lower()


def underscorize_keys(value):
    """Return a dictionary with all keys and sub-keys underscorized.
    """
    return {underscorize(key): underscorize_keys(val)
            if type(val) is dict else val
            for key, val in value.iteritems()}


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
    data = dict(request.json or request.form)
    simplified_dict = parsimonious_dict(data)
    stringval_dict = remove_empty_strings(simplified_dict)
    return underscorize_keys(stringval_dict)


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
