"""Module to manage user authentication and identification."""
from flask import request, redirect, render_template
from flask_login import login_user, logout_user
from sqlalchemy import exc
import voluptuous
import base64

from cycledash import db, bcrypt, login_manager
from cycledash.helpers import prepare_request_data, safely_redirect_to_next
from common.helpers import tables
from validations import RegisterUser, LoginUser


login_manager.login_view = 'login'

def load_user(user_id):
    with tables(db.engine, 'users') as (con, users):
        user = users.select(users.c.id == user_id).execute().fetchone()
        if user:
            return wrap_user(user)

login_manager.user_loader(load_user)


def login():
    """Attempt to login a user from the current request.

    Return the user if successful, else raise."""
    try:
        data = LoginUser(prepare_request_data(request))
    except voluptuous.MultipleInvalid as err:
        render_template('login.html', errors=str(err))
    user = check_login(data['username'], data['password'])
    if user:
        login_user(user)
        return safely_redirect_to_next('home')
    return render_template('login.html', errors='No such user.')


def check_login(username, password):
    """Returns the user if it exists and the password is correct, else None."""
    if not (username and password):
        return None
    user = None
    with tables(db.engine, 'users') as (con, users):
        user = users.select(users.c.username == username).execute().fetchone()
    if user:
        pw_hash = str(user['password'])
        candidate = str(password)
        if bcrypt.check_password_hash(pw_hash, candidate):
            return wrap_user(user)
    return None


class User(dict):
    def is_authenticated(self):
        return True

    def is_active(self):
        return True

    def is_anonymous(self):
        return False

    def get_id(self):
        return unicode(self['id'])

class AnonymousUser(User):
    def __init__(self):
        self['id'] = None
        self['username'] = u'Anonymous'

    def is_active(self):
        return False

    def is_anonymous(self):
        return True

    def is_authenticated(self):
        return False

login_manager.anonymous_user = AnonymousUser

def wrap_user(user):
    """Wraps user record returned from the database in a class providing methods
    that flask-login expects.
    """
    return User(user)


def logout():
    """Logs the logged in user, if any, out."""
    logout_user()
    return redirect('about')


def register():
    """Register user from current request.

    Returns the user if successful, else raise."""
    errors = None
    user = None
    try:
        data = RegisterUser(prepare_request_data(request))
        if data.get('password1') != data.get('password2'):
            errors = 'Passwords must match.'
    except voluptuous.MultipleInvalid as err:
        errors = str(err)
    if not errors:
        with tables(db.engine, 'users') as (con, users):
            try:
                password_hash = bcrypt.generate_password_hash(
                    request.form['password1'])
                user = users.insert({
                    'username': request.form['username'],
                    'password': password_hash,
                    'email': request.form['email']
                }).returning(*users.c).execute().fetchone()
            except exc.IntegrityError as e:
                errors = "Can\'t create user: " + str(e)
        if user:
            user = wrap_user(user)
            login_user(user)
            return redirect('/')
    return render_template('register.html', errors=errors)

def check_login_from_key(api_key):
    username, password = api_key.split(":")
    return check_login(username, password)

def load_user_from_request(request):
    """Support for basic authorization."""
    # next, try to login using Basic Auth
    api_key = request.headers.get('Authorization')
    if api_key:
        api_key = api_key.replace('Basic ', '', 1)
        try:
            api_key = base64.b64decode(api_key)
        except TypeError:
            pass
        user = check_login_from_key(api_key)
        if user:
            return user

    # finally, return None if both methods did not login the user
    return None

login_manager.request_loader(load_user_from_request)
