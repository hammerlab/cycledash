import nose

import json

from cycledash import app, db
from common.helpers import tables


def create_project_with_name(name):
    with tables(db.engine, 'projects') as (con, projects):
        res = projects.insert({'name': name}).returning(*projects.c).execute()
        return dict(res.fetchone())


class TestProjectAPI(object):
    PROJECT_NAME = 'TEST PROJECT'
    NOTES = 'these are some project notes'
    NEW_NOTES = 'these are new project notes'

    def setUp(self):
        self.app = app.test_client()

    def tearDown(self):
        with tables(db.engine, 'projects') as (con, projects):
            res = projects.delete(projects.c.name == self.PROJECT_NAME).execute()

    def test_create_project(self):
        r = self.app.post('/projects',
                          data=json.dumps({'name': self.PROJECT_NAME,
                                           'notes': self.NOTES}),
                          headers={'content-type': 'application/json',
                                   'accept': 'application/json'})

        assert r.status_code == 201
        assert isinstance(json.loads(r.data)['id'], int)
        assert json.loads(r.data)['name'] == self.PROJECT_NAME
        assert json.loads(r.data)['notes'] == self.NOTES

    def test_create_duplicate_project_name(self):
        create_project_with_name(self.PROJECT_NAME)
        r = self.app.post('/projects',
                          data=json.dumps({'name': self.PROJECT_NAME}),
                          headers={'content-type': 'application/json',
                                   'accept': 'application/json'})

        assert r.status_code == 400
        assert "Could not create project" in json.loads(r.data)['error']

    def test_create_project_without_name(self):
        r = self.app.post('/projects',
                          data=json.dumps({'notes': 'anything'}),
                          headers={'content-type': 'application/json',
                                   'accept': 'application/json'})

        assert r.status_code == 400
        assert 'Project validation' in json.loads(r.data)['error']
        assert 'required key not provided' in r.data
        assert 'name' in json.loads(r.data)['message'][0]

    def test_get_project(self):
        project = create_project_with_name(self.PROJECT_NAME)
        r = self.app.get('/projects/{}'.format(project['id']),
                         headers={'content-type': 'application/json',
                                  'accept': 'application/json'})

        assert r.status_code == 200
        assert json.loads(r.data)['id'] == project['id']
        assert json.loads(r.data)['name'] == project['name']
        assert json.loads(r.data)['notes'] == project['notes']


    def test_get_projects(self):
        project = create_project_with_name(self.PROJECT_NAME)
        r = self.app.get('/projects',
                         headers={'content-type': 'application/json',
                                  'accept': 'application/json'})

        projects = json.loads(r.data)['projects']

        assert r.status_code == 200
        assert isinstance(projects, list)
        assert projects[0]['name'] == self.PROJECT_NAME


    def test_update_project(self):
        project = create_project_with_name(self.PROJECT_NAME)
        r = self.app.put('/projects/{}'.format(project['id']),
                         data=json.dumps({'notes': self.NEW_NOTES}),
                         headers={'content-type': 'application/json',
                                  'accept': 'application/json'})

        assert r.status_code == 200
        assert json.loads(r.data)['id'] == project['id']
        assert json.loads(r.data)['name'] == self.PROJECT_NAME
        assert json.loads(r.data)['notes'] == self.NEW_NOTES


    def test_delete_project(self):
        project = create_project_with_name(self.PROJECT_NAME)
        r = self.app.delete('/projects/{}'.format(project['id']),
                            headers={'content-type': 'application/json',
                                     'accept': 'application/json'})

        assert r.status_code == 200
        assert json.loads(r.data)['id'] == project['id']
        assert json.loads(r.data)['name'] == self.PROJECT_NAME

        r = self.app.get('/projects/{}'.format(project['id']),
                         headers={'content-type': 'application/json',
                                  'accept': 'application/json'})

        assert r.status_code == 404
