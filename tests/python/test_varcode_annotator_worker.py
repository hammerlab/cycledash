import ast
import nose.tools as asserts

from cycledash import db
from common.helpers import tables

from test_projects_api import create_project_with_name
from test_runs_api import create_run_with_uri

from workers.genotype_extractor import _extract
from workers.varcode_annotator import _annotate


class TestVarcodeAnnotatorWorker(object):
    def setUp(self):
        self.project = create_project_with_name('my varcode project')
        self.run = create_run_with_uri(self.project['id'],
                                       '/tests/data/somatic_hg19_14muts.vcf')

    def tearDown(self):
        with tables(db.engine, 'projects', 'vcfs', 'genotypes', 'task_states') \
                as (con, projects, runs, genotypes, tasks):
            tasks.delete().execute()
            genotypes.delete().execute()
            runs.delete().execute()
            projects.delete().execute()

    def test_extraction(self):
        _extract(self.run['id'])
        _annotate(self.run['id'])
        with tables(db.engine, 'vcfs', 'genotypes') as (con, vcfs, genotypes):
            vcf = vcfs.select(vcfs.c.id == self.run['id']).execute().fetchone()

        expected_extant_columns = set(['sample:GT',
                                       'annotations:gene_name',
                                       'annotations:effect_type',
                                       'annotations:effect_notation',
                                       'annotations:transcript'])

        extant_columns = set(ast.literal_eval(vcf['extant_columns']))
        asserts.eq_(extant_columns, expected_extant_columns)
