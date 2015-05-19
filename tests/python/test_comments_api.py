import datetime
import mock
import nose
import json

from cycledash import app, db
from common.helpers import tables, from_epoch

from test_projects_api import create_project_with_name
from test_runs_api import create_run_with_uri


def create_comment_with_text(run_id, text):
    with tables(db.engine, 'user_comments') as (con, comments):
        res = comments.insert({
            'comment_text': text,
            'vcf_id': run_id,
            'sample_name': 'samp1',
            'contig': 'chr101',
            'position': 909090,
            'reference': 'Q',
            'alternates': 'WHOA'
            }).returning(*comments.c).execute()
        return dict(res.fetchone())


class TestCommentsAPI(object):
    def setUp(self):
        self.app = app.test_client()
        self.project = create_project_with_name('project')
        self.run = create_run_with_uri(self.project['id'], 'hdfs://somevcf.vcf')

    def tearDown(self):
        with tables(db.engine, 'vcfs', 'projects', 'user_comments') as (con, runs, projects, comments):
            comments.delete().execute()
            runs.delete().execute()
            projects.delete().execute()

    def test_create_comment(self):
        comment_text = 'The Testing Caller'
        r = self.app.post('/api/runs/{}/comments'.format(self.run['id']),
                          data=json.dumps({'sampleName': 'samp',
                                           'contig': 'chr2',
                                           'position': 123,
                                           'reference': 'C',
                                           'alternates': 'A,G',
                                           'commentText': comment_text,
                                           'authorName': 'Tester McGee'}))
        data = json.loads(r.data)
        assert r.status_code == 201
        assert isinstance(json.loads(r.data)['id'], int)
        assert data['vcfId'] == self.run['id']
        assert data['sampleName'] == 'samp'
        assert data['authorName'] == 'Tester McGee'
        assert data['commentText'] == comment_text
        assert data['reference'] == 'C'
        assert data['alternates'] == 'A,G'
        assert data['position'] == 123
        assert data['contig'] == 'chr2'

    def test_get_comment(self):
        text = 'this is some comment text'
        comment = create_comment_with_text(self.run['id'], text)
        r = self.app.get('/api/runs/{}/comments/{}'.format(
            self.run['id'], comment['id']))
        data = json.loads(r.data)
        assert r.status_code == 200
        assert data['id'] == comment['id']
        assert data['commentText'] == comment['comment_text']

    def test_get_comments(self):
        comment1 = create_comment_with_text(self.run['id'], 'comment1')
        comment2 = create_comment_with_text(self.run['id'], 'comment2')
        r = self.app.get('/api/runs/{}/comments'.format(self.run['id']))
        comments = json.loads(r.data)['comments']
        assert r.status_code == 200
        assert isinstance(comments, list)
        assert len(comments) == 2
        assert comments[1]['commentText'] == comment1['comment_text']  # in descending order
        assert comments[0]['commentText'] == comment2['comment_text']

    def test_update_comment(self):
        new_text = 'NEW TEXT!'
        new_author = 'NEW AUTHOR!'
        comment = create_comment_with_text(self.run['id'], 'some text')
        r = self.app.put('/api/runs/{}/comments/{}'.format(self.run['id'], comment['id']),
                         data=json.dumps({'commentText': new_text,
                                          'authorName': new_author,
                                          'last_modified': from_epoch(comment['last_modified'])}))
        assert r.status_code == 200
        assert json.loads(r.data)['id'] == comment['id']
        assert json.loads(r.data)['commentText'] == new_text
        assert json.loads(r.data)['authorName'] == new_author

    def test_update_comment_without_timestamp(self):
        comment = create_comment_with_text(self.run['id'], 'some text')
        r = self.app.put('/api/runs/{}/comments/{}'.format(self.run['id'], comment['id']),
                         data=json.dumps({'commentText': 'blah'}))
        assert r.status_code == 400

    def test_update_with_out_of_date_timestamp(self):
        comment = create_comment_with_text(self.run['id'], 'some text')
        now = datetime.datetime.now()
        r = self.app.put('/api/runs/{}/comments/{}'.format(self.run['id'], comment['id']),
                         data=json.dumps({'commentText': 'blah',
                                          'lastModified': from_epoch(now)}))
        assert r.status_code == 409
        assert 'out of date' in json.loads(r.data)['message']

    def test_delete_comment(self):
        comment = create_comment_with_text(self.run['id'], 'some text')
        r = self.app.delete('/api/runs/{}/comments/{}'.format(self.run['id'], comment['id']),
                            data=json.dumps({'lastModified': from_epoch(comment['last_modified'])}))
        assert r.status_code == 200
        assert json.loads(r.data)['id'] == comment['id']
        r = self.app.get('/api/runs/{}/comments/{}'.format(self.run['id'], comment['id']))
        assert r.status_code == 404

    def test_delete_comment_without_timestamp(self):
        comment = create_comment_with_text(self.run['id'], 'some text')
        r = self.app.delete('/api/runs/{}/comments/{}'.format(self.run['id'], comment['id']))
        print r.data, r.status_code
        assert r.status_code == 400

    def test_delete_with_out_of_date_timestamp(self):
        comment = create_comment_with_text(self.run['id'], 'some text')
        now = datetime.datetime.now()
        r = self.app.delete('/api/runs/{}/comments/{}'.format(self.run['id'], comment['id']),
                         data=json.dumps({'lastModified': from_epoch(now)}))
        assert r.status_code == 409
        assert 'out of date' in json.loads(r.data)['message']
