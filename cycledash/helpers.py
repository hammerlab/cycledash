"""Module containing helper methods for the app in general.
"""
import re



def compose(*funcs, **kwargs):
    """Return a function composed of funcs from left to right.

    If rev is passed & truthy, composes functions from right to left.
    """
    if kwargs.get('rev'): funcs = funcs[::-1]
    def fn(*args, **kwargs):
        fn = funcs[0]
        res = fn(*args, **kwargs)
        for fn in funcs[1:]:
            res = fn(res)
        return res
    return fn


def underscorize(value):
    """Returs underscored version of a camelCase string.

    Raises ValueError if a value other than a string is passed.
    """
    if isinstance(value, basestring):
        return re.sub(r'([A-Z])', r'_\1', value).lower()
    else:
        raise ValueError("'value' must be one of str, basestring, unicode.")


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
    return {key: val
            if len(val) > 1 else val[0]
            for key, val in dict(d).iteritems() if len(val) > 0}


def remove_empty_strings(d):
    """Return dict without empty string vals.
    """
    return {key: val
            for key, val in dict(d).iteritems()
            if (len(val) > 0 if isinstance(val, basestring) else True)}


def prepare_request_data(request):
    """Return a dictionary taken from Flask's request.form or request.json in a
    more easily usable form. That is, removes empty strings and empty lists; if
    a list is of length 0, it is removed. If it is of length 1, it is
    deconstructed. All keys are "underscorized" from camelCase.
    """
    data = request.json or request.form
    return compose(dict, parsimonious_dict, underscorize_keys)(data)
