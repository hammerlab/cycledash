from flask import Flask
from flask.ext.sqlalchemy import SQLAlchemy
from flask.ext.cache import Cache


def initialize_application():
    app = Flask(__name__)

    _configure_application(app)

    return app


def _configure_prod_logging(app):
    @app.errorhandler(500)
    def internal_error(exception):
        app.logger.exception(exception)
        return 'Internal Server Error', 500

    import logging
    import sys

    stdout_handler = logging.StreamHandler(sys.stdout)
    stdout_handler.setLevel(logging.WARNING)
    formatter = logging.Formatter("%(asctime)s - %(name)s - %(levelname)s - %(message)s")
    stdout_handler.setFormatter(formatter)
    app.logger.addHandler(stdout_handler)


def _configure_application(app):
    app.config.from_object('config')
    if not app.config.get('DEBUG'):
        _configure_prod_logging(app)


app = initialize_application()
db = SQLAlchemy(app)
cache = Cache(app, config={'CACHE_TYPE': 'simple'})


from cycledash.views import *
