from flask import Flask, jsonify, request
from flask_sqlalchemy import SQLAlchemy
from flask.ext import restful, login, bcrypt
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
