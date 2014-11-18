"""Convert VCF records into relations according to a SQL table.
"""
from collections import OrderedDict
import csv
import tempfile

import sqlalchemy


CHUNK_SIZE = 100 # size of relations to inserted at once

SAMPLE_PREFIX = 'sample:'
INFO_PREFIX = 'info:'
SAMPLE_NAME_KEY = 'sample_name'
DEFAULT_VALUES = {}
COLUMN_MAPPING = {'position': 'POS', 'contig': 'CHROM',
                  'reference': 'REF', 'alternates': 'ALT',
                  'quality': 'QUAL', 'filters': 'FILTER'}


def columns(table):
    """Return an OrderedDict of columns: types in  the given Table."""
    return OrderedDict((c.name, c.type.python_type) for c in table.columns)


def prefix_keys(dct, prefix):
    """Return a dict dct with all keys prefixed with string prefix."""
    return {prefix + str(key): val for key, val in dct.iteritems()}


def flatten_record(record, info_prefix, sample_prefix, sample_name_key):
    """Return a list of dicts {column-name: val} of exploded (INFO and SAMPLE
    columns expanded) VCF records, one dict per sample in the record, with INFO
    and SAMPLE fields exploded and an additional sample_name field added,
    denoting the name of the sample the dict was generated from.
    """
    filters = ','.join(str(f) for f in record.FILTER) if record.FILTER else ''
    fields = {'POS': record.POS, 'CHROM': record.CHROM, 'ID': record.ID,
              'QUAL': record.QUAL, 'FILTER': filters,
              'REF': record.REF, 'ALT': ','.join(str(a) for a in record.ALT)}
    fields.update(prefix_keys(record.INFO, info_prefix))
    def prepare(samp):
        "Prepare a sample dict by populating its fields."
        sample = prefix_keys(samp.data.__dict__, sample_prefix)
        sample = dict(sample, **fields)
        sample[sample_name_key] = samp.sample
        return sample
    return [prepare(sample) for sample in record.samples]


def flat_record_to_relation(flat_record, columns,
                            column_mapping, default_values):
    """Return a list generated from record conforming to types in
    columns, and the fields corresponding to the values in the relation. The
    relation is in the same order as columns.

    Args:
        flat_record: A dict of {field: value} represending a VCF record.
        columns: An OrderedDict of {field: python_types}.
        column_mapping: A dict mapping field names in columns to field names in
            record, if some are expected to be named differently.
        default_values: A dict of {field: value} to replace values of a certain
            field in relation with the default value.

    Returns:
        A list of values corresponding to the (ordered) fields in column, of
        that type of None if that field does not exist in flat_record

    Raises:
        ValueError: An error occurred casting a record value to a column's type.
    """
    relation = []
    for field, _ in columns.iteritems():
        record_field = field
        value = None
        if field in column_mapping:
            record_field = column_mapping[field]
        if field in default_values:
            value = default_values.get(field)
        elif record_field in flat_record:
            value = flat_record[record_field]
            # We ignore all types (== TEXT).
            value = str(value) if value is not None else ''
        # Append it even if it's None; every relation is fully defined.
        relation.append(value)
    return relation


def records_to_relations(records, columns, **kwargs):
    """Return a list of relations and a list of fields corresponding to the
    values in the relations derived from VCF and ready for insertion into table.
    """
    info_prefix = kwargs.get('info_prefix', INFO_PREFIX)
    sample_prefix = kwargs.get('sample_prefix', SAMPLE_PREFIX)
    sample_name_key = kwargs.get('sample_name_key', SAMPLE_NAME_KEY)
    default_values = kwargs.get('default_values', DEFAULT_VALUES)
    column_mapping = kwargs.get('column_mapping', COLUMN_MAPPING)
    relations = []
    for record in records:
        flat_recs = flatten_record(record, info_prefix,
                                   sample_prefix, sample_name_key)
        for rec in flat_recs:
            relation = flat_record_to_relation(rec, columns,
                                               column_mapping, default_values)
            relations.append(relation)
    return relations


def vcf_to_csv(vcfdata, table, filename, **kwargs):
    """Insert all flattened records in VCF into a CSV.

    Args:
        vcfdata: A vcf.Reader of records.
        table: A sqlalchemy.Table that the CSV header is derived from.
        filename: The name of the CSV to be written to.
    Optional Args:
        info_prefix: String prefix to apply to INFO fields in the VCF.
        sample_prefix: String prefix to apply to SAMPLE fields in the VCF.
        sample_name_key: Field name in table for the name of the sample in VCF.
        default_values: A dict of {field: value} to replace values of a certain
            field in relation with the default value.
        column_mapping: A dict of {field: field} mapping field names in columns
            to field names in record, if some are named differently.

    Returns:
        None.
    """
    if filename is None:
        csvfile = tempfile.NamedTemporaryFile(delete=False)
        filename = csvfile.name
    else:
        csvfile = open(filename, 'w')
    table_cols = columns(table)
    relations = records_to_relations(vcfdata, table_cols, **kwargs)
    csv.writer(csvfile).writerows(relations)
    csvfile.close()
    return filename


def insert_csv(filename, tablename, engine):
    """Insert the relations in the CSV filename into table, using engine."""
    raw = engine.raw_connection()
    cur = raw.cursor()
    cur.execute("COPY {} FROM '{}' WITH (FORMAT csv);".format(tablename, filename))
    cur.close()
    raw.commit()
    return cur


def insert_vcf_with_copy(vcfreader, tablename, engine, **kwargs):
    """Inserts the calls from the VCF into the given table in engine

    Optimized via COPY from a temporary CSV.
    """
    con = engine.connect()
    meta = sqlalchemy.MetaData(bind=con)
    meta.reflect()
    table = meta.tables.get(tablename)
    filename = vcf_to_csv(vcfreader, table, None, **kwargs)
    insert_csv(filename, tablename, engine)
    con.close()


