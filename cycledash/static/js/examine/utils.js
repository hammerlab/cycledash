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

/**
 * Return true if the predicate applied consecutively to the first elements of
 * the lists, then the second, etc.
 *
 * e.g. everyOver([1,2,3], [1,2,3], equals) => true
 *      everyOver([1,2,3], [7,2,3], equals) => false
 */
function everyOver(/* list* pred */) {
  var args = _.toArray(arguments),
      pred = args.pop(),
      lists = args;
  var tuples = _.zip.apply(null, lists);
  return _.every(tuples, function(tuple) {
    return pred.apply(null, tuple);
  });
}

/** Return true if all arguments are equal. */
function equals(/* els */) {
  return _.uniq(arguments).length == 1;
}


module.exports = {
  getIn: getIn,
  everyOver: everyOver,
  equals: equals
};