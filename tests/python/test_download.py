import mock
import nose
import json
import urllib

from cycledash import app, db
from common.helpers import tables

from test_projects_api import create_project_with_name
from test_bams_api import create_bam_with_name
from test_runs_api import create_run_with_uri
from workers.genotype_extractor import _extract

import helpers

class TestDownload(helpers.ResourceTest):
    """ Creates a project from a test file, extracts the genotype
        and tries to download it back. """

    @classmethod
    def setUpClass(cls):
        cls.project = create_project_with_name('Downloadable project')
        cls.run = create_run_with_uri(cls.project['id'],
                                       '/tests/data/somatic_hg19_14muts.vcf')
        _extract(cls.run['id'])
        return super(TestDownload, cls).setUpClass()

    def tearDown(self):
        with tables(db.engine, 'projects', 'vcfs', 'genotypes') \
                as (con, projects, runs, genotypes):
            genotypes.delete().execute()
            runs.delete().execute()
            projects.delete().execute()

    def test_download(self):
        # match the URL with the default download button href
        queryStr = ('{"range":{"start":null,"end":null,"contig":null},'
                    '"filters":[],'
                    '"sortBy":[{"columnName":"contig","order":"asc"},'
                    '{"columnName":"position","order":"asc"}],'
                    '"page":0,"limit":250,"compareToVcfId":null}')
        downUrl = ("/runs/" + str(self.run['id']) + "/download?query=" +
                   urllib.quote(queryStr))
        r = self.get(downUrl)
        assert r.status_code == 200  # no fail
        assert len(r.data) == 1226  # might differ from the original file
