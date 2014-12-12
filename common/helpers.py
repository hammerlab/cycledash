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
    try:
        connection = database.engine.connect()
        metadata = sqlalchemy.MetaData(bind=connection)
        metadata.reflect()
        yield tuple([connection] + [metadata.tables[t] for t in table_names])
    finally:
        connection.close()
