/** @jsx */
jest
    .dontMock('fs')
    .dontMock('vcf.js')
    .dontMock('../cycledash/static/js/examine/vcf.tools.js')
    .dontMock('underscore')

var assert = require('assert'),
    vcfTools = require('../cycledash/static/js/examine/vcf.tools.js'),
    _ = require('underscore');

var svs = [{__KEY__: '1', POS: 0, INFO: { END: 100}},
           {__KEY__: '2', POS: 100, INFO: { END: 200}},
           {__KEY__: '3', POS: 800, INFO: { END: 900}},],
    svsTruth = [{__KEY__: '3', POS: 850,
                 INFO: { END: 1020,
                         CIPOS: [-100],
                         CIEND: [100]}},
                {__KEY__: '4', POS: 2000,
                 INFO: { END: 2050}}],
    snvs = [{__KEY__: 'good1'}, {__KEY__: 'bad2'},
            {__KEY__: 'bad3'}, {__KEY__: 'good2'}, {__KEY__: 'bad1'}],
    snvsTruth = [{__KEY__: 'good1'}, {__KEY__: 'forgot me!'}, {__KEY__: 'good2'}];


describe('VCF.tools', function() {
  function loadVcfData(path) {
    var vcfParser = require('vcf.js').parser();
    var data = require('fs').readFileSync(path, {encoding: 'utf8'});
    return vcfParser(data);
  }

  describe('trueFalsePositiveNegativeForSVs()', function() {
    it('should return correct stats', function() {
      var {truePositives, falsePositives, falseNegatives} =
          vcfTools.trueFalsePositiveNegativeForSvs(svs, svsTruth);

      assert.equal(truePositives, 1);
      assert.equal(falsePositives, 2);
      assert.equal(falseNegatives, 1);
    })
  })

  describe('trueFalsePositiveNegativeForSNVandINDELs()', function() {
    it('should return correct stats', function() {
      var {truePositives, falsePositives, falseNegatives} =
          vcfTools.trueFalsePositiveNegativeForSnvAndIndels(snvs, snvsTruth);

      assert.equal(truePositives, 2);
      assert.equal(falsePositives, 3);
      assert.equal(falseNegatives, 1);
    })
  })

  describe('deriveColumns', function() {
    it('should produce correct columns for a test VCF file', function() {
      var vcfData = loadVcfData('__tests__/data/snv.vcf');
      var columns = vcfTools.deriveColumns(vcfData);

      // The full object is quite large. We assert specific aspects for brevity.
      expect(_.keys(columns)).toEqual(['INFO', 'NORMAL', 'TUMOR']);
      expect(_.keys(columns.INFO)).toEqual(['DP', 'SS', 'SSC', 'GPV', 'SPV']);
      expect(_.keys(columns.NORMAL)).toEqual(
          ['GT', 'GQ', 'DP', 'RD', 'AD', 'FREQ', 'DP4']);
      expect(_.keys(columns.NORMAL)).toEqual(_.keys(columns.TUMOR));

      expect(columns.INFO.DP).toEqual({
          name: 'DP',
          path: [ 'INFO', 'DP' ],
          info: {
            'ID': 'DP',
            'Number': 1,
            'Type': 'Integer',
            'Description': 'Total depth of quality bases'
          }
        });

      expect(columns.NORMAL.AD).toEqual({
          name: 'AD',
          path: [ 'NORMAL', 'AD' ],
          info: {
            'ID': 'AD',
            'Number': 1,
            'Type': 'Integer',
            'Description': 'Depth of variant-supporting bases (reads2)'
          },
        });
    });
  });
})
