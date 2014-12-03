/**
 * Utility functions for CycleDash Jest tests.
 */
'use strict';

var _ = require('underscore'),
    sinon = require('sinon');


/**
 * Apply a CSS selector to a React tree. Returns an array of DOM nodes.
 */
function findInComponent(selector, component) {
  return _.toArray(component.getDOMNode().querySelectorAll(selector));
}

/**
 * Stub out a React class method with the given function using Sinon.
 * Returns the Sinon stub. Don't forget to call .restore() on it!
 */
function stubReactMethod(ReactClass, method, fn) {
  return sinon.stub(ReactClass.type.prototype.__reactAutoBindMap, method, fn);
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
  mapValues,
  stubReactMethod
};
