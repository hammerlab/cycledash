/** @jsx */
/**
 * Utility functions for CycleDash Jest tests.
 */

var $ = require('jquery'),
    vcf = require('vcf.js')
    ;

/**
 * Apply a CSS selector to a React tree. Returns an array of DOM nodes.
 */
function findInComponent(selector, component) {
  return $(component.getDOMNode()).find(selector).toArray();
}


/**
 * Load and parse a VCF file from the local file system.
 */
function loadVcfData(path) {
  var vcfParser = vcf.parser();
  var data = require('fs').readFileSync(path, {encoding: 'utf8'});
  return vcfParser(data);
}


module.exports = {
  findInComponent,
  loadVcfData
};
