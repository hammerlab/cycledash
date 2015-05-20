import mock
import nose
import json

from cycledash import app, db
from common.helpers import tables

from test_projects_api import create_project_with_name
from test_bams_api import create_bam_with_name


def create_run_with_uri(project_id, uri):
    with tables(db.engine, 'vcfs') as (con, runs):
        res = runs.insert(
            {'uri': uri, 'project_id': project_id}
        ).returning(*runs.c).execute()
        return dict(res.fetchone())


class TestRunsAPI(object):
    NOTES = '--with-awesome=9001'
    PROJECT_NAME = 'TEST PROJECT BAM'
    BAM_NAME = 'something bam name'
    BAM_PATH = 'hdfs://somebam.bam'
    RUN_PATH = 'hdfs://somevcf.vcf'

    def setUp(self):
        self.app = app.test_client()
        self.project = create_project_with_name(self.PROJECT_NAME)
        self.bam = create_bam_with_name(self.project['id'], self.PROJECT_NAME, uri=self.BAM_PATH)

    def tearDown(self):
        with tables(db.engine, 'projects', 'bams', 'vcfs') as (con, projects, bams, runs):
            runs.delete().execute()
            bams.delete().execute()
            projects.delete().execute()

    @mock.patch('workers.runner', autospec=True)
    @mock.patch('workers.indexer', autospec=True)
    def test_create_run(self, *args):
        caller_name = 'The Testing Caller'
        r = self.app.post('/api/runs',
                          data=json.dumps({'callerName': caller_name,
                                           'notes': self.NOTES,
                                           'normalBamId': self.bam['id'],
                                           'tumorBamId': self.bam['id'],
                                           'uri': self.RUN_PATH,
                                           'projectId': self.project['id']}))
        assert r.status_code == 201
        assert isinstance(json.loads(r.data)['id'], int)
        assert json.loads(r.data)['projectId'] == self.project['id']
        assert json.loads(r.data)['normalBamId'] == self.bam['id']
        assert json.loads(r.data)['tumorBamId'] == self.bam['id']
        assert json.loads(r.data)['uri'] == self.RUN_PATH
        assert json.loads(r.data)['notes'] == self.NOTES
        assert json.loads(r.data)['callerName'] == caller_name

    @mock.patch('workers.runner', autospec=True)
    @mock.patch('workers.indexer', autospec=True)
    def test_create_run_with_project_and_bam_names(self, *args):
        r = self.app.post('/api/runs',
                          data=json.dumps({'normalBamUri': self.BAM_PATH,
                                           'uri': self.RUN_PATH,
                                           'projectName': self.project['name']}))
        assert r.status_code == 201
        assert isinstance(json.loads(r.data)['id'], int)
        assert json.loads(r.data)['projectId'] == self.project['id']
        assert json.loads(r.data)['normalBamId'] == self.bam['id']
        assert json.loads(r.data)['uri'] == self.RUN_PATH

    def test_create_run_without_project(self):
        r = self.app.post('/api/runs',
                          data=json.dumps({'callerName': 'WHOA',
                                           'uri': self.RUN_PATH}))
        assert r.status_code == 409
        assert 'is required' in json.loads(r.data)['errors'][0]
        assert 'Validation error' in json.loads(r.data)['message']

    def test_create_run_with_nonexistent_project(self):
        r = self.app.post('/api/runs',
                          data=json.dumps({'uri': self.RUN_PATH,
                                           'projectId': 1000000000}))
        assert r.status_code == 404
        assert 'not found' in json.loads(r.data)['message']

    # genotypes.spec is mocked as we aren't running the workers in this test,
    # and getting a run without valid vcf_header currently errors out. Issue
    # #592 is tracking this.
    @mock.patch('cycledash.genotypes.spec', lambda *args, **kwargs: '')
    def test_get_run(self, *args):
        run = create_run_with_uri(self.project['id'], self.RUN_PATH)
        r = self.app.get('/api/runs/{}'.format(run['id']))
        assert r.status_code == 200
        assert json.loads(r.data)['id'] == run['id']
        assert json.loads(r.data)['uri'] == run['uri']

    def test_get_runs(self):
        run1 = create_run_with_uri(self.project['id'], self.RUN_PATH)
        run2 = create_run_with_uri(self.project['id'], 'hdfs://otherpath.vcf')
        r = self.app.get('/api/runs')
        runs = json.loads(r.data)['runs']
        assert r.status_code == 200
        assert isinstance(runs, list)
        assert len(runs) == 2
        assert runs[1]['uri'] == run1['uri']  # in descending order
        assert runs[0]['uri'] == run2['uri']

    def test_update_run(self):
        new_caller_name = 'NEW NAME!'
        run = create_run_with_uri(self.project['id'], self.RUN_PATH)
        r = self.app.put('/api/runs/{}'.format(run['id']),
                         data=json.dumps({'callerName': new_caller_name}))
        assert r.status_code == 200
        assert json.loads(r.data)['id'] == run['id']
        assert json.loads(r.data)['callerName'] == new_caller_name

    def test_delete_run(self):
        run = create_run_with_uri(self.project['id'], self.RUN_PATH)
        r = self.app.delete('/api/runs/{}'.format(run['id']))
        assert r.status_code == 200
        assert json.loads(r.data)['id'] == run['id']
        r = self.app.get('/api/runs/{}'.format(run['id']))
        assert r.status_code == 404
