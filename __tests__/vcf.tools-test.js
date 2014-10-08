/** @jsx */
jest
    .dontMock('vcf.js')
    .dontMock('../cycledash/static/js/examine/vcf.tools.js')
    .dontMock('underscore')

var assert = require('assert'),
    vcfTools = require('../cycledash/static/js/examine/vcf.tools.js');

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
})
