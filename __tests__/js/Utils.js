/**
 * Utility functions for CycleDash Jest tests.
 *
 * @jsx
 */

var $ = require('jquery'),
    vcf = require('vcf.js');

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

// Fake for jQuery's $.get() which returns a test VCF.
function fakeGet(realPath) {
  return function(path) {
    if (!path.match(/^\/vcf/)) {
      throw new Error("Yikes, surprising AJAX request! " + path);
    }

    // Return an already-resolved deferred with the data.
    var data = require('fs').readFileSync(realPath, 'utf8');

    return $.when(data);
  };
}


module.exports = {
  findInComponent,
  loadVcfData,
  fakeGet
};
