"""General helper function module."""
from contextlib import contextmanager
from datetime import datetime

import sqlalchemy


@contextmanager
def tables(engine, *table_names):
    """A context manager yielding a tuple of the database connection and
    whichever tables were requested by name from the db.

    Use:
        with tables(db, 'vcfs', 'genotypes') as (con, vcfs, genotypes):
            ...
        Where vcfs and genotypes are tables in the provided db.
    """
    with engine.connect() as connection:
        metadata = sqlalchemy.MetaData(bind=connection)
        metadata.reflect()
        yield tuple([connection] + [metadata.tables[t] for t in table_names])


class CRUDError(Exception):
    """Represents an issue with results from a CRUD operation."""
    def __init__(self, subject, message):
        self.subject = subject
        self.message = message


def order(lst, ordering, key=None):
    """Sorts, in-place, and return lst sorted by ordering on key.

    Args:
        lst: a list to be sorted.
        ordering: a list defining an ordering on lst. All values/keyed values in
          lst must be in ordering.

    Optional Args:
        key: a string (name of attribute) or function which returns a value
          which will be ordered. If None, identity is used as the key.

    Use:
        order([132, 99, 22], ordering=[99, 22, 44, 132])
        # => [99, 22, 132]

        order([{'thing': 'bathrobe'}, {'thing': 'toga'}],
              ['toga', 'bathrobe'], key='thing')
        # => [{'thing': 'toga'}, {'thing': 'bathrobe'}]
    """
    if key is None:
        lookup = lambda x: x
    elif isinstance(key, basestring):
        lookup = lambda x: x[key]
    else: # the key is a function
        lookup = key
    ordering = {name: idx for idx, name in enumerate(ordering)}
    lst.sort(key=lambda x: ordering[lookup(x)])
    return lst


def find(iterable, pred):
    """Return first element in iterable where pred returns true, else None."""
    for x in iterable:
        if pred(x):
            return x


def pick(obj, *keys):
    """Return an object with only the key/vals with key name in `keys`."""
    return {key: obj[key] for key in keys}


def to_epoch(dt):
    """Return the epoch time representation of a datetime object, `dt`."""
    epoch = datetime(1970, 1, 1, tzinfo=dt.tzinfo)
    return (dt - epoch).total_seconds()
