from flask import Flask, jsonify, request
from flask_sqlalchemy import SQLAlchemy
from flask.ext import restful
import humanize


def initialize_application():
    app = Flask(__name__)

    _configure_application(app)
    _configure_logging(app)
    _configure_templates(app)
    _configure_error_handling(app)

    return app


def _configure_logging(app):
    @app.errorhandler(500)
    def internal_error(exception):
        app.logger.exception(exception)
        return 'Internal Server Error', 500

    import logging
    import sys

    stdout_handler = logging.StreamHandler(sys.stdout)
    stdout_handler.setLevel(logging.INFO)
    formatter = logging.Formatter("%(asctime)s - %(name)s - %(levelname)s - %(message)s")
    stdout_handler.setFormatter(formatter)
    app.logger.addHandler(stdout_handler)


def _configure_application(app):
    app.config.from_object('config')


def _configure_templates(app):
    @app.template_filter('humanize_date')
    def humanize_date(time):
        return humanize.naturalday(time)


def _configure_error_handling(app):
    @app.errorhandler(404)
    def json_404(e):
        return jsonify({'message': "{} not found.".format(request.url)}), 404


app = initialize_application()
db = SQLAlchemy(app)
api = restful.Api(app, prefix='/api')


import cycledash.views
