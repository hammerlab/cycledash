"""Test rendered views of Cycledash."""
import mock
import nose
import nose.tools as asserts

from cycledash import app, db
from common.helpers import tables
import cycledash.views

from test_projects_api import create_project_with_name
from test_bams_api import create_bam_with_name


PROJECT_NAME = 'Testing'
mocked = mock.MagicMock()


class TestViews(object):

    def setUp(self):
        self.ctx = app.test_request_context()
        self.ctx.push()
        project = create_project_with_name(PROJECT_NAME)
        self.normal_bam = create_bam_with_name(project['id'], 'normal',
                                               uri='/bam/path/normal.bam')
        self.tumor_bam = create_bam_with_name(project['id'], 'tumor',
                                              uri='/bam/path/tumor.bam')
        with tables(db.engine, 'vcfs') as (con, runs):
            res = runs.insert(
                {'uri': 'file://path/to/something.vcf', 'project_id': project['id'],
                 'normal_bam_id': self.normal_bam['id'],
                 'tumor_bam_id': self.tumor_bam['id'],
                 'vcf_header': ''}
            ).returning(*runs.c).execute()
            self.run = dict(res.fetchone())

    def tearDown(self):
        with tables(db.engine, 'projects', 'bams', 'vcfs') as (con, projects, bams, runs):
            runs.delete().execute()
            bams.delete().execute()
            projects.delete().execute()
        self.ctx.pop()

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

