import mock
import nose
import json

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
        downUrl = ("/runs/" + str(self.run['id']) + "/download?query="
                   "%7B%22range%22%3A%7B%22start%22%3Anull%2C%22end%22%3Anull"
                   "%2C%22contig%22%3Anull%7D%2C%22filters%22%3A%5B%5D%2C%22"
                   "sortBy%22%3A%5B%7B%22order%22%3A%22asc%22%2C%22"
                   "columnName%22%3A%22contig%22%7D%2C%7B%22order"
                   "%22%3A%22asc%22%2C%22columnName%22%3A%22position"
                   "%22%7D%5D%2C%22page%22%3A0%2C%22limit%22%3A250%2C%22"
                   "compareToVcfId%22%3Anull%7D")
        r = self.get(downUrl)
        assert r.status_code == 200  # no fail
        assert len(r.data) == 1193  # might differ from the original file
