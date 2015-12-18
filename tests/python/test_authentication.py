"""Tests to make sure authentication is present + working."""


from flask_login import login_user
import mock
import nose
import nose.tools as asserts

from cycledash import app, db
from common.helpers import tables, find
import cycledash.views
import cycledash.auth

from test_projects_api import create_project_with_name
from test_bams_api import create_bam_with_name
from test_runs_api import create_run_with_uri
from test_comments_api import create_comment_with_text
import helpers


client = app.test_client()


def status_code_for_url(url, method='GET'):
    s = getattr(client, method.lower())(url).status_code
    return s


class TestViews(object):
    @classmethod
    def setUpClass(cls):
        cls.auth = helpers.insert_user(db)

    @classmethod
    def tearDownClass(cls):
        helpers.delete_all_records(db)


    def test_401s(self):
        codes = set()
        for resource in ['projects', 'bams', 'runs']:
            base = '/api/{}'.format(resource)
            codes.add(status_code_for_url(base))
            codes.add(status_code_for_url(base+'/1'))
            codes.add(status_code_for_url(base, method='POST'))
            codes.add(status_code_for_url(base+'/1', method='PUT'))
            codes.add(status_code_for_url(base+'/1', method='DELETE'))

        base = '/api/runs/1'
        codes.add(status_code_for_url(base+'/genotypes'))

        comments_base = base+'/comments'
        codes.add(status_code_for_url(comments_base))
        codes.add(status_code_for_url(comments_base, method='POST'))
        codes.add(status_code_for_url(comments_base+'/1'))
        codes.add(status_code_for_url(comments_base+'/1', method='PUT'))
        codes.add(status_code_for_url(comments_base+'/1', method='DELETE'))
        codes.add(status_code_for_url(comments_base+'/byrow'))

        tasks_base = base + '/tasks'
        codes.add(status_code_for_url(tasks_base))
        codes.add(status_code_for_url(tasks_base+'/restart', method='POST'))

        asserts.eq_(codes, set([401]))
