import nose
import nose.tools as asserts

from common.helpers import order, pick
from cycledash.helpers import underscorize, camelcase
from common.relational_vcf import vcf_to_csv


def test_underscorize():
    camel_to_underscored_expectations = {
        "camelCase": "camel_case",
        "HTTPRequest": "http_request",
        "CamelHTTP1": "camel_http1",
        "camelC": "camel_c",
        "CamelBI1GCasesRun1": "camel_bi1g_cases_run1"
    }
    for example, expected in camel_to_underscored_expectations.items():
        asserts.eq_(underscorize(example), expected)


def test_camelcase():
    underscored_to_cameled_expectations = {
        "camel_case": "camelCase",
        "http_request": "httpRequest",
        "camel_http1": "camelHttp1",
        "camel_c": "camelC",
        "camel_bi1g_cases_run1": "camelBi1gCasesRun1"
    }
    for example, expected in underscored_to_cameled_expectations.items():
        asserts.eq_(camelcase(example), expected)


def test_vcf_to_csv():
    import vcf, csv
    vcfreader = vcf.Reader(open('tests/data/snv.vcf'))
    columns = ['sample:DP', 'info:VAF', 'info:DP', 'something']
    filename = vcf_to_csv(vcfreader, columns, None,
                          default_values={'something': True})

    with open(filename) as fd:
        rows = list(csv.reader(fd))

    asserts.eq_(rows[0], ['44', '', '81', 'True'])
    asserts.eq_(rows[-1], ['40', '', '74', 'True'])
    asserts.eq_(len(rows), 20)


def test_order():
    o1 = order([132, 99, 22], ordering=[99, 22, 44, 132])
    o2 = order([{'thing': 'bathrobe'}, {'thing': 'toga'}],
               ['toga', 'bathrobe'], key='thing')
    o3 = order([-2, 2, 4, 1, 4],
               [1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16], key=lambda x: x * x)

    asserts.eq_(o1, [99, 22, 132])
    asserts.eq_(o2, [{'thing': 'toga'}, {'thing': 'bathrobe'}])
    asserts.eq_(o3, [1, -2, 2, 4, 4])


@asserts.raises(KeyError)
def test_pick():
    asserts.eq_(pick({'a': 1, 'b': 2, 'c': 'abc'}, 'a', 'c'), {'a': 1, 'c': 'abc'})
    asserts.eq_(pick({'a': 1, 'b': 2, 'c': 'abc'}), {})
    pick({'a': 'oh no'}, 'b')  # This raises a KeyError
