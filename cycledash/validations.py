import json

from voluptuous import (Schema, All, Required, Length, Range, truth, message,
                        Msg, Coerce)


PathString = All(unicode, Length(min=1), Msg(truth(lambda s: s[0] == '/'),
                                             'path must start with "/"'))


def Castable(t):
    """Assert that a value must be type castable to the given type.

    This is a validator function.
    """
    @message("value must be castable to " + str(t))
    def _Castable(v):
        try:
            t(v)
        except:
            raise ValueError
        return v
    return _Castable(t)


CreateRunSchema = Schema({
    Required('variant_caller_name'): unicode,
    Required('vcf_path'): PathString,
    'normal_bam_path': PathString,
    'tumor_bam_path': PathString,
    'is_validation': bool,
    'params': unicode,
    'dataset': unicode,
    'vcf_header': unicode
})


UpdateRunSchema = Schema({
    'variant_caller_name': unicode,
    'vcf_path': PathString,
    'normal_bam_path': PathString,
    'tumor_bam_path': PathString,
    'is_validation': bool,
    'params': unicode,
    'dataset': unicode,
    'vcf_header': unicode,
    'true_positive': Coerce(int),
    'false_positive': Coerce(int),
    'precision': Coerce(float),
    'recall': Coerce(float),
    'f1score': Coerce(float)
})


UpdateConcordanceSchema = Schema({
    'concordance_json': All({
        unicode: { Castable(int): int }
    }, json.dumps),
    'error': unicode,
    'state': unicode
})
