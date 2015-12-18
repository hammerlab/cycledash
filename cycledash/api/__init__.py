from collections import OrderedDict
from flask import request
import flask_restful
from flask_login import current_user
import functools
import voluptuous

from cycledash import login_manager
from cycledash.auth import check_login
from cycledash.helpers import prepare_request_data, camelcase_dict


class Resource(flask_restful.Resource, object):
    """Extends Resource by adding an authentication check for basic auth or
    valid session cokie.
    """
    def __init__(self, *args, **kwargs):
        self.require_auth = getattr(self, 'require_auth', False)
        super(Resource, self).__init__(*args, **kwargs)

    def dispatch_request(self, *args, **kwargs):
        if self.require_auth:
            authorized = False
            if login_manager._login_disabled:
                # This is used for tests.
                authorized = True
            elif current_user.is_authenticated():
                authorized = True
            elif request.authorization:
                username = request.authorization.username
                password = request.authorization.password
                if check_login(username, password):
                    authorized = True
            if not authorized:
                auth_msg = 'Correct username/password required.'
                return flask_restful.abort(401, message=auth_msg)
        return super(Resource, self).dispatch_request(*args, **kwargs)


def marshal(data, schema, envelope=None):
    """Takes raw data and a schema to output, and applies the schema to the
    object(s).

    Args:
       data: The actual object(s) from which the fields are taken from. A dict,
             list, or tuple.
       schema: A voluptuous.Schema of whose keys will make up the final
               serialized response output
       envelope: optional key that will be used to envelop the serialized
                 response
    """
    items = None
    if isinstance(data, (list, tuple)):
        items = [marshal(d, schema) for d in data]
    elif isinstance(data, dict):
        items = schema(data)
    else:
        raise ValueError('`data` must be a list, tuple, or dict.')
    if envelope:
        items = [(envelope, items)]
    return OrderedDict(items)


def marshal_with(schema, envelope=None):
    """Wraps flask-restful's marshal_with to transform the returned object to
    have camelCased keys."""
    def decorator(f):
        @functools.wraps(f)
        def wrapper(*args, **kwargs):
            resp = f(*args, **kwargs)
            if not isinstance(resp, tuple):
                content = resp
                resp = (content, 200, {})
            content = marshal(resp[0], schema, envelope=envelope)
            content = camelcase_dict(content)
            return (content,) + resp[1:]
        return wrapper
    return decorator


def validate_with(schema):
    """Wraps a get/post/put/delete method in a Flask-restful Resource, and
    validates the request body with the given Voluptuous schema. If it passed,
    sets `validated_body` on the request object, else abort(400) with helpful
    error messages.
    """
    def decorator(f):
        @functools.wraps(f)
        def wrapper(*args, **kwargs):
            if not (request.json or request.data or request.form):
                flask_restful.abort(400, message='Validation error.',
                                        errors=['No data provided.'])
            try:
                data = schema(prepare_request_data(request))
            except voluptuous.MultipleInvalid as err:
                flask_restful.abort(400,
                                        message='Validation error.',
                                        errors=[str(e) for e in err.errors])
            setattr(request, 'validated_body', data)
            return f(*args, **kwargs)
        return wrapper
    return decorator


import projects, bams, runs, genotypes, tasks, comments, ga4gh_wrapper
