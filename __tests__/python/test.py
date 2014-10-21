import nose

from cycledash.helpers import underscorize


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
