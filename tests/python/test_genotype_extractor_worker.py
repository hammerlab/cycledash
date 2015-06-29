import ast
import mock
import nose
import nose.tools as asserts
import json
import vcf as pyvcf

from cycledash import app, db
from common.helpers import tables, find
from workers.genotype_extractor import _extract

from test_projects_api import create_project_with_name
from test_bams_api import create_bam_with_name
from test_runs_api import create_run_with_uri
import helpers


class TestGenotypeExtractorWorker(object):
    def setUp(self):
        self.project = create_project_with_name('my project')
        self.run = create_run_with_uri(self.project['id'], '/tests/data/snv.vcf')

    def tearDown(self):
        with tables(db.engine, 'projects', 'vcfs', 'genotypes') as (con, projects, runs, genotypes):
            genotypes.delete().execute()
            runs.delete().execute()
            projects.delete().execute()

    @classmethod
    def tearDownClass(cls):
        helpers.delete_all_records(db)

    def test_extraction(self):
        _extract(self.run['id'])
        with tables(db.engine, 'vcfs', 'genotypes') as (con, vcfs, genotypes):
            vcf = vcfs.select(vcfs.c.id == self.run['id']).execute().fetchone()
            variants = genotypes.select(
                genotypes.c.vcf_id == self.run['id']).execute().fetchall()
            variants = [dict(v) for v in variants]
        expected_extant_columns = set(["sample:GT", "sample:RD", "sample:FREQ",
                                       "info:SSC", "sample:DP", "sample:DP4",
                                       "info:DP", "info:SS", "info:GPV", "sample:AD",
                                       "info:SPV"])

        extant_columns = set(ast.literal_eval(vcf['extant_columns']))
        asserts.eq_(extant_columns, expected_extant_columns)
        # 10 variants x 2 for the two samples in this file, NORMAL & TUMOR
        asserts.eq_(vcf['genotype_count'], 20)
        asserts.eq_(vcf['genotype_count'], len(variants))

        with open('tests/data/snv.vcf', 'r') as vcffile:
            vcflines = vcffile.readlines()
        expected_vcf_header = ''.join([l for l in vcflines
                                       if l.startswith('#')])
        asserts.eq_(vcf['vcf_header']+'\n', unicode(expected_vcf_header))

        with open('tests/data/snv.vcf') as vcffile:
            vcfreader = pyvcf.Reader(vcffile)
            expected_pyvcf_variants = [r for r in vcfreader]

        # Make sure we have the same (chromosome, position, ref, alt) variants
        assert_keys_in_variants(expected_pyvcf_variants, variants)

        # Make sure we've got the INFO fields we expect
        pyvcf_getters = [lambda v: v.INFO['DP'],
                         lambda v: v.INFO['SS'],
                         lambda v: v.INFO['SSC'],
                         lambda v: v.INFO['GPV'],
                         lambda v: v.INFO['SPV']]
        db_variant_getters = [lambda v: int(v['info:DP']),
                              lambda v: v['info:SS'],
                              lambda v: v['info:SSC'],
                              lambda v: float(v['info:GPV']),
                              lambda v: float(v['info:SPV'])]
        assert_keys_in_variants(expected_pyvcf_variants, variants,
                                expected_getters=pyvcf_getters,
                                actual_getters=db_variant_getters)

        # Make sure we've got the samples we expect (namely, TUMOR & NORMAL)
        asserts.eq_(set(vcfreader.samples),
                    set([v['sample_name'] for v in variants]))

        # Make sure all the NORMAL & TUMOR samples have the same fields with the same values
        def ensure_samples_equivalent(sample_name):
            def get_sample_data(attr):
                def get_from_variant(variant):
                    sample = find(variant.samples, lambda x: x.sample == sample_name)
                    return getattr(sample.data, attr)
                return get_from_variant
            pyvcf_getters = [get_sample_data('GT'),
                             get_sample_data('GQ'),
                             get_sample_data('DP'),
                             get_sample_data('RD'),
                             get_sample_data('AD'),
                             get_sample_data('FREQ'),
                             lambda v: tuple(get_sample_data('DP4')(v))]
            db_variant_getters = [lambda v: v['sample:GT'],
                                  # GQ is actually None on all variants in snv.vcf
                                  lambda v: int(v['sample:GQ']) if v['sample:GQ'] else None,
                                  lambda v: int(v['sample:DP']),
                                  lambda v: int(v['sample:RD']),
                                  lambda v: int(v['sample:AD']),
                                  lambda v: v['sample:FREQ'],
                                  lambda v: tuple(ast.literal_eval(v['sample:DP4']))]
            actual_db_variants = [v for v in variants
                                  if v['sample_name'] == sample_name]
            assert_keys_in_variants(expected_pyvcf_variants, actual_db_variants,
                                    expected_getters=pyvcf_getters,
                                    actual_getters=db_variant_getters)

        ensure_samples_equivalent('NORMAL')
        ensure_samples_equivalent('TUMOR')



def assert_keys_in_variants(
        expected_variants, actual_variants,
        expected_getters=[], actual_getters=[]):
    """Asserts that the variants in expected and actual match each other on
    chromosome, position, reference, alternates, and the result of applying the
    functions in expected_getters and actual_getters to expected_variants
    and actual_variants, respectively.
    """
    def extract_expected_keys(v):
        base = [v.CHROM, v.POS, v.REF, ''.join(map(str, v.ALT))]
        extra = [k(v) for k in expected_getters]
        return tuple(base + extra)
    def extract_actual_keys(v):
        base = [v['contig'], v['position'], v['reference'], v['alternates']]
        extra = [k(v) for k in actual_getters]
        return tuple(base + extra)
    # We use sets because we don't want to assume order.
    expected_variants = set([extract_expected_keys(v) for v in expected_variants])
    actual_variants = set([extract_actual_keys(v) for v in actual_variants])
    asserts.eq_(expected_variants, actual_variants)
