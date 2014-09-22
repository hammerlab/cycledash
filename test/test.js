var assert = require("assert");

var vcf = require("vcf.js");
require("../cycledash/static/js/examine/vcf.tools.js")(vcf);


var A = [{__KEY__: '2'}, {__KEY__: '4'},{__KEY__: '5'}],
    B = [{__KEY__: '1'}, {__KEY__: '2'}, {__KEY__: '3'}],
    C = [{__KEY__: '5'}, {__KEY__: '3'}, {__KEY__: '4'}];

describe('VCF.tools', function() {
  describe('difference()', function() {
    it('should return 2 records', function() {
      var diff = vcf.tools.difference(A, B);
      assert.equal(2, diff.length);
    })
    it('should contain the common records', function() {
      var diff = vcf.tools.difference(A, B);
      assert.equal('4', diff[0].__KEY__);
      assert.equal('5', diff[1].__KEY__);
    })
    it('should throw if unsorted', function() {
      assert.throws(function() {
        vcf.tools.difference(B, C);
      });
    })
  })

  describe('intersection()', function() {
    it('should return 1 records', function() {
      var intersection = vcf.tools.intersection(A, B);
      assert.equal(1, intersection.length);
    })
    it('should return the right record', function() {
      var intersection = vcf.tools.intersection(A, B);
      assert.equal('2', intersection[0].__KEY__);
    })
    it('should throw if unsorted', function() {
      assert.throws(function() {
        vcf.tools.intersection(C, A);
      });
    })
  })
})
