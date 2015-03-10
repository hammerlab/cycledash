import json

from voluptuous import (Schema, All, Any, Required, Length, Range, truth,
                        message, Msg, Coerce, Exclusive, Invalid,
                        MultipleInvalid)


def is_path(s):
    return s[0] == '/' or s.startswith('file://') or s.startswith('hdfs://')


PathString = All(unicode,
                 Length(min=1),
                 Msg(truth(is_path),
                     'path must start with "/", "file://" or "hdfs://"'))


CreateRunSchema = Schema({
    Required('uri'): PathString,

    # One of `project` is required, but not supported in voluptuous, so we
    # enforce this in code. cf. https://github.com/alecthomas/voluptuous/issues/115
    Exclusive('project_id', 'project'): Coerce(int),
    Exclusive('project_name', 'project'): unicode,

    Exclusive('normal_bam_id', 'normal_bam'): Coerce(int),
    Exclusive('normal_bam_uri', 'normal_bam'): PathString,
    Exclusive('tumor_bam_id', 'tumor_bam'): Coerce(int),
    Exclusive('tumor_bam_uri', 'tumor_bam'): PathString,

    'variant_caller_name': unicode,
    'project_id': Coerce(int),
    'tumor_dataset_id': Coerce(int),
    'normal_dataset_id': Coerce(int),
    'truth_vcf_path': PathString,
    'is_validation': bool,
    'params': unicode,
    'dataset': unicode,
    'project_name': unicode,
    'vcf_header': unicode
})


UpdateRunSchema = Schema({
    'variant_caller_name': unicode,

    Exclusive('normal_bam_id', 'normal_bam'): Coerce(int),
    Exclusive('normal_bam_uri', 'normal_bam'): PathString,
    Exclusive('tumor_bam_id', 'tumor_bam'): Coerce(int),
    Exclusive('tumor_bam_uri', 'tumor_bam'): PathString,

    'params': unicode,
    'dataset': unicode,
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
    # One of `project` is required, but not supported in voluptuous, so we
    # enforce this in code. cf. https://github.com/alecthomas/voluptuous/issues/115
    Exclusive('project_id', 'project'): Coerce(int),
    Exclusive('project_name', 'project'): unicode,

    'name': unicode,
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


def expect_one_of(dct, *args):
    """Return the first attribute found in dct, else Raise MultipleInvalid if at
    least one required attribute is not present in dct.
    """
    for arg in args:
        if dct.get(arg) is not None:
            return arg
    error_string = '{}'.format(args[0])
    for arg in args[1:]:
        error_string += ' or {}'.format(arg)
    error_string += 'is required'
    error = Invalid(error_string)
    raise MultipleInvalid(errors=[error])
