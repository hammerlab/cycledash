import datetime
import mock
import nose
import json

from cycledash import app, db
from common.helpers import tables, to_epoch

from test_projects_api import create_project_with_name
from test_runs_api import create_run_with_uri
import helpers


def create_comment_with_text(run_id, text):
    with tables(db.engine, 'user_comments') as (con, comments):
        res = comments.insert({
            'comment_text': text,
            'vcf_id': run_id,
            'sample_name': 'samp1',
            'contig': 'chr101',
            'position': 909090,
            'reference': 'Q',
            'alternates': 'WHOA',
            'user_id': None
            }).returning(*comments.c).execute()
        return dict(res.fetchone())

class TestCommentsAPI(helpers.ResourceTest):
    @classmethod
    def setUpClass(cls):
        cls.project = create_project_with_name('project')
        cls.run = create_run_with_uri(cls.project['id'], 'http://somevcf.vcf')
        return super(TestCommentsAPI, cls).setUpClass()

    def tearDown(self):
        helpers.delete_table(db, 'user_comments')

    def test_create_comment(self):
        comment_text = 'The Testing Caller'
        r = self.post('/api/runs/{}/comments'.format(self.run['id']),
                      data={'sampleName': 'samp',
                            'contig': 'chr2',
                            'position': 123,
                            'reference': 'C',
                            'alternates': 'A,G',
                            'commentText': comment_text})
        data = json.loads(r.data)
        assert r.status_code == 201
        assert isinstance(json.loads(r.data)['id'], int)
        assert data['vcfId'] == self.run['id']
        assert data['sampleName'] == 'samp'
        assert data['commentText'] == comment_text
        assert data['reference'] == 'C'
        assert data['alternates'] == 'A,G'
        assert data['position'] == 123
        assert data['contig'] == 'chr2'

    def test_get_comment(self):
        text = 'this is some comment text'
        comment = create_comment_with_text(self.run['id'], text)
        r = self.get('/api/runs/{}/comments/{}'.format(
            self.run['id'], comment['id']))
        data = json.loads(r.data)
        assert r.status_code == 200
        assert data['id'] == comment['id']
        assert data['commentText'] == comment['comment_text']

    def test_get_comments(self):
        comment1 = create_comment_with_text(self.run['id'], 'comment1')
        comment2 = create_comment_with_text(self.run['id'], 'comment2')
        r = self.get('/api/runs/{}/comments'.format(self.run['id']))
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
        r = self.put('/api/runs/{}/comments/{}'.format(self.run['id'], comment['id']),
                     data={'commentText': new_text,
                           'last_modified': to_epoch(comment['last_modified'])})
        assert r.status_code == 200
        assert json.loads(r.data)['id'] == comment['id']
        assert json.loads(r.data)['commentText'] == new_text

    def test_update_comment_without_timestamp(self):
        comment = create_comment_with_text(self.run['id'], 'some text')
        r = self.put('/api/runs/{}/comments/{}'.format(self.run['id'], comment['id']),
                         data={'commentText': 'blah'})
        assert r.status_code == 400

    def test_update_with_out_of_date_timestamp(self):
        comment = create_comment_with_text(self.run['id'], 'some text')
        now = datetime.datetime.now()
        r = self.put('/api/runs/{}/comments/{}'.format(self.run['id'], comment['id']),
                         data={'commentText': 'blah',
                               'lastModified': to_epoch(now)})
        assert r.status_code == 409
        assert 'out of date' in json.loads(r.data)['message']

    def test_delete_comment(self):
        comment = create_comment_with_text(self.run['id'], 'some text')
        r = self.delete('/api/runs/{}/comments/{}'.format(self.run['id'], comment['id']),
                            data={'lastModified': to_epoch(comment['last_modified'])})
        assert r.status_code == 200
        assert json.loads(r.data)['id'] == comment['id']
        r = self.get('/api/runs/{}/comments/{}'.format(self.run['id'], comment['id']))
        assert r.status_code == 404

    def test_delete_comment_without_timestamp(self):
        comment = create_comment_with_text(self.run['id'], 'some text')
        r = self.delete('/api/runs/{}/comments/{}'.format(self.run['id'], comment['id']))
        assert r.status_code == 400

    def test_delete_with_out_of_date_timestamp(self):
        comment = create_comment_with_text(self.run['id'], 'some text')
        now = datetime.datetime.now()
        r = self.delete('/api/runs/{}/comments/{}'.format(self.run['id'], comment['id']),
                         data={'lastModified': to_epoch(now)})
        assert r.status_code == 409
        assert 'out of date' in json.loads(r.data)['message']
