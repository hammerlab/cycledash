from flask import Flask



def initialize_application():
    app = Flask(__name__)

    _configure_application(app)

    return app


def _configure_application(app):
    app.config.from_object('config')



app = initialize_application()

from cycledash.database import db
from cycledash.views import *
