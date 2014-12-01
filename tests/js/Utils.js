/**
 * Utility functions for CycleDash Jest tests.
 */
'use strict';

var _ = require('underscore');


/**
 * Apply a CSS selector to a React tree. Returns an array of DOM nodes.
 */
function findInComponent(selector, component) {
  return _.toArray(component.getDOMNode().querySelectorAll(selector));
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
