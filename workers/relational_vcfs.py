"""Convert VCF records into relations according to a SQL table.
"""
from collections import OrderedDict
import csv
import tempfile

import sqlalchemy


SAMPLE_PREFIX = 'sample:'
INFO_PREFIX = 'info:'
SAMPLE_NAME_KEY = 'sample_name'
DEFAULT_VALUES = {}
COLUMN_MAPPING = {'position': 'POS', 'contig': 'CHROM',
                  'reference': 'REF', 'alternates': 'ALT',
                  'quality': 'QUAL', 'filters': 'FILTER'}


def columns(table):
    """Return a list of columns in the given table."""
    return [c.name for c in table.columns]


def prefix_keys(dct, prefix):
    """Return a dict with all keys prefixed with string prefix."""
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
    """Return a list generated from flat_record conforming to types in
    columns, and the fields corresponding to the values in the flat_record.
    The relation is in the same order as columns.

    Args:
        flat_record: A dict of {field: value} representing a VCF record.
        columns: An list of column names.
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
    for field in columns:
        record_field = field
        value = None
        if field in column_mapping:
            record_field = column_mapping[field]
        if record_field in flat_record:
            value = flat_record[record_field]
            # We ignore all types (== TEXT).
            value = str(value) if value is not None else ''
        elif record_field in default_values:
            value = default_values.get(field)
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


def vcf_to_csv(vcfdata, columns, filename, **kwargs):
    """Insert all flattened records in VCF into a CSV.

    Args:
        vcfdata: A vcf.Reader of records.
        columns: An list of columns.
        filename: The name of the CSV to be written to.

    Returns:
        The name of the CSV file.
    """
    if filename is None:
        csvfile = tempfile.NamedTemporaryFile(delete=False)
        filename = csvfile.name
    else:
        csvfile = open(filename, 'w')
    relations = records_to_relations(vcfdata, columns, **kwargs)
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

    Args:
        vcfreader: A PyVCF Reader object on the VCF being inserted.
        tablename: The string name of the table being inserted into.
        engine: A SQLAlchemy engine object to the database.

    Optional Args:
        info_prefix: String prefix to apply to INFO fields in the VCF.
        sample_prefix: String prefix to apply to SAMPLE fields in the VCF.
        sample_name_key: Field name in table for the name of the sample in VCF.
        default_values: A dict of {field: value} to replace values of a certain
            field in relation with the default value.
        column_mapping: A dict of {field: field} mapping field names in columns
            to field names in record, if some are named differently.

    Optimized via COPY from a temporary CSV.
    """
    con = engine.connect()
    meta = sqlalchemy.MetaData(bind=con)
    meta.reflect()
    table = meta.tables.get(tablename)
    table_cols = columns(table)
    filename = vcf_to_csv(vcfreader, table_cols, None, **kwargs)
    insert_csv(filename, tablename, engine)
    con.close()


