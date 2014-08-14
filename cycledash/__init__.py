from flask import Flask
from flask.ext.sqlalchemy import SQLAlchemy
from flask.ext.cache import Cache


def initialize_application():
    app = Flask(__name__)

    _configure_application(app)

    return app


def _configure_application(app):
    app.config.from_object('config')


app = initialize_application()
db = SQLAlchemy(app)
cache = Cache(app, config={'CACHE_TYPE': 'simple'})


from cycledash.views import *
