import json

from voluptuous import (Schema, All, Required, Length, Range, truth, message,
                        Msg, Coerce)


def is_path(s):
    return s[0] == '/' or s.startswith('file://') or s.startswith('hdfs://')


PathString = All(unicode,
                 Length(min=1),
                 Msg(truth(is_path),
                     'path must start with "/", "file://" or "hdfs://"'))


CreateRunSchema = Schema({
    Required('variant_caller_name'): unicode,
    Required('vcf_path'): PathString,
    'truth_vcf_path': PathString,
    'normal_path': PathString,
    'tumor_path': PathString,
    'is_validation': bool,
    'params': unicode,
    'dataset': unicode,
    'project_name': unicode,
    'vcf_header': unicode
})


UpdateRunSchema = Schema({
    'variant_caller_name': unicode,
    'vcf_path': PathString,
    'normal_path': PathString,
    'tumor_path': PathString,
    'is_validation': bool,
    'params': unicode,
    'dataset': unicode,
    'project_name': unicode,
    'vcf_header': unicode,
    'true_positive': Coerce(int),
    'false_positive': Coerce(int),
    'precision': Coerce(float),
    'recall': Coerce(float),
    'f1score': Coerce(float)
})
