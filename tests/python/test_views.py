"""Test rendered views of Cycledash."""
import mock
import nose
import nose.tools as asserts

from cycledash import app, db
from common.helpers import tables, find
import cycledash.views

from test_projects_api import create_project_with_name
from test_bams_api import create_bam_with_name
from test_runs_api import create_run_with_uri
from test_comments_api import create_comment_with_text


PROJECT_NAME = 'Testing'
mocked = mock.MagicMock()


class TestViews(object):

    def setUp(self):
        self.ctx = app.test_request_context()
        self.ctx.push()
        self.project = create_project_with_name(PROJECT_NAME)
        self.normal_bam = create_bam_with_name(self.project['id'], 'normal',
                                               uri='/bam/path/normal.bam')
        self.tumor_bam = create_bam_with_name(self.project['id'], 'tumor',
                                              uri='/bam/path/tumor.bam')
        with tables(db.engine, 'vcfs') as (con, runs):
            res = runs.insert(
                {'uri': 'file://path/to/something.vcf',
                 'project_id': self.project['id'],
                 'normal_bam_id': self.normal_bam['id'],
                 'tumor_bam_id': self.tumor_bam['id'],
                 'vcf_header': ''}
            ).returning(*runs.c).execute()
            self.run = dict(res.fetchone())

    def tearDown(self):
        with tables(db.engine, 'projects', 'bams', 'vcfs', 'user_comments') \
             as (con, projects, bams, runs, comments):
            comments.delete().execute()
            runs.delete().execute()
            bams.delete().execute()
            projects.delete().execute()
        self.ctx.pop()
        mocked.reset_mock()

    @mock.patch('cycledash.views.render_template', mocked)
    @mock.patch('cycledash.genotypes')
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
        run = create_run_with_uri(self.project['id'], '/someotheruri.vcf')
        project = create_project_with_name('otherproject')

        comment1 = create_comment_with_text(self.run['id'], 'this is some text')
        comment2 = create_comment_with_text(
            run['id'], 'this is some text on the other run')

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
                    set([self.run['uri'], run['uri']]))

        bams = project.get('bams')
        asserts.ok_(bams)
        asserts.eq_(len(bams), 2)

        asserts.eq_(len(last_comments), 2)
        comment2_found = find(last_comments, lambda c: c['vcfId'] == run['id'])
        asserts.eq_(comment2_found['commentText'], comment2['comment_text'])


    @mock.patch('cycledash.views.render_template', mocked)
    def test_comments(self, *mocks):
        comment1 = create_comment_with_text(self.run['id'], 'this is some text')
        comment2 = create_comment_with_text(self.run['id'], 'more text')

        cycledash.views.comments()

        comments = mocked.call_args[1]['comments']

        asserts.eq_(len(comments), 2)
        asserts.eq_(set([c['commentText'] for c in comments]),
                    set([comment1['comment_text'], comment2['comment_text']]))
