"""Test rendered views of Cycledash."""
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


PROJECT_NAME = 'Testing'
mocked = mock.MagicMock()


class TestViews(object):

    def setUp(self):
        self.ctx = app.test_request_context()
        self.ctx.push()
        login_user(cycledash.auth.wrap_user(self.user))

    def tearDown(self):
        self.ctx.pop()
        mocked.reset_mock()

    @classmethod
    def setUpClass(cls):
        cls.user = helpers.create_user(db, 'name', 'password', 'email')
        cls.project = create_project_with_name(PROJECT_NAME)
        cls.project1 = create_project_with_name(PROJECT_NAME + '2')
        cls.normal_bam = create_bam_with_name(cls.project['id'], 'normal',
                                              uri='/bam/path/normal.bam')
        cls.tumor_bam = create_bam_with_name(cls.project['id'], 'tumor',
                                             uri='/bam/path/tumor.bam')
        with tables(db.engine, 'vcfs') as (con, runs):
            res = runs.insert(
                {'uri': 'file://path/to/something.vcf',
                 'project_id': cls.project['id'],
                 'normal_bam_id': cls.normal_bam['id'],
                 'tumor_bam_id': cls.tumor_bam['id'],
                 'vcf_header': ''}
            ).returning(*runs.c).execute()
            cls.run = dict(res.fetchone())
        cls.run2 = create_run_with_uri(cls.project['id'], 'http://someuri.vcf')
        cls.comment1 = create_comment_with_text(cls.run['id'], 'this is some text')
        cls.comment2 = create_comment_with_text(cls.run['id'], 'more text')

    @classmethod
    def tearDownClass(cls):
        helpers.delete_all_records(db)

    @mock.patch('cycledash.views.render_template', mocked)
    @mock.patch('cycledash.api.genotypes')
    def test_examine(self, *mocks):
        cycledash.views.examine(self.run['id'])
        vcf = mocked.call_args[1]['vcf']
        asserts.eq_(vcf['id'], self.run['id'])
        asserts.eq_(vcf['normal_bam']['id'], self.normal_bam['id'])
        asserts.eq_(vcf['tumor_bam']['id'], self.tumor_bam['id'])
        asserts.eq_(vcf['normal_bam']['uri'], self.normal_bam['uri'])
        asserts.eq_(vcf['tumor_bam']['uri'], self.tumor_bam['uri'])
        asserts.eq_(vcf['normal_bam']['name'], self.normal_bam['name'])
        asserts.eq_(vcf['tumor_bam']['name'], self.tumor_bam['name'])


    @mock.patch('cycledash.views.render_template', mocked)
    def test_home(self, *mocks):
        cycledash.views.home()
        project_trees = mocked.call_args[1]['project_trees']
        last_comments = mocked.call_args[1]['last_comments']

        asserts.eq_(len(project_trees), 2)

        project = find(project_trees, lambda p: p['name'] == PROJECT_NAME)
        asserts.ok_(project)

        vcfs = project.get('vcfs')
        asserts.ok_(vcfs)
        asserts.eq_(len(vcfs), 2)
        asserts.eq_(set([v['uri'] for v in vcfs]),
                    set([self.run['uri'], self.run2['uri']]))

        bams = project.get('bams')
        asserts.ok_(bams)
        asserts.eq_(len(bams), 2)

        asserts.eq_(len(last_comments), 2)
        comment2_found = find(last_comments, lambda c: c['vcfId'] == self.run['id'])
        asserts.eq_(comment2_found['commentText'], self.comment2['comment_text'])


    @mock.patch('cycledash.views.render_template', mocked)
    def test_comments(self, *mocks):
        cycledash.views.comments()

        comments = mocked.call_args[1]['comments']

        asserts.eq_(len(comments), 2)
        asserts.eq_(set([c['commentText'] for c in comments]),
                    set([self.comment1['comment_text'], self.comment2['comment_text']]))
