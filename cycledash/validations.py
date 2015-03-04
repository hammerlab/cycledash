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
    'project_id': Coerce(int),
    'truth_vcf_path': PathString,
    Required('tumor_dataset_id'): Coerce(int),
    Required('normal_dataset_id'): Coerce(int),
    'is_validation': bool,
    'params': unicode,
    'dataset': unicode,
    'project_name': unicode,
    'vcf_header': unicode
})


UpdateRunSchema = Schema({
    'variant_caller_name': unicode,
    'vcf_path': PathString,
    'project_id': Coerce(int),
    'tumor_dataset_id': Coerce(int),
    'normal_dataset_id': Coerce(int),
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


CreateProjectSchema = Schema({
    Required('name'): unicode,
    'notes': unicode
})

UpdateProjectSchema = Schema({
    'name': unicode,
    'notes': unicode
})


CreateBamSchema = Schema({
    Required('project_id'): Coerce(int),
    Required('name'): unicode,
    'notes': unicode,
    'flagstat': unicode,
    'tissues': unicode,
    'resection_date': unicode,
    'sequence_type': unicode,
    'library': unicode,
    'sequencing_platform': unicode,
    'primary_cancer_site': bool,
    Required('uri'): PathString
})

UpdateBamSchema = Schema({
    'name': unicode,
    'notes': unicode,
    'flagstat': unicode,
    'tissues': unicode,
    'resection_date': unicode,
    'sequence_type': unicode,
    'library': unicode,
    'sequencing_platform': unicode,
    'primary_cancer_site': bool,
    'uri': PathString
})
