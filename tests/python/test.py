import nose

from common.helpers import order
from cycledash.helpers import underscorize
from common.relational_vcf import vcf_to_csv


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
    vcfreader = vcf.Reader(open('tests/data/snv.vcf'))
    columns = ['sample:DP', 'info:VAF', 'info:DP', 'something']
    filename = vcf_to_csv(vcfreader, columns, None,
                          default_values={'something': True})

    with open(filename) as fd:
        rows = list(csv.reader(fd))

    assert rows[0] == ['44', '', '81', 'True']
    assert rows[-1] == ['40', '', '74', 'True']
    assert len(rows) == 20


def test_order():
    o1 = order([132, 99, 22], ordering=[99, 22, 44, 132])
    o2 = order([{'thing': 'bathrobe'}, {'thing': 'toga'}],
               ['toga', 'bathrobe'], key='thing')
    o3 = order([-2, 2, 4, 1, 4],
               [1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16], key=lambda x: x * x)

    assert o1 == [99, 22, 132]
    assert o2 == [{'thing': 'toga'}, {'thing': 'bathrobe'}]
    assert o3 == [1, -2, 2, 4, 4]
