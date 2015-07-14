"""Schemas for validating API requests."""
import json
from voluptuous import (Schema, All, Any, Required, Length, Range, truth,
                        message, Msg, Coerce, Exclusive, Invalid,
                        MultipleInvalid, Marker)

import common.helpers


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
    error_string += ' is required'
    error = Invalid(error_string)
    raise MultipleInvalid(errors=[error])


def is_path(s):
    return s[0] == '/' or s.startswith('file://') or s.startswith('hdfs://')


def is_email(s):
    return '@' in s


def to_epoch(v):
    return common.helpers.to_epoch(v)


PathString = All(unicode,
                 Length(min=1),
                 Msg(truth(is_path),
                     'path must start with "/", "file://" or "hdfs://"'))


class Doc(Marker):
    """Attach documentation to this voluptuous node.
    """
    def __init__(self, schema, docstring, *args, **kwargs):
        super(Doc, self).__init__(schema, *args, **kwargs)
        self.docstring = docstring


################
# Registration #
################

RegisterUser = Schema({
    Required('username'): basestring,
    Required('email'): All(basestring,
                           Msg(truth(is_email), 'Must be a valid email.')),
    Required('password1'): All(basestring, Length(min=8)),
    Required('password2'): All(basestring, Length(min=8))
})


#########
# Login #
#########

LoginUser = Schema({
    Required('username'): basestring,
    Required('password'): basestring
})
