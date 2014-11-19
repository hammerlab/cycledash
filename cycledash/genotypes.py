"""Expose API to Genotypes and VCFs."""
from collections import OrderedDict

import vcf

from cycledash import db


  ##############################################################################
 ##### The below functions are exposed via the controllers in views.py. #######
##############################################################################

def spec(vcf_id):
    """Return a dict describing the layout of the columns to be displayed.

    In form:
    {INFO: {attr1: {path: ['INFO', 'attr1'],
                          name: 'attr1',
                          info: {type: 'Integer', description: 'This col. et'}},
            ...},
    SAMPLE: {attrA:  ...}}
    """
    query = "SELECT vcf_header, header_spec FROM vcfs WHERE id = %s"
    with db.engine.connect() as connection:
        res = dict(connection.execute(query, (vcf_id,)).fetchall()[0])
        spec = _vcf_header_spec(res['vcf_header'], res['header_spec'])
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
    """Return a genotypes in a vcf conforming to the given query, as well as a
    dictof stats calculated on them.

    If a truth_vcf is associated with this VCF, stats include true/false,
    positive/negative stats, as well as precision, recall, and f1score. Stats
    also include the number of records, and the number of records once filters
    are applied.

    A query is a dictionary which specifies the range, filters, limit, offset
    and ordering which should be applied against genotypes before genotypes and
    stats are returned.

    It has structure:

    {range: {contig: "X", start: 0, end: 250000000},
     filters: [{columnName: 'info:DP', filterValye: '50', type: '<'}, ...],
     sortBy: [{columnName: 'contig', order: 'asc'},
              {columnName: 'position', order: 'asc'}, ...],
     page: 10,
     limit: 250
    }

    """
    with db.engine.connect() as connection:
        parameters = {'vcf_id': vcf_id}
        fns = [_select_sql, _range_sql, _filters_sql, _sort_by_sql,
               _limit_offset_sql]
        combined_sql, parameters = _generate_query('', parameters, query,
                                                   vcf_id, fns)
        genotypes = connection.execute(combined_sql, parameters)
        genotypes = [dict(gt) for gt in genotypes.fetchall()]
    # TODO: dervice truth_vcf, replace None with it
    stats = calculate_stats(vcf_id, None, query)
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


   #############################################################################
  #### The below functions are helpers used to generate SQL for the above. ####
 ####    - All functions below return (sql_string, param_dict).           ####
#############################################################################

def _select_sql(query, vcf_id, table=''):
    # 'table' isn't used here -- just conforms to other _X_sql fn's signatures.
    sql = "SELECT * FROM genotypes WHERE vcf_id = %(vcf_id)s"
    args = {'vcf_id': vcf_id}
    return sql, args


def _limit_offset_sql(query, vcf_id, table=''):
    # 'table' isn't used here -- just conforms to other _X_sql fn's signatures.
    limit = query.get('limit')
    offset = int(query.get('page')) * int(query.get('limit'))
    args = {'limit': limit, 'offset': offset}
    sql = " LIMIT %(limit)s OFFSET %(offset)s"
    return sql, args


def _range_sql(query, vcf_id, table=''):
    record_range = query.get('range', {})
    args = {}
    sql = ''
    contig = record_range.get('contig')
    if table:
        table = table + '.'
    if contig:
        args['contig'] = contig
        sql += " AND {}contig = %(contig)s".format(table)
        start = record_range.get('start')
        end = record_range.get('end')
        if start:
            args['start'] = start
            sql += ' AND {}position >= %(start)s'.format(table)
        if end:
            args['end'] = end
            sql += ' AND {}position < %(end)s'.format(table)
    return sql, args


def _filters_sql(query, vcf_id, table=''):
    filters = query.get('filters', [])
    if not filters:
        return '', {}
    combined_sql = ' '
    args = {}
    for idx, filt in enumerate(filters):
        sql, arg = _filter_sql(filt, idx, table)
        args.update(arg)
        combined_sql += ' AND ' + sql
    return combined_sql, args


def _filter_sql(filt, idx, table=''):
    column = filt.get('columnName')
    value = filt.get('filterValue')
    op_name = filt.get('type')
    if table:
        table = table + '.'
    # TODO(ihodes): SQL injection.
    if ':' in column:
        query = '{}"{}"'.format(table, column)
    else:
        query = table + column
    name = 'filter' + str(idx)
    arg = {name: value}
    query += {
        '=': " = %({})s",
        '<': "::INTEGER < %({})s",
        '>': "::INTEGER > %({})s",
        '>=': "::INTEGER >= %({})s",
        '<=': "::INTEGER <= %({})s",
        'RLIKE': " ~* %({})s",
        'LIKE': " LIKE %({})s"
    }.get(op_name, '').format(name)
    return query


def _sort_by_sql(query, vcf_id, table=''):
    sort_by = query.get('sortBy', [])
    if not sort_by:
        return '', {}
    sql = ' ORDER BY '
    orders = []
    if table:
        table += '.'
    for spec in sort_by:
        col_name = table + spec.get('columnName')
        col_type = '::INTEGER ' if col_name != 'contig' else ' '
        order = 'desc' if 'desc' == spec.get('order') else 'asc'
        # TODO(ihodes): SQL injection.
        orders.append('"{}"{} {}'.format(col_name, col_type, order))
    sql += ', '.join(orders)
    return sql, {}


  ######################
 ### Helper methods: ##
######################

def _generate_query(base_sql, base_params, query, vcf_id, sql_generator_functions,
                    table=''):
    """Return (sql_string, params) by applying the sql_generator_functions to
    query, vcf_id, and tabnle_prefix, concatenating their results to base_sql,
    and adding their params to base_params.
    """
    gen = (f(query, vcf_id, table=table)
           for f in sql_generator_functions)
    for sql, arg in gen:
        base_params.update(arg)
        base_sql += '\n' + sql
    return base_sql, base_params


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
    true_pos_query, _ = _generate_query(true_pos_query, {}, query, vcf_id, fns,
                                        table='g')
    true_pos_query, _ = _generate_query(true_pos_query, {}, query, vcf_id, fns,
                                        table='gt')

    truth_records_query = """
    SELECT count(*) FROM genotypes
    WHERE vcf_id = %(truth_vcf_id)s
    """
    parameters = {'vcf_id': vcf_id, 'truth_vcf_id': truth_vcf_id}
    truth_records_query, parameters = _generate_query(truth_records_query,
                                                      parameters, query,
                                                      vcf_id, fns)

    total_truth_records = connection.execute(truth_records_query, parameters).fetchall()[0][0]
    true_positives = connection.execute(true_pos_query, parameters).fetchall()[0][0]

    stats.update(_calculate_true_false_pos_neg(true_positives,
                                               total_truth_records,
                                               num_records))
    return stats


def _calculate_true_false_pos_neg(true_positives,
                                  total_truth_records,
                                  total_records):
    false_negatives = total_truth_records - true_positives
    false_positives = total_records - true_positives

    denom = (true_positives + false_positives)
    precision = (float(true_positives) / denom) if denom > 0 else 0
    denom = (true_positives + false_negatives)
    recall = (float(true_positives) / denom) if denom > 0 else 0
    denom = precision + recall
    f1score = (2 * (precision * recall) / denom) if denom > 0 else 0

    return {
        'truePositives': true_positives,
        'falsePositives': false_positives,
        'falseNegatives': false_negatives,
        'precision': precision,
        'recall': recall,
        'f1score': f1score,
        'totalTruthRecords': total_truth_records
    }


def _vcf_header_spec(vcf_header_text, extant_cols):
    """Return dict repr of a VCF header."""
    reader = vcf.Reader(line for line in vcf_header_text.split('\n'))
    res = OrderedDict()
    for (supercolumn, attr) in [('info', 'infos'), ('sample', 'formats')]:
        res[supercolumn.upper()] = OrderedDict()
        for key, val in reader.__dict__[attr].iteritems():
            column_name = supercolumn + ':' + val.id
            if column_name not in extant_cols:
                continue
            res[supercolumn.upper()][key] = {
                'path': [supercolumn, val.id],
                'columnName': column_name,
                'name': val.id,
                'info': {
                    'type': val.type,
                    'number': val.num,
                    'description': val.desc
                }
            }

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

    # Remove empty supercolumns
    for key, val in res.iteritems():
        if not val.keys():
            del res[key]

    return res
