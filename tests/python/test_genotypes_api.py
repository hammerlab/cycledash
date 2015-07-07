import mock
import nose
import nose.tools as asserts
import json

from cycledash import db
from cycledash.api import genotypes
from common.helpers import tables, pick
from workers.genotype_extractor import _extract

from test_projects_api import create_project_with_name
from test_runs_api import create_run_with_uri
import helpers


class TestGenotypesAPI(object):

    @classmethod
    def setUpClass(cls):
        cls.project = create_project_with_name('my project')
        cls.chr_run = create_run_with_uri(cls.project['id'], '/tests/data/diverse.vcf')
        _extract(cls.chr_run['id'])
        cls.no_chr_run = create_run_with_uri(cls.project['id'], '/tests/data/diverse.nochr.vcf')
        _extract(cls.no_chr_run['id'])

    @classmethod
    def tearDownClass(cls):
        helpers.delete_all_records(db)

    def test_number_of_genotypes_normal_sample_name(self):
        run_id = self.chr_run['id']
        query = {
            'range': {'contig': 'chrY', 'start': 0, 'end': 2000000000000},
            'filters': [{'columnName': 'sample_name', 'filterValue': 'normal', 'type': '='}],
            'sortBy': []
        }
        records = genotypes.get(run_id, query, with_stats=False)['records']
        asserts.eq_(len(records), 5)

    def test_number_of_genotypes_small_range(self):
        run_id = self.no_chr_run['id']
        query = {
            'range': {'contig': '1', 'start': 0, 'end': 10},
            'filters': [],
            'sortBy': []
        }
        records = genotypes.get(run_id, query, with_stats=False)['records']
        asserts.eq_(len(records), 4)

    def test_order_of_genotypes_with_chr_prefix(self):
        run_id = self.chr_run['id']
        query = {
            'range': {},
            'filters': [{'columnName': 'sample_name', 'filterValue': 'normal', 'type': '='}],
            'sortBy': [{'columnName': 'contig', 'order': 'asc'},
                       {'columnName': 'position', 'order': 'asc'}]
        }
        records = genotypes.get(run_id, query, with_stats=False)['records']
        results = [pick(r, 'contig', 'position') for r in records]
        expected_results = [{'contig': 'chr1', 'position': 1},
                            {'contig': 'chr1', 'position': 2},
                            {'contig': 'chr1', 'position': 10},
                            {'contig': 'chr1', 'position': 11},
                            {'contig': 'chr1', 'position': 21},
                            {'contig': 'chr2', 'position': 1},
                            {'contig': 'chr10', 'position': 17},
                            {'contig': 'chr11', 'position': 163},
                            {'contig': 'chr20', 'position': 123},
                            {'contig': 'chr23', 'position': 1},
                            {'contig': 'chrX', 'position': 2},
                            {'contig': 'chrY', 'position': 1},
                            {'contig': 'chrY', 'position': 7},
                            {'contig': 'chrY', 'position': 17},
                            {'contig': 'chrY', 'position': 19},
                            {'contig': 'chrY', 'position': 21},
                            {'contig': 'GT05182', 'position': 1}]
        asserts.eq_(results, expected_results)

    def test_order_of_genotypes(self):
        run_id = self.no_chr_run['id']
        query = {
            'range': {},
            'filters': [{'columnName': 'sample_name', 'filterValue': 'normal', 'type': '='}],
            'sortBy': [{'columnName': 'contig', 'order': 'asc'},
                       {'columnName': 'position', 'order': 'asc'}]
        }
        records = genotypes.get(run_id, query, with_stats=False)['records']
        results = [pick(r, 'contig', 'position') for r in records]
        expected_results = [{'contig': '1', 'position': 1},
                            {'contig': '1', 'position': 2},
                            {'contig': '1', 'position': 10},
                            {'contig': '1', 'position': 11},
                            {'contig': '1', 'position': 21},
                            {'contig': '2', 'position': 1},
                            {'contig': '10', 'position': 17},
                            {'contig': '11', 'position': 163},
                            {'contig': '20', 'position': 123},
                            {'contig': '23', 'position': 1},
                            {'contig': 'X', 'position': 2},
                            {'contig': 'Y', 'position': 1},
                            {'contig': 'Y', 'position': 7},
                            {'contig': 'Y', 'position': 17},
                            {'contig': 'Y', 'position': 19},
                            {'contig': 'Y', 'position': 21},
                            {'contig': 'GTR01', 'position': 20},
                            {'contig': 'GT05182', 'position': 1}]
        asserts.eq_(results, expected_results)

    def test_order_of_genotypes_by_dp_desc(self):
        run_id = self.no_chr_run['id']
        query = {
            'range': {},
            'filters': [{'columnName': 'sample_name', 'filterValue': 'normal', 'type': '='}],
            'sortBy': [{'columnName': 'sample:DP', 'order': 'desc'}]
        }
        records = genotypes.get(run_id, query, with_stats=False)['records']
        results = [pick(r, 'contig', 'position', 'sample:DP') for r in records]
        expected_results = [{'contig': '23', 'position': 1, 'sample:DP': '99'},
                            {'contig': 'GT05182', 'position': 1, 'sample:DP': '99'},
                            {'contig': '1', 'position': 1, 'sample:DP': '67'},
                            {'contig': '1', 'position': 2, 'sample:DP': '67'},
                            {'contig': '1', 'position': 10, 'sample:DP': '67'},
                            {'contig': '1', 'position': 11, 'sample:DP': '67'},
                            {'contig': '1', 'position': 21, 'sample:DP': '67'},
                            {'contig': '2', 'position': 1, 'sample:DP': '45'},
                            {'contig': 'GTR01', 'position': 20, 'sample:DP': '45'},
                            {'contig': 'X', 'position': 2, 'sample:DP': '32'},
                            {'contig': '10', 'position': 17, 'sample:DP': '30'},
                            {'contig': '11', 'position': 163, 'sample:DP': '30'},
                            {'contig': '20', 'position': 123, 'sample:DP': '30'},
                            {'contig': 'Y', 'position': 17, 'sample:DP': '21'},
                            {'contig': 'Y', 'position': 19, 'sample:DP': '13'},
                            {'contig': 'Y', 'position': 7, 'sample:DP': '12'},
                            {'contig': 'Y', 'position': 1, 'sample:DP': '11'},
                            {'contig': 'Y', 'position': 21, 'sample:DP': '10'}]
        asserts.eq_(results, expected_results)

    def test_order_of_genotypes_by_dp_asc(self):
        run_id = self.no_chr_run['id']
        query = {
            'range': {},
            'filters': [{'columnName': 'sample_name', 'filterValue': 'normal', 'type': '='}],
            'sortBy': [{'columnName': 'sample:DP', 'order': 'asc'}]
        }
        records = genotypes.get(run_id, query, with_stats=False)['records']
        results = [pick(r, 'contig', 'position', 'sample:DP') for r in records]
        expected_results = [{'contig': 'Y', 'position': 21, 'sample:DP': '10'},
                            {'contig': 'Y', 'position': 1, 'sample:DP': '11'},
                            {'contig': 'Y', 'position': 7, 'sample:DP': '12'},
                            {'contig': 'Y', 'position': 19, 'sample:DP': '13'},
                            {'contig': 'Y', 'position': 17, 'sample:DP': '21'},
                            {'contig': '10', 'position': 17, 'sample:DP': '30'},
                            {'contig': '11', 'position': 163, 'sample:DP': '30'},
                            {'contig': '20', 'position': 123, 'sample:DP': '30'},
                            {'contig': 'X', 'position': 2, 'sample:DP': '32'},
                            {'contig': '2', 'position': 1, 'sample:DP': '45'},
                            {'contig': 'GTR01', 'position': 20, 'sample:DP': '45'},
                            {'contig': '1', 'position': 1, 'sample:DP': '67'},
                            {'contig': '1', 'position': 2, 'sample:DP': '67'},
                            {'contig': '1', 'position': 10, 'sample:DP': '67'},
                            {'contig': '1', 'position': 11, 'sample:DP': '67'},
                            {'contig': '1', 'position': 21, 'sample:DP': '67'},
                            {'contig': '23', 'position': 1, 'sample:DP': '99'},
                            {'contig': 'GT05182', 'position': 1, 'sample:DP': '99'}]
        asserts.eq_(results, expected_results)

    def test_filtered_info_lt(self):
        run_id = self.no_chr_run['id']
        query = {
            'range': {},
            'filters': [{'columnName': 'sample_name', 'filterValue': 'tumor', 'type': '='},
                        {'columnName': 'info:DP', 'filterValue': '50', 'type': '<'}],
            'sortBy': []
        }
        records = genotypes.get(run_id, query, with_stats=False)['records']
        results = [pick(r, 'contig', 'position', 'info:DP') for r in records]
        expected_results = [{'contig': '1', 'info:DP': '43', 'position': 11},
                            {'contig': '10', 'info:DP': '18', 'position': 17},
                            {'contig': '11', 'info:DP': '12', 'position': 163},
                            {'contig': '20', 'info:DP': '12', 'position': 123},
                            {'contig': 'Y', 'info:DP': '49', 'position': 1},
                            {'contig': 'GTR01', 'info:DP': '45', 'position': 20}]
        asserts.eq_(len(results), 6)
        asserts.eq_(results, expected_results)

    def test_filtered_sample_gt(self):
        run_id = self.no_chr_run['id']
        query = {
            'range': {},
            'filters': [{'columnName': 'sample:RD', 'filterValue': '35', 'type': '>'}],
            'sortBy': []
        }
        records = genotypes.get(run_id, query, with_stats=False)['records']
        results = [pick(r, 'contig', 'sample:RD', 'sample_name') for r in records]
        expected_results = [{'contig': '1', 'sample:RD': '38', 'sample_name': 'normal'},
                            {'contig': '1', 'sample:RD': '36', 'sample_name': 'normal'},
                            {'contig': '1', 'sample:RD': '45', 'sample_name': 'normal'},
                            {'contig': '10', 'sample:RD': '72', 'sample_name': 'tumor'},
                            {'contig': 'Y', 'sample:RD': '67', 'sample_name': 'normal'},
                            {'contig': 'GTR01', 'sample:RD': '51', 'sample_name': 'tumor'},
                            {'contig': 'GT05182', 'sample:RD': '91', 'sample_name': 'normal'}]
        asserts.eq_(len(results), 7)
        asserts.eq_(results, expected_results)
