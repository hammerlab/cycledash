import json

from voluptuous import (Schema, All, Required, Length, Range, truth, message,
                        Msg, Coerce)


PathString = All(unicode, Length(min=1), Msg(truth(lambda s: s[0] == '/'),
                                             'path must start with "/"'))


def Castable(t):
    @message("key must be castable to " + str(t))
    def _Castable(v):
        try:
            t(v)
        except:
            raise ValueError
        return v
    return _Castable()


CreateRunSchema = Schema({
    Required('variant_caller_name'): unicode,
    Required('vcf_path'): PathString,
    'truth_vcf_path': PathString,
    'normal_path': PathString,
    'tumor_path': PathString,
    'reference_path': PathString,
    'params': unicode,
    'dataset': unicode,
    'sha1': unicode
})


UpdateRunSchema = Schema({
    'precision': Coerce(float),
    'recall': Coerce(float),
    'f1score': Coerce(float),
    'true_positive': Coerce(int),
    'false_positive': Coerce(int),

    'variant_caller_name': unicode,
    'vcf_path': PathString,
    'truth_vcf_path': PathString,
    'normal_path': PathString,
    'tumor_path': PathString,
    'reference_path': PathString,
    'params': unicode,
    'dataset': unicode,
    'sha1': unicode
})


UpdateConcordanceSchema = Schema({
    'concordance_json': All({
        unicode: { Castable(int): int }
    }, json.dumps),
    'error': unicode,
    'state': unicode
})
