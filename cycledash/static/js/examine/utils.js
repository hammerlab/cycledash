/** @jsx */
"use strict";

var _ = require('underscore');


/**
 * Returns the value in object found at path.
 *
 * e.g. obj = {a: [0, {b: 'Whoa'}, 2]}, path = ['a', 1, 'b'] => 'Whoa'.
 */
function getIn(obj, path) {
  for (var i = 0; i < path.length; i++) {
    obj = obj[path[i]];
  }
  return obj;
}

function juxt(fns) {
  return o => _.map(fns, fn => fn(o));
}

/**
 * Given a path and records, get all non-null/undefined/NaN values at that path.
 */
function recordValues(records, path) {
  return records.map(function(record) {
    return getIn(record, path);
  }).filter(function(record) {
    return !(_.isNull(record) || _.isUndefined(record) || _.isNaN(record));
  });
}

module.exports = { getIn, juxt, recordValues };
