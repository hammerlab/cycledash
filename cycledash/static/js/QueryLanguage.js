'use strict';

var parser = require('../lib/querylanguage.js'),
    CompletionUtils = require('./CompletionUtils'),
    _ = require('underscore');


/**
 * Modifies the object by dropping all keys with falsy values.
 * Returns the modified object.
 */
function dropFalsyValues(o) {
  for (var k in o) {
    if (o.hasOwnProperty(k) && !o[k]) {
      delete o[k];
    }
  }
  return o;
}

/**
 */
function parse(query, columnNames) {
  var parsedQuery;
  try {
    parsedQuery = parser.parse(query);
  } catch (e) {
    return {error: e.name, original: e};
  }

  // Massage this into the JSON format that the backend expects.

  // Group by type & remove the type tags.
  var {filter, range, sort} = _.groupBy(parsedQuery, (info) => {
    var type = info.type;
    delete info.type;
    return type;
  });

  if (range && range.length > 1) {
    return {error: 'You may only specify one range (got ' + range.length + ')'};
  }
  if (sort) {
    if (sort.length > 1) {
      throw "Bug in the grammar: should only have one sort.";
    } else {
      sort = sort[0];
    }
  }

  // Flatten range structs
  if (range) {
    range = range[0];
    range = dropFalsyValues({
      contig: range.contig,
      start: range.range && range.range.start,
      end: range.range && range.range.end
    });
  }

  // Validate fields, converting to column names as we go.
  var errors = [];
  _.union(filter, sort && sort.fields).forEach((item) => {
    var field = item.field;
    if (!_.contains(columnNames, field)) {
      errors.push({error: 'Unknown field ' + field});
    } else {
      item['columnName'] = field;
      delete item['field'];
    }
  });
  if (errors.length) {
    return errors[0];
  }

  // Change `op` to `type`
  if (filter) {
    filter.forEach((item) => {
      var op = item.op;
      delete item.op;
      item.type = op;
    });
  }

  // Normalize "sort" fields.
  if (sort) {
    sort.fields.forEach((o) => {
      if (!o.order) o.order = 'asc';
      o.order = o.order.toLowerCase();
    });
    sort = sort.fields;
  }

  return dropFalsyValues({filters: filter, sortBy: sort, range: range});
}

/**
 * Returns a version of str which parses as a CQL value, surrounding it in
 * quotes and escaping characters as necessary. This prefers ' to " unless it
 * results in a longer string.
 * Helper for toString()
 */
function maybeQuote(str) {
  if (_.every(str, CompletionUtils.isChar)) {
    return str;  // no quoting necessary
  }

  // Use whichever quoting doesn't require escaping.
  // If escaping is unavoidable, prefer single quotes.
  var singleQuote = str.indexOf("'") >= 0,
      doubleQuote = str.indexOf('"') >= 0;
  if (!singleQuote) {
    return `'${str}'`;
  } else if (!doubleQuote) {
    return `"${str}"`;
  } else {
    var escaped = str.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
    return `'${escaped}'`;
  }
}

/**
 * Converts a parsed query back into a string.
 * Inverse of parse(), modulo spacing, capitalization, etc.
 */
function toString(parsedQuery) {
  // filters, sortBy, range
  var filters = [];
  if (parsedQuery.range && parsedQuery.range.contig) {
    var r = parsedQuery.range;
    var range = '';
    if (r.start || r.end) {
      var start = r.start || '',
          end = r.end || '';
      range = `${start}-${end}`;
    }
    filters.push(`${r.contig}:${range}`);
  }

  // e.g. {filters:[{type: '<', filterValue:'10', columnName:'A'}]}
  if (parsedQuery.filters) {
    filters = filters.concat(parsedQuery.filters.map(
        f => `${f.columnName} ${f.type} ${maybeQuote(f.filterValue)}`));
  }

  // e.g. {sortBy: [{"columnName": "sample:DP", "order": "desc"}]}
  var sortBy = '';
  if (parsedQuery.sortBy) {
    var sorts = parsedQuery.sortBy.map(
      sort => sort.columnName + (sort.order.toLowerCase() == 'desc' ? ' DESC' : ''));
    sortBy = 'ORDER BY ' + sorts.join(', ');
  }

  var pieces = [];
  if (filters.length) pieces.push(filters.join(' AND '));
  if (sortBy) pieces.push(sortBy);
  return pieces.join(' ');
}

/**
 * query{1,2} are parsed queries.
 * Two queries are equivalent if they have the same range, order by and filters
 * (modulo ordering).
 */
function isEquivalent(query1, query2) {
  // ordering matters for the sorts, but not the filters.
  var [sortedQ1, sortedQ2] = [query1, query2].map((q) => {
    var q = _.clone(q);
    q.filters = _.sortBy(q.filters, JSON.stringify);
    return q;
  });

  return toString(sortedQ1) == toString(sortedQ2);
}

module.exports = {
  parse,
  toString,
  isEquivalent
};
