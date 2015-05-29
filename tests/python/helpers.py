"""Helpers for Python tests"""
import common.helpers


def delete_tables(engine, *table_names):
    """Delete all rows from tables in `table_names' in order."""
    with common.helpers.tables(engine, *table_names) as tables:
        connection = tables[0]
        tables = tables[1:]
        for table in tables:
            table.delete().execute()
