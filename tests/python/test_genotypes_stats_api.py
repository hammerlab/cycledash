import mock
import nose
import unittest
import nose.tools as asserts
import json

from cycledash import db
from cycledash.api import genotypes
from common.helpers import tables
from workers.genotype_extractor import _extract

from test_projects_api import create_project_with_name
from test_runs_api import create_run_with_uri
import helpers


class TestGenotypesAPI(object):

    @classmethod
    def setUpClass(cls):
        cls.project = create_project_with_name('my project')
        cls.run = create_run_with_uri(cls.project['id'], '/tests/data/snv.vcf')
        _extract(cls.run['id'])
        cls.truth_run = create_run_with_uri(cls.project['id'], '/tests/data/snv.truth.vcf')
        _extract(cls.truth_run['id'])

    @classmethod
    def tearDownClass(cls):
        helpers.delete_all_records(db)

    def test_stats_with_entire_truth_vcf(self):
        query = {
            'range': {},
            'filters': [],
            'sortBy': [],
            'compareToVcfId': self.truth_run['id']
        }
        stats = genotypes.get(self.run['id'], query, with_stats=True)['stats']

        total_truth_records_expected = 12
        true_positives_expected = 8
        false_positives_expected = 12
        false_negatives_expected = 4
        precision_expected =  true_positives_expected*1.0 / (true_positives_expected + false_positives_expected)
        recall_expected = true_positives_expected*1.0 / (true_positives_expected + false_negatives_expected)
        f1score_expected = 2.0 * (precision_expected * recall_expected) / (precision_expected + recall_expected)

        asserts.eq_(stats['totalTruthRecords'], total_truth_records_expected)

        asserts.eq_(stats['truePositives'], true_positives_expected)
        asserts.eq_(stats['falsePositives'], false_positives_expected)
        asserts.eq_(stats['falseNegatives'], false_negatives_expected)

        asserts.assert_almost_equals(stats['recall'], recall_expected)
        asserts.assert_almost_equals(stats['precision'], precision_expected)
        asserts.assert_almost_equals(stats['f1score'], f1score_expected)

    def test_stats_with_self(self):
        query = {
            'range': {},
            'filters': [],
            'sortBy': [],
            'compareToVcfId': self.run['id']
        }
        stats = genotypes.get(self.run['id'], query, with_stats=True)['stats']

        total_truth_records_expected = 20
        true_positives_expected = 20
        false_positives_expected = 0
        false_negatives_expected = 0
        precision_expected =  true_positives_expected*1.0 / (true_positives_expected + false_positives_expected)
        recall_expected = true_positives_expected*1.0 / (true_positives_expected + false_negatives_expected)
        f1score_expected = 2.0 * (precision_expected * recall_expected) / (precision_expected + recall_expected)

        asserts.eq_(stats['totalTruthRecords'], total_truth_records_expected)

        asserts.eq_(stats['truePositives'], true_positives_expected)
        asserts.eq_(stats['falsePositives'], false_positives_expected)
        asserts.eq_(stats['falseNegatives'], false_negatives_expected)

        asserts.assert_almost_equals(stats['recall'], recall_expected)
        asserts.assert_almost_equals(stats['precision'], precision_expected)
        asserts.assert_almost_equals(stats['f1score'], f1score_expected)

    def test_stats_with_truth_and_range(self):
        query = {
            'range': {'start': 0, 'end': 66000, 'contig': '20'},
            'filters': [],
            'sortBy': [],
            'compareToVcfId': self.truth_run['id']
        }
        stats = genotypes.get(self.run['id'], query, with_stats=True)['stats']

        total_truth_records_expected = 8
        true_positives_expected = 6
        false_positives_expected = 4
        false_negatives_expected = 2
        precision_expected =  true_positives_expected*1.0 / (true_positives_expected + false_positives_expected)
        recall_expected = true_positives_expected*1.0 / (true_positives_expected + false_negatives_expected)
        f1score_expected = 2.0 * (precision_expected * recall_expected) / (precision_expected + recall_expected)

        asserts.eq_(stats['totalTruthRecords'], total_truth_records_expected)

        asserts.eq_(stats['truePositives'], true_positives_expected)
        asserts.eq_(stats['falsePositives'], false_positives_expected)
        asserts.eq_(stats['falseNegatives'], false_negatives_expected)

        asserts.assert_almost_equals(stats['recall'], recall_expected)
        asserts.assert_almost_equals(stats['precision'], precision_expected)
        asserts.assert_almost_equals(stats['f1score'], f1score_expected)

    def test_stats_with_truth_and_filters(self):
        query = {
            'range': {},
            'filters': [{'columnName': 'sample_name',
                         'filterValue': 'TUMOR',
                         'type': '='}],
            'sortBy': [],
            'compareToVcfId': self.truth_run['id']
        }
        stats = genotypes.get(self.run['id'], query, with_stats=True)['stats']

        total_truth_records_expected = 6
        true_positives_expected = 4
        false_positives_expected = 6
        false_negatives_expected = 2
        precision_expected =  true_positives_expected*1.0 / (true_positives_expected + false_positives_expected)
        recall_expected = true_positives_expected*1.0 / (true_positives_expected + false_negatives_expected)
        f1score_expected = 2.0 * (precision_expected * recall_expected) / (precision_expected + recall_expected)

        asserts.eq_(stats['totalTruthRecords'], total_truth_records_expected)

        asserts.eq_(stats['truePositives'], true_positives_expected)
        asserts.eq_(stats['falsePositives'], false_positives_expected)
        asserts.eq_(stats['falseNegatives'], false_negatives_expected)

        asserts.assert_almost_equals(stats['recall'], recall_expected)
        asserts.assert_almost_equals(stats['precision'], precision_expected)
        asserts.assert_almost_equals(stats['f1score'], f1score_expected)
