"""Schemas for validating API requests."""
import json

from voluptuous import (Schema, All, Any, Required, Length, Range, truth,
                        message, Msg, Coerce, Exclusive, Invalid,
                        MultipleInvalid)


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

def is_path(s):
    return s[0] == '/' or s.startswith('file://') or s.startswith('hdfs://')

PathString = All(unicode,
                 Length(min=1),
                 Msg(truth(is_path),
                     'path must start with "/", "file://" or "hdfs://"'))


########
# Runs #
########

CreateRun = Schema({
    Required('uri'): PathString,

    # One of `project` is required, but not supported in voluptuous, so we
    # enforce this in code. cf. https://github.com/alecthomas/voluptuous/issues/115
    Exclusive('project_id', 'project'): Coerce(int),
    Exclusive('project_name', 'project'): unicode,

    Exclusive('normal_bam_id', 'normal_bam'): Coerce(int),
    Exclusive('normal_bam_uri', 'normal_bam'): PathString,
    Exclusive('tumor_bam_id', 'tumor_bam'): Coerce(int),
    Exclusive('tumor_bam_uri', 'tumor_bam'): PathString,

    'caller_name': unicode,
    'project_id': Coerce(int),
    'tumor_dataset_id': Coerce(int),
    'normal_dataset_id': Coerce(int),
    'truth_vcf_path': PathString,
    'is_validation': bool,
    'notes': unicode,
    'dataset': unicode,
    'project_name': unicode,
    'vcf_header': unicode
})

UpdateRun = Schema({
    'caller_name': unicode,

    Exclusive('normal_bam_id', 'normal_bam'): Coerce(int),
    Exclusive('normal_bam_uri', 'normal_bam'): PathString,
    Exclusive('tumor_bam_id', 'tumor_bam'): Coerce(int),
    Exclusive('tumor_bam_uri', 'tumor_bam'): PathString,

    'notes': unicode,
    'vcf_header': unicode,

    'true_positive': Coerce(int),
    'false_positive': Coerce(int),
    'precision': Coerce(float),
    'recall': Coerce(float),
    'f1score': Coerce(float)
})


############
# Projects #
############

CreateProject = Schema({
    Required('name'): unicode,
    'notes': unicode
})

UpdateProject = Schema({
    'name': unicode,
    'notes': unicode
})


########
# BAMs #
########

CreateBam = Schema({
    Required('uri'): PathString,

    # One of `project` is required, but not supported in voluptuous, so we
    # enforce this in code. cf. https://github.com/alecthomas/voluptuous/issues/115
    Exclusive('project_id', 'project'): Coerce(int),
    Exclusive('project_name', 'project'): unicode,

    'name': unicode,
    'notes': unicode,
    'tissues': unicode,
    'resection_date': unicode,
})

UpdateBam = Schema({
    'name': unicode,
    'notes': unicode,
    'tissues': unicode,
    'resection_date': unicode,
    'uri': PathString
})


############
# Comments #
############

CreateComment = Schema({
    Required("sample_name"): basestring,
    Required("contig"): basestring,
    Required("position"): Coerce(int),
    Required("reference"): basestring,
    Required("alternates"): basestring,
    Required("comment_text"): basestring,
    "author_name": basestring,
})

DeleteComment = Schema({
    Required('last_modified'): Coerce(float),
})

UpdateComment = Schema({
    Required('last_modified'): Coerce(float),
    "comment_text": basestring,
    "author_name": basestring,
})
