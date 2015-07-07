"""Helpers for Python tests"""
import base64
import common.helpers
import json
import sqlalchemy
import unittest

from cycledash import bcrypt, app, db
from common.helpers import tables


def create_user(db, username, password, email):
    with common.helpers.tables(db.engine, 'users') as (con, users):
        password_hash = bcrypt.generate_password_hash(password)
        user = users.insert({
            'username': username,
            'password': password_hash,
            'email': email
        }).returning(*users.c).execute().fetchone()
    return user


def insert_user(db, username=None, password=None):
    username = username or 'testuser'
    password = password or 'password'
    email = '{}@example.com'.format(username)
    create_user(db, username, password, email)
    return {'username': username, 'password': password}


def delete_tables(db, table_names):
    """Delete all records from table_name."""
    with tables(db.engine, *table_names) as tpl:
        for tbl in tpl[1:]:
            tbl.delete().execute()

def delete_table(db, table_name):
    delete_tables(db, [table_name])


def delete_all_records(db):
    """Deletes all records in all tables in the given `db`."""
    with tables(db.engine) as (connection,):
        metadata = sqlalchemy.MetaData(bind=connection)
        metadata.reflect()
        # We delete the tables in order of dependency, so that foreign-key
        # relationships don't prevent a table from being deleted.
        for tbl in reversed(metadata.sorted_tables):
            tbl.delete().execute()


class ResourceTest(object):
    """Convenience class adding Authorized header to each request, encoding data as
    JSON.

    If no_auth is set to True on the class, the authorized user isn't created or
    sent with the request.
    """
    app = app
    db = db

    @classmethod
    def setUpClass(cls):
        if not getattr(cls, 'no_auth', False):
            cls.auth = insert_user(cls.db)
        cls.app = cls.app.test_client()

    @classmethod
    def tearDownClass(cls):
        delete_all_records(cls.db)

    def _request(self, method, url, data=None, headers=None, **kwargs):
        assert hasattr(self, 'app'), 'self.app must be set'
        if headers is None:
                headers = {}
        if self.auth:
            username = self.auth['username']
            password = self.auth['password']
            encoded = base64.encodestring(':'.join([username, password]))[:-1]
            headers['Authorization'] = 'Basic {}'.format(encoded)
        meth = getattr(self.app, method)
        return meth(url,
                    headers=headers,
                    data=json.dumps(data) if data else None,
                    **kwargs)

    def post(self, url, data=None, headers=None, **kwargs):
        return self._request('post', url, data, headers, **kwargs)

    def get(self, url, data=None, headers=None, **kwargs):
        return self._request('get', url, data, headers, **kwargs)

    def put(self, url, data=None, headers=None, **kwargs):
        return self._request('put', url, data, headers, **kwargs)

    def delete(self, url, data=None, headers=None, **kwargs):
        return self._request('delete', url, data, headers, **kwargs)

    def header(self, url, data=None, headers=None, **kwargs):
        return self._request('header', url, data, headers, **kwargs)
