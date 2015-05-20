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
        r = self.app.post('/api/projects',
                          data=json.dumps({'name': self.PROJECT_NAME,
                                           'notes': self.NOTES}))
        assert r.status_code == 201
        assert isinstance(json.loads(r.data)['id'], int)
        assert json.loads(r.data)['name'] == self.PROJECT_NAME
        assert json.loads(r.data)['notes'] == self.NOTES

    def test_create_duplicate_project_name(self):
        create_project_with_name(self.PROJECT_NAME)
        r = self.app.post('/api/projects',
                          data=json.dumps({'name': self.PROJECT_NAME}))
        assert r.status_code == 409
        assert 'duplicate key' in json.loads(r.data)['errors'][0]

    def test_create_project_without_name(self):
        r = self.app.post('/api/projects',
                          data=json.dumps({'notes': 'anything'}))
        assert r.status_code == 400
        assert "required key not provided @ data['name']" == json.loads(r.data)['errors'][0]

    def test_get_project(self):
        project = create_project_with_name(self.PROJECT_NAME)
        r = self.app.get('/api/projects/{}'.format(project['id']))
        assert r.status_code == 200
        assert json.loads(r.data)['id'] == project['id']
        assert json.loads(r.data)['name'] == project['name']
        assert json.loads(r.data)['notes'] == project['notes']


    def test_get_projects(self):
        project = create_project_with_name(self.PROJECT_NAME)
        r = self.app.get('/api/projects')
        projects = json.loads(r.data)['projects']
        assert r.status_code == 200
        assert isinstance(projects, list)
        assert projects[0]['name'] == self.PROJECT_NAME


    def test_update_project(self):
        project = create_project_with_name(self.PROJECT_NAME)
        r = self.app.put('/api/projects/{}'.format(project['id']),
                         data=json.dumps({'notes': self.NEW_NOTES}))
        assert r.status_code == 200
        assert json.loads(r.data)['id'] == project['id']
        assert json.loads(r.data)['name'] == self.PROJECT_NAME
        assert json.loads(r.data)['notes'] == self.NEW_NOTES


    def test_delete_project(self):
        project = create_project_with_name(self.PROJECT_NAME)
        r = self.app.delete('/api/projects/{}'.format(project['id']))
        assert r.status_code == 200
        assert json.loads(r.data)['id'] == project['id']
        assert json.loads(r.data)['name'] == self.PROJECT_NAME
        r = self.app.get('/api/projects/{}'.format(project['id']))
        assert r.status_code == 404
