'use strict';

var utils = require('../../cycledash/static/js/examine/utils'),
    assert = require('assert'),
    React = require('react/addons');

describe('Examine Utils', function() {
  var igvHttpfsUrl = 'http://example.com';

  it('should generate IGV links', function() {
    var uri = '/snv.vcf',
        normal_bam = {uri: '/normal.bam'},
        tumor_bam = {uri: '/tumor.bam'};

    // No BAMs
    var run = { uri };
    assert.equal('http://localhost:60151/load?user=cycledash&genome=hg19&file=http://example.com/snv.vcf&name=Run',
                 utils.makeIGVLink(run, igvHttpfsUrl));

    // One BAM
    run = { uri, normal_bam };
    assert.equal('http://localhost:60151/load?user=cycledash&genome=hg19&file=http://example.com/snv.vcf,http://example.com/normal.bam&name=Run,Normal',
                 utils.makeIGVLink(run, igvHttpfsUrl));

    // Two BAMs
    run = { uri, normal_bam, tumor_bam };
    assert.equal('http://localhost:60151/load?user=cycledash&genome=hg19&file=http://example.com/snv.vcf,http://example.com/normal.bam,http://example.com/tumor.bam&name=Run,Normal,Tumor',
                 utils.makeIGVLink(run, igvHttpfsUrl));
  });
});
