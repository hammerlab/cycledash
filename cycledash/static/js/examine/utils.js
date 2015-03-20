"use strict";

var _ = require('underscore');


// This is where IGV listens for commands.
// See http://www.broadinstitute.org/igv/PortCommands
var LOCAL_IGV_HOST = 'localhost:60151';


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
      ['Normal', run.normal_bam && run.normal_bam.uri],
      ['Tumor', run.tumor_bam && run.tumor_bam.uri]
  ].filter(x => x[1]);

  var fileParam = nameFilePairs.map(x => fileUrl(x[1])).join(','),
      nameParam = nameFilePairs.map(x => x[0]).join(',');

  return `http://${LOCAL_IGV_HOST}/load?user=cycledash&genome=hg19` +
      `&file=${fileParam}&name=${nameParam}`;
}

/**
 * Extracts a flat list of column names from the uber-columns object.
 * This can be used as a list of CQL column names.
 */
function extractFlatColumnList(columns) {
  // columns looks something like {SAMPLE: {DP: {columnName: ...}}}
  var samples = _.values(columns);
  var columnInfos = _.flatten(samples.map(_.values));
  var columnNames = _.pluck(columnInfos, 'columnName');
  return ['reference', 'alternates', 'contig', 'position'].concat(columnNames);
}

function getRowKey(record) {
  return record.contig +
  record.position +
  record.reference +
  record.alternates +
  record.sample_name;
}

module.exports = { getIn, juxt, makeIGVLink, extractFlatColumnList,
                   getRowKey };
