from flask import request
import flask.ext.restful
from flask.ext.login import current_user

from cycledash import login_manager
from cycledash.auth import check_login


class Resource(flask.ext.restful.Resource, object):
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
                return flask.ext.restful.abort(401, message=auth_msg)
        return super(Resource, self).dispatch_request(*args, **kwargs)


import projects, bams, runs, genotypes, tasks, comments
