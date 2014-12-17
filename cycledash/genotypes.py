"""Expose API to Genotypes and VCFs."""
from collections import OrderedDict
import copy

from sqlalchemy import (select, func, types, cast, join, outerjoin, asc, desc,
                        and_, Integer, Float, String)
from sqlalchemy.sql.expression import label, column
import vcf as pyvcf
from plone.memoize import forever

from cycledash import db
from common.helpers import tables


  ##############################################################################
 ##### The below functions are exposed via the controllers in views.py. #######
##############################################################################

@forever.memoize
def spec(vcf_id):
    """Return a dict describing the layout of the columns to be displayed.

    In form:
    {INFO: {attr1: {path: ['INFO', 'attr1'],
                          name: 'attr1',
                          info: {type: 'Integer', description: 'This col. et'}},
            ...},
    SAMPLE: {attrA: ...},
    ANNOTATIONS: {attrA: ...}}
    """
    with tables(db, 'vcfs') as (con, vcfs):
        q = (select([vcfs.c.vcf_header, vcfs.c.extant_columns])
                    .where(vcfs.c.id == vcf_id))
        res = con.execute(q).fetchone()
    return _header_spec(res['vcf_header'], res['extant_columns'])


@forever.memoize
def samples(vcf_id):
    """Return a sorted list of sample names found in the given vcf."""
    query = """SELECT sample_name FROM genotypes WHERE vcf_id = %s
    GROUP BY sample_name ORDER BY sample_name
    """
    with db.engine.connect() as connection:
        samples = connection.execute(query, (vcf_id,)).fetchall()
    return [sample for (sample,) in samples]


@forever.memoize
def contigs(vcf_id):
    """Return a sorted list of contig names found in the given vcf."""
    with tables(db, 'genotypes') as (con, genotypes):
        q = (select([genotypes.c.contig])
             .where(genotypes.c.vcf_id == vcf_id)
             .group_by(genotypes.c.contig)
             .order_by(func.length(genotypes.c.contig), genotypes.c.contig))
        results = con.execute(q).fetchall()
    return [contig for (contig,) in results]


def get(vcf_id, query, with_stats=True, truth_vcf_id=None):
    """Return a list of genotypes in a vcf conforming to the given query, as
    well as a dict of stats calculated on them.

    If a truth_vcf is associated with this VCF, stats include true/false,
    positive/negative stats, as well as precision, recall, and f1score. Stats
    also include the number of records, and the number of records once filters
    are applied.

    A query is a dictionary which specifies the range, filters, limit, offset
    and ordering which should be applied against genotypes before genotypes and
    stats are returned.

    It has structure:

    {range: {contig: "X", start: 0, end: 250000000},
     filters: [{columnName: 'info:DP', filterValue: '50', type: '<'}, ...],
     sortBy: [{columnName: 'contig', order: 'asc'},
              {columnName: 'position', order: 'asc'}, ...],
     page: 10,
     limit: 250
    }
    """
    query = _annotate_query_with_types(query, spec(vcf_id))
    if truth_vcf_id is None:
        vcf = _get_vcf_by_id(vcf_id)
        truth_vcf_id = derive_truth_vcf_id(vcf['dataset_name'])
    with tables(db, 'genotypes') as (con, g):
        if truth_vcf_id:
            # We consider a genotype validated if a truth genotype exists at its
            # location (contig/position) with the same ref/alts.  This isn't
            # entirely accurate: for example, it handles SVs very poorly.
            gt = g.alias()
            joined_q = outerjoin(g, gt, and_(
                gt.c.vcf_id == truth_vcf_id,
                g.c.contig == gt.c.contig,
                g.c.position == gt.c.position,
                g.c.reference == gt.c.reference,
                g.c.alternates == gt.c.alternates))
            valid_column = label('tag:true-positive', gt.c.contig != None)
            q = (select(g.c + [valid_column])
                 .select_from(joined_q)
                 .where(g.c.vcf_id == vcf_id))
        else:
            q = select(g.c).where(g.c.vcf_id == vcf_id)

        q = _add_range(q, g, query.get('range'))
        q = _add_filters(q, g, query.get('filters'))
        q = _add_orderings(q, g, query.get('sortBy'))
        q = _add_paging(q, g, query.get('limit'), query.get('page'))
        q = q.order_by(asc(func.length(g.c.contig)),
                       asc(g.c.contig),
                       asc(g.c.position))

        genotypes = [dict(g) for g in con.execute(q).fetchall()]
    stats = calculate_stats(vcf_id, truth_vcf_id, query) if with_stats else {}
    return {'records': genotypes, 'stats': stats}


@forever.memoize
def calculate_stats(vcf_id, truth_vcf_id, query):
    """Return stats for genotypes in vcf and truth_vcf conforming to query.

    Args:
       vcf_id: the vcf being examined.
       truth_vcf_id: the truth_vcf being validated against.
       query: the query object.
    """
    with tables(db, 'genotypes') as (con, genotypes):
        # The number of records being displayed:
        count_q = select([func.count()]).where(genotypes.c.vcf_id == vcf_id)
        count_q = _add_filters(count_q, genotypes, query.get('filters'))
        count_q = _add_range(count_q, genotypes, query.get('range'))
        (count,) = con.execute(count_q).fetchone()

        # The total number of records in VCF:
        total_count_q = select([func.count()]).where(
            genotypes.c.vcf_id == vcf_id)
        (total_count,) = con.execute(total_count_q).fetchone()
    return genotype_statistics(query, vcf_id, truth_vcf_id, count, total_count)


def genotype_statistics(query, vcf_id, truth_vcf_id, count, total_count):
    """Return precision, recall, f1score, and count statistics for the given
    query on vcf, validated against truth_vcf.
    """
    stats = {'totalRecords': count, 'totalUnfilteredRecords': total_count}

    if not truth_vcf_id:
        return stats

    with tables(db, 'genotypes') as (con, genotypes):
        g, gt = genotypes.alias(), genotypes.alias()
        joined_q = join(g, gt, and_(g.c.contig == gt.c.contig,
                                    g.c.position == gt.c.position,
                                    g.c.reference == gt.c.reference,
                                    g.c.alternates == gt.c.alternates))
        true_pos_q = select([func.count()]).select_from(joined_q).where(
            and_(g.c.vcf_id == vcf_id, gt.c.vcf_id == truth_vcf_id))
        true_pos_q = _add_filters(true_pos_q, g, query.get('filters'))
        true_pos_q = _add_range(true_pos_q, g, query.get('range'))

        query = _whitelist_query_filters(query)
        true_pos_q = _add_filters(true_pos_q, gt, query.get('filters'))
        true_pos_q = _add_range(true_pos_q, gt, query.get('range'))
        (true_positives,) = con.execute(true_pos_q).fetchone()

        # This calculates the total number of truth records given a subset of
        # the filters which makes sense to apply to a validation set.
        total_truth_q = select(
            [func.count()]).select_from(g).where(g.c.vcf_id == truth_vcf_id)
        total_truth_q = _add_filters(total_truth_q, g, query.get('filters'))
        total_truth_q = _add_range(total_truth_q, g, query.get('range'))
        (total_truth,) = con.execute(total_truth_q).fetchone()
        total_truth *= len(samples(vcf_id))

    stats.update(_true_false_pos_neg(true_positives, total_truth, count))
    return stats


def genotypes_for_records(vcf_id, query):
    """Return all genotypes which would appear on a row in a VCF (determined by
    CHROM/POS/REF/ALT) if just one genotype on that row passes the selections in
    `query'.

    This is used to generate the list of genotypes to be transformed into
    vcf.model._Records and then written to a VCF file.
    """
    query = _annotate_query_with_types(query, spec(vcf_id))
    with tables(db, 'genotypes') as (con, gt):
        keyfunc = func.concat(
            gt.c.contig, ':', cast(gt.c.position, types.Unicode), '::',
            gt.c.reference, '->', gt.c.alternates)
        filtered_gts_q = select([keyfunc]).where(gt.c.vcf_id == vcf_id)
        filtered_gts_q = _add_filters(filtered_gts_q, gt, query.get('filters'))
        filtered_gts_q = _add_range(filtered_gts_q, gt, query.get('range'))
        filtered_gts_q = filtered_gts_q.cte('filtered_gts')

        records_q = select([gt]).where(
            keyfunc.in_(select([filtered_gts_q]))).where(gt.c.vcf_id == vcf_id)
        records_q = records_q.order_by(asc(func.length(gt.c.contig)),
                                       asc(gt.c.contig),
                                       asc(gt.c.position),
                                       asc(gt.c.reference),
                                       asc(gt.c.alternates),
                                       asc(gt.c.sample_name))
        genotypes = [dict(g) for g in con.execute(records_q).fetchall()]
    return genotypes


   ############################################################################
  ### The below functions are helpers used to generate a SQLAlchemy select  ##
 ## object.                                                                ##
############################################################################

def _add_orderings(sql_query, table, sort_by):
    """
    Args:
      sort_by: a list of
        {order: asc | desc, columnName: name, sqlTyle: float | integer}
    """
    for sort_spec in sort_by:
        column_name = sort_spec['columnName']
        column_type = sort_spec.get('columnType', 'integer')
        order = sort_spec.get('order', 'asc')
        sql_query = _add_ordering(sql_query, table,
                                  column_type, column_name, order)
    return sql_query


def _add_ordering(sql_query, table, column_type, column_name, order):
    # Special case for this column, which sorts contigs correctly:
    if column_name == 'contig':
        contig_len_col = func.length(table.c.contig)
        contig_col = table.c.contig
        if order == 'desc':
            contig_len_col = desc(contig_len_col)
            contig_col = desc(contig_col)
        return sql_query.order_by(contig_len_col, contig_col)
    sqla_type = vcf_type_to_sqla_type(column_type)
    column = cast(table.c[column_name], type_=sqla_type)
    column = {'asc': asc(column), 'desc': desc(column)}.get(order)
    return sql_query.order_by(column)


def _add_paging(sql_query, table, limit, page):
    if limit:
        limit = int(limit)
        page = int(page)
        offset = limit * page
        sql_query = sql_query.limit(limit).offset(offset)
    return sql_query


def _add_filters(sql_query, table, filters):
    for filt in filters:
        column_name = filt.get('columnName')
        column_type = filt.get('columnType')
        value = filt.get('filterValue')
        op_name = filt.get('type')
        sql_query = _add_filter(
            sql_query, table, column_name, column_type, value, op_name)
    return sql_query


def _add_filter(sql_query, table, column_name, column_type, value, op_name):
    sqla_type = vcf_type_to_sqla_type(column_type)
    col = column(column_name)
    if table.c.get(column_name) is not None:
        col = cast(table.c[column_name], sqla_type)
    return {
        '=': sql_query.where(col == value),
        '!=': sql_query.where(col != value),
        '<': sql_query.where(col < value),
        '>': sql_query.where(col > value),
        '>=': sql_query.where(col >= value),
        '<=': sql_query.where(col <= value),
        'NULL': sql_query.where(col != None),
        'NOT NULL': sql_query.where(col == None),
        'LIKE': sql_query.where(col.like(value)),
        'RLIKE': sql_query.where(col.op('~*')(value))
    }.get(op_name)


def _add_range(sql_query, table, rangeq):
    rangeq = rangeq or {}
    contig = rangeq.get('contig')
    start = rangeq.get('start')
    end = rangeq.get('end')
    if contig:
        sql_query = sql_query.where(table.c.contig == contig)
    if start:
        sql_query = sql_query.where(table.c.position >= start)
    if end:
        sql_query = sql_query.where(table.c.position < end)
    return sql_query


def vcf_type_to_sqla_type(column_type='integer'):
    column_type = column_type.lower()
    return {'integer': Integer, 'float': Float}.get(column_type, String)


def derive_truth_vcf_id(dataset_name):
    with tables(db, 'vcfs') as (con, vcfs):
        truth_vcf_q = (select([vcfs.c.id])
                       .where(vcfs.c.validation_vcf == True)
                       .where(vcfs.c.dataset_name == dataset_name))
        truth_vcf_rel = con.execute(truth_vcf_q).fetchone()
        if truth_vcf_rel:
            return truth_vcf_rel.id


  ######################
 ### Helper methods: ##
######################

def _true_false_pos_neg(true_positives, total_truth_records, total_records):
    false_negatives = total_truth_records - true_positives
    false_positives = total_records - true_positives

    def safe_div(numerator, denom):
        return float(numerator) / denom if denom > 0 else 0

    precision = safe_div(true_positives, true_positives + false_positives)
    recall = safe_div(true_positives, true_positives + false_negatives)
    f1score = safe_div(2 * (precision * recall), precision + recall)

    return {
        'truePositives': true_positives,
        'falsePositives': false_positives,
        'falseNegatives': false_negatives,
        'precision': precision,
        'recall': recall,
        'f1score': f1score,
        'totalTruthRecords': total_truth_records
    }


def _header_spec(vcf_header_text, extant_cols):
    """Return dict representation of a CycleDash header."""
    reader = pyvcf.Reader(line for line in vcf_header_text.split('\n'))
    res = OrderedDict()
    for (supercolumn, attr) in [('info', 'infos'), ('sample', 'formats')]:
        res[supercolumn.upper()] = OrderedDict()
        for key, val in reader.__dict__[attr].iteritems():
            column_name = supercolumn + ':' + val.id
            if column_name not in extant_cols:
                continue
            _add_column_to_spec(
                spec=res,
                column_name=column_name,
                supercolumn=supercolumn,
                subcolumn=key,
                column_type=val.type,
                num=val.num,
                description=val.desc)

    # Sample name is not a part of the SAMPLE: hierarchy, but we want to add it
    # into that hierarchy for display purposes.
    _add_column_to_spec(
        spec=res,
        column_name='sample_name',
        supercolumn='SAMPLE',
        subcolumn='Sample Name',
        column_type='String',
        num=1,
        description='The name of the sample',
        path=['sample_name']) # This path is not the default super -> sub column

    # Add Cycledash-derived columns
    column_name = 'annotations:gene_names'
    if column_name in extant_cols:
        supercolumn, subcolumn = column_name.split(':')
        _add_column_to_spec(
            spec=res,
            column_name=column_name,
            supercolumn=supercolumn,
            subcolumn=subcolumn,
            column_type='String',
            num=1, # This number is not currently used
            description=(
                'Names of genes that overlap with this variant\'s '
                'starting position, derived from Ensembl Release 75.'))

    # Remove empty supercolumns
    for key, val in res.iteritems():
        if not val.keys():
            del res[key]

    return res


def _add_column_to_spec(spec, column_name, supercolumn, subcolumn,
                        column_type, num, description, path=None):
    """Add a column and associated attributes to the header specification.
    A column includes both a supercolumn (e.g. "SAMPLE") and subcolumn (e.g.
    "DP").
    """
    if supercolumn.upper() not in spec:
        spec[supercolumn.upper()] = OrderedDict()

    spec[supercolumn.upper()][subcolumn] = {
        'path': path if path is not None else [supercolumn, subcolumn],
        'columnName': column_name,
        'name': subcolumn,
        'info': {
            'type': column_type,
            'number': num,
            'description': description
        }
    }


def _find_column(spec, column_name):
    """Returns data for the column in the spec, or None."""
    for columns in spec.itervalues():
        for info in columns.itervalues():
            if info['columnName'] == column_name:
                return info
    return None


def _annotate_query_with_types(query, vcf_spec):
    """Adds a columnType field to each filter and sortBy in query."""
    operations = query.get('sortBy', []) + query.get('filters', [])
    for operation in operations:
        info = _find_column(vcf_spec, operation['columnName'])
        if not info:
            operation['columnType'] = 'string'
            continue
        column_type = info.get('info', {}).get('type', 'string').lower()
        operation['columnType'] = column_type
    return query


def _whitelist_query_filters(query, ok_fields=['reference', 'alternates']):
    """Returns query with only validation-appropriate filters.

    These are, by default: ['reference', 'alternates']"""
    query = copy.deepcopy(query)
    query['filters'] = [f for f in query['filters']
                        if f.get('columnName') in ok_fields]
    return query


def _get_vcf_by_id(vcf_id):
    with tables(db, 'vcfs') as (con, vcfs):
        vcf = con.execute(select([vcfs]).where(vcfs.c.id == vcf_id)).fetchone()
    return dict(vcf)
