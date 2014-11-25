/**
 * Utility functions for CycleDash Jest tests.
 */
'use strict';

var $ = require('jquery'),
    _ = require('underscore');


/**
 * Apply a CSS selector to a React tree. Returns an array of DOM nodes.
 */
function findInComponent(selector, component) {
  return $(component.getDOMNode()).find(selector).toArray();
}


function makeObj(list, keyValFn) {
  return _.object(list.map(keyValFn));
}

function mapValues(o, fn) {
  return makeObj(_.pairs(o), function([k, v]) {
    return [k, fn(v, k)];
  });
}

module.exports = {
  findInComponent,
  makeObj,
  mapValues
};
