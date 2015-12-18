from flask import Flask, jsonify, request, make_response, current_app
import flask.json
from flask_sqlalchemy import SQLAlchemy
import flask_restful as restful
import flask_login as login
import flask_bcrypt as bcrypt
import humanize
import logging
import sys


def initialize_application():
    app = Flask(__name__)

    _configure_application(app)
    _configure_logging(app)
    _configure_templates(app)
    _configure_extensions(app)

    return app


def _configure_extensions(app):
    global db, api, login_manager, bcrypt
    db = SQLAlchemy(app)
    api = restful.Api(app, prefix='/api', catch_all_404s=True)

    def output_json(data, status_code, headers=None):
        """A JSON serializing request maker."""
        settings = {}
        if current_app.debug:
            settings = {'indent': 4, 'sort_keys': True}
        dumped = flask.json.dumps(data, **settings) + '\n'
        resp = flask.make_response(dumped, status_code)
        resp.headers.extend(headers or {})
        return resp

    # We primarily do this so that the JSON serializer in flask-restful can
    # handle datetime objects. There's a hook to do this in the upcoming
    # release of flask-restful, but as of 0.3.3, it's not exposed to the user.
    api.representations = {
        'application/json': output_json
    }
    bcrypt = bcrypt.Bcrypt(app)
    login_manager = login.LoginManager()
    login_manager.init_app(app)


def _configure_logging(app):
    stdout_handler = logging.StreamHandler(sys.stdout)
    stdout_handler.setLevel(logging.INFO)
    formatter = logging.Formatter("""\
[%(levelname)s] %(asctime)s - %(name)s
%(pathname)s:%(lineno)d
%(message)s""")
    stdout_handler.setFormatter(formatter)
    app.logger.addHandler(stdout_handler)
    app.logger.setLevel(logging.INFO)


def _configure_application(app):
    app.config.from_object('config')


def _configure_templates(app):
    @app.template_filter('humanize_date')
    def humanize_date(time):
        return humanize.naturalday(time)


app = initialize_application()


import cycledash.views
import cycledash.auth
