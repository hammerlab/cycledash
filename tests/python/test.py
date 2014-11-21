import nose

from cycledash.helpers import underscorize
from workers.relational_vcfs import vcf_to_csv


def test_underscorize():
    camel_to_underscored_expectations = {
        "camelCase": "camel_case",
        "HTTPRequest": "http_request",
        "CamelHTTP1": "camel_http1",
        "camelC": "camel_c",
        "CamelBI1GCasesRun1": "camel_bi1g_cases_run1"
    }
    for example, expected in camel_to_underscored_expectations.iteritems():
        assert underscorize(example) == expected


def test_vcf_to_csv():
    import vcf, csv
    vcfreader = vcf.Reader(open('tests/js/data/snv.vcf'))
    columns = ['sample:DP', 'info:VAF', 'info:DP', 'something']
    filename = vcf_to_csv(vcfreader, columns, None,
                          default_values={'something': True})

    with open(filename) as fd:
        rows = list(csv.reader(fd))

    assert rows[0] == ['44', '', '81', 'True']
    assert rows[-1] == ['40', '', '74', 'True']
    assert len(rows) == 20
