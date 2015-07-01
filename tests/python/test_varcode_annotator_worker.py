import ast
import mock
import nose
import nose.tools as asserts
import json
import vcf as pyvcf

from cycledash import app, db
from common.helpers import tables, find

from test_projects_api import create_project_with_name
from test_runs_api import create_run_with_uri

from workers.genotype_extractor import _extract
from workers.varcode_annotator import annotate


class TestVarcodeAnnotatorWorker(object):
    def setUp(self):
        self.project = create_project_with_name('my varcode project')
        self.run = create_run_with_uri(self.project['id'], '/tests/data/somatic_hg19_14muts.vcf')

    def tearDown(self):
        with tables(db.engine, 'projects', 'vcfs', 'genotypes', 'task_states') \
                as (con, projects, runs, genotypes, tasks):
            tasks.delete().execute()
            genotypes.delete().execute()
            runs.delete().execute()
            projects.delete().execute()

    def test_extraction(self):
        _extract(self.run['id'])
        annotate(self.run['id'])
        with tables(db.engine, 'vcfs', 'genotypes') as (con, vcfs, genotypes):
            vcf = vcfs.select(vcfs.c.id == self.run['id']).execute().fetchone()
            variants = genotypes.select(genotypes.c.vcf_id == self.run['id']).execute().fetchall()
            variants = [dict(v) for v in variants]

        expected_extant_columns = set(['sample:GT',
                                       'annotations:varcode_gene_name', 'annotations:varcode_effect_type',
                                       'annotations:varcode_effect_notation', 'annotations:varcode_transcript'])

        extant_columns = set(ast.literal_eval(vcf['extant_columns']))
        asserts.eq_(extant_columns, expected_extant_columns)
