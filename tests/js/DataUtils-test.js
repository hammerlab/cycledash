'use strict';

var DataUtils = require('./DataUtils'),
    assert = require('assert'),
    fs = require('fs'),
    vcf = require('vcf.js'),
    _ = require('underscore');

describe('DataUtils', function() {
  var vcfData;
  before(function() {
    var parseVcf = vcf.parser();  // Note: the real deal, not a fake!
    vcfData = parseVcf(
        fs.readFileSync('tests/data/snv.vcf', {encoding:'utf8'}));
  });

  it('should generate contigs', function() {
    assert.deepEqual(['20'], DataUtils.getContigs(vcfData));
  });

  it('should generate a column spec', function() {
    var spec = DataUtils.getSpec(vcfData);
    assert.deepEqual(['INFO', 'SAMPLE'], _.keys(spec));
    assert.deepEqual(['DP','SOMATIC','SS','SSC','GPV','SPV'], _.keys(spec.INFO));
    assert.deepEqual(['GT','GQ','DP','RD','AD','FREQ','DP4'], _.keys(spec.SAMPLE));
    assert.deepEqual({
      columnName: 'sample:GT',
      info: {
        description: 'Genotype',
        number: 1,
        type: 'String'
      },
      name: 'GT',
      path: ['sample','GT']
    }, spec.SAMPLE.GT);
  });

  it('should generate a record', function() {
    var records = DataUtils.getRecords(vcfData);
    assert.equal(20, records.length);  // 10 records x 2 samples/record
    assert.deepEqual({
      contig: '20',
      position: 61795,
      reference: 'G',
      alternates: 'T',
      'info:DP': 81,
      'info:SOMATIC': undefined,
      'info:SS': 1,
      'info:SSC': 2,
      'info:GPV': 4.6768e-16,
      'info:SPV': 0.54057,
      'sample:GT': '0/1',
      'sample:GQ': null,
      'sample:DP': 44,
      'sample:RD': 22,
      'sample:AD': 22,
      'sample:FREQ': '50%',
      'sample:DP4': [16, 6, 9, 13],
      sample_name: 'NORMAL'
    }, records[0]);
    // Record 1 is the same as record 0, except for sample fields.
    assert.equal('TUMOR', records[1].sample_name);
    assert.equal('20', records[1].contig);
    assert.equal(61795, records[1].position);
    assert.equal(19, records[1]['sample:AD']);  // != same in records[0]
  });
});
