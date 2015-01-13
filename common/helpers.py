"""General helper function module."""
from contextlib import contextmanager

import sqlalchemy


@contextmanager
def tables(database, *table_names):
    """A context manager yielding a tuple of the database connection and
    whichever tables were requested by name from the db.

    Use:
        with tables(db, 'vcfs', 'genotypes') as (con, vcfs, genotypes):
            ...
      Where vcfs and genotypes are tables in the provided db.
    """
    with database.engine.connect() as connection:
        metadata = sqlalchemy.MetaData(bind=connection)
        metadata.reflect()
        yield tuple([connection] + [metadata.tables[t] for t in table_names])


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
