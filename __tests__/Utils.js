/** @jsx */
/**
 * Utility functions for CycleDash Jest tests.
 */

var $ = require('jquery');

/**
 * Apply a CSS selector to a React tree. Returns an array of DOM nodes.
 */
function findInComponent(selector, component) {
  return $(component.getDOMNode()).find(selector).toArray();
}

module.exports = {
  findInComponent
};
