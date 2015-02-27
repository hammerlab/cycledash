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
 * Construct a link template for opening IGV with all the available data.
 * run is a run object, as passed to the ExaminePage or RecordStore.
 */
function makeIGVLink(run, igvHttpfsUrl) {
  function fileUrl(file) {
    return igvHttpfsUrl + file;
  }

  var nameFilePairs = [
      ['Run', run.uri],
      ['Normal', run.normal_bam_uri], 
      ['Tumor', run.tumor_bam_uri]
  ].filter(x => x[1]);

  var fileParam = nameFilePairs.map(x => fileUrl(x[1])).join(','),
      nameParam = nameFilePairs.map(x => x[0]).join(',');

  return `http://localhost:60151/load?user=cycledash&genome=hg19` +
      `&file=${fileParam}&name=${nameParam}`;
}


module.exports = { getIn, juxt, makeIGVLink };
