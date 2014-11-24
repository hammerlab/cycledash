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

module.exports = { getIn, juxt };
