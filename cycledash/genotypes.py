"""Expose API to Genotypes and VCFs."""
from collections import OrderedDict

import vcf

from cycledash import db


  ##############################################################################
 ##### The below functions are exposed via the controllers in views.py. #######
##############################################################################

def columns(vcf_id):
    """Return a dict describing the layout of the columns to be displayed.

    cf. vcf_header_spec"""
    query = "SELECT vcf_header, header_spec FROM vcfs WHERE id = %s"
    with db.engine.connect() as connection:
        res = dict(connection.execute(query, (vcf_id,)).fetchall()[0])
        spec = vcf_header_spec(res['vcf_header'], res['header_spec'])
    return spec


def contigs(vcf_id):
    """Return a sorted list of contig names found in the given vcf."""
    query = """SELECT contig FROM genotypes WHERE vcf_id = %s
    GROUP BY contig ORDER BY char_length(contig), contig
    """
    with db.engine.connect() as connection:
        contigs = connection.execute(query, (vcf_id,)).fetchall()
        contigs = [contig for (contig,) in contigs]
    return contigs


def get(vcf_id, query):
    """Return a list of genotypes in a vcf conforming to the given query."""
    with db.engine.connect() as connection:
        parameters = {'vcf_id': vcf_id}
        combined_sql = ''
        fns = [_select_sql, _range_sql, _filters_sql, _sort_by_sql,
               _limit_offset_sql]
        generated = (f(query, vcf_id) for f in fns)
        for (sql, params) in generated:
            parameters.update(params)
            combined_sql += '\n' + sql
        genotypes = connection.execute(combined_sql, parameters)
        genotypes = [dict(gt) for gt in genotypes.fetchall()]
    stats = calculate_stats(vcf_id, vcf_id, query)
    return {'records': genotypes, 'stats': stats}


def calculate_stats(vcf_id, truth_vcf_id, query):
    """Return stats for genotypes in vcf and truth_vcf (if not None) conforming
    to query.
    """
    with db.engine.connect() as connection:
        # TODO(ihodes): Try to guess truth_vcf_id if it's None.
        parameters = {'vcf_id': vcf_id}
        count_query = "SELECT count(*) FROM genotypes WHERE vcf_id = %(vcf_id)s"
        record_query = count_query
        generated = (f(query, vcf_id) for f in [_range_sql, _filters_sql])
        for sql, arg in generated:
            parameters.update(arg)
            record_query += '\n' + sql
        count = connection.execute(record_query, parameters).fetchall()[0][0]
        total_count = connection.execute(count_query, parameters).fetchall()[0][0]
        stats = genotype_statistics(connection, query, vcf_id, truth_vcf_id,
                                    count, total_count)
    return stats


  ##############################################################################
 ##### The below functions are helpers used to generate SQL for the above. ####
##############################################################################

def _select_sql(query, vcf_id):
    sql = "SELECT * FROM genotypes WHERE vcf_id = %(vcf_id)s"
    args = {'vcf_id': vcf_id}
    return sql, args


def _limit_offset_sql(query, vcf_id):
    limit = query.get('limit')
    offset = int(query.get('page')) * int(query.get('limit'))
    args = {'limit': limit, 'offset': offset}
    sql = " LIMIT %(limit)s OFFSET %(offset)s"
    return sql, args


def _range_sql(query, vcf_id, table_prefix=''):
    record_range = query.get('range', {})
    args = {}
    sql = ''
    contig = record_range.get('contig')
    if table_prefix:
        table_prefix = table_prefix + '.'
    if contig:
        args['contig'] = contig
        sql += " AND {}contig = %(contig)s".format(table_prefix)
        start = record_range.get('start')
        end = record_range.get('end')
        if start:
            args['start'] = start
            sql += ' AND {}position >= %(start)s'.format(table_prefix)
        if end:
            args['end'] = end
            sql += ' AND {}position < %(end)s'.format(table_prefix)
    return sql, args


def _filters_sql(query, vcf_id, table_prefix=''):
    filters = query.get('filters', [])
    if not filters:
        return '', {}
    combined_sql = ' '
    args = {}
    for idx, filt in enumerate(filters):
        sql, arg = _filter_sql(filt, idx, table_prefix)
        args.update(arg)
        combined_sql += ' AND ' + sql
    return combined_sql, args


def _filter_sql(filt, idx, table_prefix=''):
    column = filt.get('columnName')
    value = filt.get('filterValue')
    op_name = filt.get('type')
    if table_prefix:
        table_prefix = table_prefix + '.'
    # TODO(ihodes): SQL injection.
    if ':' in column:
        query = table_prefix + '"' + column + '"'
    else:
        query = table_prefix + column
    name = 'filter' + str(idx)
    arg = {name: value}
    if op_name == '=':
        query += " = %({})s".format(name)
    elif op_name == '<':
        query += "::INTEGER < %({})s".format(name)
    elif op_name == '>':
        query += "::INTEGER > %({})s".format(name)
    elif op_name == '>=':
        query += "::INTEGER >= %({})s".format(name)
    elif op_name == '<=':
        query += "::INTEGER <= %({})s".format(name)
    elif op_name == 'RLIKE':
        query += " ~* %({})s".format(name)
    elif op_name == 'LIKE':
        query += " LIKE %({})s".format(name)
    return query, arg


def _sort_by_sql(query, vcf_id):
    sort_by = query.get('sortBy', [])
    sql = ' ORDER BY '
    orders = []
    for spec in sort_by:
        col_name = spec.get('columnName')
        stmt = ' "{}"'.format(col_name) # TODO(ihodes): SQL injection.
        stmt += '::INTEGER ' if col_name != 'contig' else ' '
        stmt += 'desc' if 'desc' == spec.get('order') else 'asc'
        orders.append(stmt)
    sql += ', '.join(orders)
    return sql, {}


# TODO(ihodes): SQL injection, clean up, test for truth_vcf_id existence, etc.
def genotype_statistics(connection, query, vcf_id, truth_vcf_id,
                        num_records, num_unfiltered_records):
    stats = {'totalRecords': num_records,
             'totalUnfilteredRecords': num_unfiltered_records}

    if not truth_vcf_id:
        return stats

    true_pos_query = """
    SELECT count(*) FROM genotypes g
    INNER JOIN genotypes gt
    ON g.contig = gt.contig
     AND g.position = gt.position
     AND g.reference = gt.reference
     AND g.alternates = gt.alternates
    WHERE g.vcf_id = %(vcf_id)s
     AND gt.vcf_id = %(truth_vcf_id)s
    """
    fns = [_range_sql, _filters_sql]
    generated = (f(query, vcf_id, table_prefix='g') for f in fns)
    for sql, arg in generated:
        true_pos_query += '\n' + sql
    generated = (f(query, vcf_id, table_prefix='gt') for f in fns)
    for sql, arg in generated:
        true_pos_query += '\n' + sql

    truth_records_query = """
    SELECT count(*) FROM genotypes
    WHERE vcf_id = %(truth_vcf_id)s
    """
    parameters = {'vcf_id': vcf_id, 'truth_vcf_id': truth_vcf_id}
    generated = (f(query, vcf_id) for f in fns)
    for sql, arg in generated:
        parameters.update(arg)
        truth_records_query += '\n' + sql

    total_truth_records = connection.execute(truth_records_query, parameters).fetchall()[0][0]
    true_positives = connection.execute(true_pos_query, parameters).fetchall()[0][0]

    false_negatives = total_truth_records - true_positives
    false_positives = num_records - true_positives

    denom = (true_positives + false_positives)
    precision = (float(true_positives) / denom) if denom > 0 else 0
    denom = (true_positives + false_negatives)
    recall = (float(true_positives) / denom) if denom > 0 else 0
    denom = precision + recall
    f1score = (2 * (precision * recall) / denom) if denom > 0 else 0

    stats.update({
        'truePositives': true_positives,
        'falsePositives': false_positives,
        'falseNegatives': false_negatives,
        'precision': precision,
        'recall': recall,
        'f1score': f1score,
        'totalTruthRecords': total_truth_records
    })

    return stats


def vcf_header_spec(vcf_header_text, extant_cols):
    """Return dict repr of a VCF header.

    In form:
    {INFO: {attr1: {path: ['INFO', 'attr1'],
                          name: 'attr1',
                          info: {type: 'Integer', description: 'This col. et'}},
            ...},
     SAMPLE: {attrA:  ...}}
    """
    reader = vcf.Reader(line for line in vcf_header_text.split('\n'))

    res = OrderedDict()
    res['INFO'] = OrderedDict()
    for key, val in reader.infos.iteritems():
        column_name = 'info' + ':' + val.id
        if column_name not in extant_cols:
            continue
        res['INFO'][key] = {
            'path': ['info', val.id],
            'columnName': column_name,
            'name': val.id,
            'info': {
                'type': val.type,
                'number': val.num,
                'description': val.desc
            }
        }
    res['SAMPLE'] = OrderedDict()
    res['SAMPLE']['Sample Name'] = {
        'path': ['sample_name'],
        'columnName': 'sample_name',
        'name': 'Sample Name',
        'info': {
            'type': 'String',
            'number': 1,
            'description': 'The name of the sample'
        }
    }
    for key, val in reader.formats.iteritems():
        column_name = 'sample' + ':' + val.id
        if column_name not in extant_cols:
            continue
        res['SAMPLE'][key] = {
            'path': ['sample', val.id],
            'columnName': column_name,
            'name': val.id,
            'info': {
                'type': val.type,
                'number': val.num,
                'description': val.desc
            }
        }
    return res

# Request:
#  vcf_id => X
#  filters => [{attribute: '/sample:DP', value: '>50'}, // '/' designates the attribute a path
#              {attribute: 'variantType', value: 'SNV'},
#              {attribute: 'validated', value: true}]
#  range => {contigName: '20', start: 1204, end: 598874987}  // nullable for ALL, start/end nullable for 0/[end]
#  sortBy => [{path: 'sampleName:DP', order: 'desc'}, ...]
#
#  charts => [{path: '*'},  // for karyogram depth chart
#             {path: 'info:DP'},  // for a depth chart
#             {}... ]
#
#  page => 1 // handle paging of results
#  limit => 100 // # records sent to client
#
#
# Return:
#  records => list of records on page
#  charts => [{path: '*', vals: [1203, 12401204, ..]}]
#  stats => {tp: 123, fp: 124, fn: 1241}
#
#
# Issues: How do we know which columns to display in the UI? we don't want them
#         to change based on the records returned?  This is a problem because
#         different rows can have different FORMATs.
#
# NB: Note that different samples now end up on different rows.
#
#
