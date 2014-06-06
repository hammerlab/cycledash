from flask import Flask
from flask.ext.sqlalchemy import SQLAlchemy



def initialize_application():
    app = Flask(__name__)

    _configure_application(app)

    return app


def _configure_application(app):
    app.config.from_object('config')


app = initialize_application()
db = SQLAlchemy(app)


from cycledash.views import *
