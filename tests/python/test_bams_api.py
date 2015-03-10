import nose

import json

from cycledash import app, db
from common.helpers import tables

from test_projects_api import create_project_with_name


def create_bam_with_name(project_id, name):
    with tables(db, 'bams') as (con, bams):
        res = bams.insert(
            {'name': name,
             'project_id': project_id,
             'uri': 'hdfs://testbam.bam'}).returning(*bams.c).execute()
        return dict(res.fetchone())


class TestBamsAPI(object):
    PROJECT_NAME = 'TEST PROJECT BAM'
    BAM_NAME = 'something bam name'
    PATH = 'hdfs://somebam.bam'

    def setUp(self):
        self.app = app.test_client()
        self.project = create_project_with_name(self.PROJECT_NAME)

    def tearDown(self):
        with tables(db, 'projects', 'bams') as (con, projects, bams):
            bams.delete(bams.c.name == self.BAM_NAME).execute()
            projects.delete(projects.c.name == self.PROJECT_NAME).execute()


    def test_create_bam(self):
        NOTES = 'random notes'
        TISSUES = 'left ovary etc'
        r = self.app.post('/bams',
                          data=json.dumps({'name': self.BAM_NAME,
                                           'notes': NOTES,
                                           'tissues': TISSUES,
                                           'uri': self.PATH,
                                           'project_id': self.project['id']}),
                          headers={'content-type': 'application/json',
                                   'accept': 'application/json'})

        assert r.status_code == 201
        assert isinstance(json.loads(r.data)['id'], int)
        assert json.loads(r.data)['project_id'] == self.project['id']
        assert json.loads(r.data)['name'] == self.BAM_NAME
        assert json.loads(r.data)['tissues'] == TISSUES
        assert json.loads(r.data)['notes'] == NOTES
        assert json.loads(r.data)['uri'] == self.PATH

    def test_create_bam_with_project_name(self):
        r = self.app.post('/bams',
                          data=json.dumps({'name': self.BAM_NAME,
                                           'uri': self.PATH,
                                           'project_name': self.project['name']}),
                          headers={'content-type': 'application/json',
                                   'accept': 'application/json'})

        assert r.status_code == 201
        assert isinstance(json.loads(r.data)['id'], int)
        assert json.loads(r.data)['project_id'] == self.project['id']
        assert json.loads(r.data)['name'] == self.BAM_NAME
        assert json.loads(r.data)['uri'] == self.PATH

    def test_create_bam_without_project(self):
        r = self.app.post('/bams',
                          data=json.dumps({'name': self.BAM_NAME,
                                           'uri': self.PATH}),
                          headers={'content-type': 'application/json',
                                   'accept': 'application/json'})

        assert r.status_code == 400
        assert 'BAM validation' in json.loads(r.data)['error']
        assert 'project' in json.loads(r.data)['message'][0]

    def test_create_bam_with_nonexistent_project(self):
        r = self.app.post('/bams',
                          data=json.dumps({'name': self.BAM_NAME,
                                           'uri': self.PATH,
                                           'project_id': 10000000000000000000}),
                          headers={'content-type': 'application/json',
                                   'accept': 'application/json'})

        assert r.status_code == 400
        assert 'not found' in json.loads(r.data)['error']

    def test_get_bam(self):
        bam = create_bam_with_name(self.project['id'], self.BAM_NAME)

        r = self.app.get('/bams/{}'.format(bam['id']),
                headers={'content-type': 'application/json',
                         'accept': 'application/json'})

        assert r.status_code == 200
        assert json.loads(r.data)['id'] == bam['id']
        assert json.loads(r.data)['name'] == bam['name']


    def test_get_bams(self):
        bam = create_bam_with_name(self.project['id'], self.BAM_NAME)
        r = self.app.get('/bams',
                         headers={'content-type': 'application/json',
                                  'accept': 'application/json'})

        assert r.status_code == 200

        bams = json.loads(r.data)['bams']
        assert isinstance(bams, list)
        assert bams[0]['name'] == bam['name']


    def test_update_bam(self):
        bam = create_bam_with_name(self.project['id'], self.BAM_NAME)

        NEW_NOTES = 'these are new BAM notes'
        r = self.app.put('/bams/{}'.format(bam['id']),
                         data=json.dumps({'notes': NEW_NOTES}),
                         headers={'content-type': 'application/json',
                                  'accept': 'application/json'})

        assert r.status_code == 200
        assert json.loads(r.data)['id'] == bam['id']
        assert json.loads(r.data)['name'] == bam['name']
        assert json.loads(r.data)['notes'] == NEW_NOTES


    def test_delete_bam(self):
        bam = create_bam_with_name(self.project['id'], self.BAM_NAME)
        r = self.app.delete('/bams/{}'.format(bam['id']),
                            headers={'content-type': 'application/json',
                                     'accept': 'application/json'})

        assert r.status_code == 200
        assert json.loads(r.data)['id'] == bam['id']
        assert json.loads(r.data)['name'] == bam['name']

        r = self.app.get('/bams/{}'.format(bam['id']),
                         headers={'content-type': 'application/json',
                                  'accept': 'application/json'})

        assert r.status_code == 404
