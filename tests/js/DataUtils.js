'use strict';
var _ = require('underscore'),
    fs = require('fs'),
    vcf = require('vcf.js'),
    Utils = require('./Utils');

function getSpec(vcfData) {
  var samples = {
    'INFO': vcfData.header.INFO,
    'SAMPLE': vcfData.header.FORMAT
  };

  var makeColumn = function(columnName, desc, num, type, name) {
    return {
      columnName: columnName,
      info: {
        description: desc,
        number: num,
        type: type,
      },
      name: name,
      path: columnName.split(':')
    };
  };

  var cols = Utils.mapValues(samples, function(fields, sampleName) {
    return Utils.makeObj(fields, (column) => [column.ID, makeColumn(
        sampleName.toLowerCase() + ':' + column.ID,
        column.Description,
        column.Number,
        column.Type,
        column.ID)]);
  });

  // TODO: add sample_name

  return cols;
}

function getContigs(vcfData) {
  return _.uniq(vcfData.records.map(rec => rec.CHROM));
}

function getRecords(vcfData) {
  var spec = getSpec(vcfData);
  return _.flatten(vcfData.records.map((record) => {
    var baseProps = {
      contig: record.CHROM,
      position: record.POS,
      reference: record.REF,
      alternates: record.ALT.join(',')
    };
    var infoProps = _.object(_.values(spec.INFO).map(colSpec => {
                      return [colSpec.columnName, record.INFO[colSpec.name]];
                    }));
    _.extend(baseProps, infoProps);

    return vcfData.header.sampleNames.map(sampleName => {
      var sampleProps = _.object(_.values(spec.SAMPLE).map(colSpec => {
        var path = ['sample', colSpec.name];
        return [path.join(':'), record[sampleName][colSpec.name]];
      }));
      return _.extend({}, baseProps, sampleProps, {sample_name: sampleName});
    });
  }));
}

/**
 * Fake for jQuery's $.ajax() which responds to requests for these URLs using
 * data from a VCF file on local disk:
 *  - /runs/1/genotypes
 *  - /runs/1/comments
 */
function makeFakeServer(vcfPath, commentsResponse) {
  var parseVcf = vcf.parser(),
      vcfData = parseVcf(fs.readFileSync(vcfPath, {encoding:'utf8'})),
      spec = getSpec(vcfData),
      contigs = getContigs(vcfData),
      records = getRecords(vcfData);

  var GENOTYPES_URL = '/runs/1/genotypes';
  var COMMENTS_URL = '/runs/1/comments';
  var ajax = function(path, type, data, callback, failCallback) {
    if (path.slice(0, GENOTYPES_URL.length) === GENOTYPES_URL) {
      callback({
        records: records,
        stats: {
          totalRecords: records.length,
          totalUnfilteredRecords: records.length
        }
      });
    } else if (path.slice(0, COMMENTS_URL.length) === COMMENTS_URL) {
      commentsResponse(path, type, data, callback, failCallback);
    } else {
      throw new Error('Unexpected request for ' + path);
    }
  };

  // Include references to the underlying data in case it's helpful.
  _.extend(ajax, {spec, contigs, records});

  return ajax;
}

module.exports = {
  getSpec,
  getContigs,
  getRecords,
  makeFakeServer
};
