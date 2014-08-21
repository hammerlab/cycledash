import json

from voluptuous import Schema, All, Required, Length, Range, truth, Msg



PathString = All(unicode, Length(min=1), Msg(truth(lambda s: s[0] == '/'), 'path must start with \'\\\''))


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
    'precision': float,
    'recall': float,
    'f1score': float,
    'true_positive': int,
    'false_positive': int,

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
    Required('concordance_json'): All(unicode, json.loads)
})
