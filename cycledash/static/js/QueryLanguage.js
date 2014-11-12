/** @jsx React.DOM */
var parser = require('../lib/querylanguage.js'),
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
  var {filter,range,sort} = _.groupBy(parsedQuery, (info) => {
    var type = info.type;
    delete info.type;
    return type;
  });

  if (range && range.length > 1) {
    return {error: 'You may only specify one range (got ' + range.length + ')'};
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
  _.union(filter,sort).forEach((item) => {
    var field = item.field;
    if (!_.contains(columnNames, field)) {
      errors.push({error: 'Unknown field ' + field});
    } else {
      item['column_name'] = field.split('.');
      delete item['field'];
    }
  });
  if (errors.length) {
    return errors[0];
  }

  // Normalize "sort" fields.
  if (sort) {
    sort.forEach((o) => {
      if (!o.order) o.order = 'asc';
      o.order = o.order.toLowerCase();
    });
  }

  return dropFalsyValues({filters: filter, sortBy: sort, range: range});
}

module.exports = {
  parse
};
