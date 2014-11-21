/** @jsx React.DOM */

var _ = require('underscore'),
    assert = require('assert'),
    CompletionUtils = require('../../cycledash/static/js/CompletionUtils.js');

var {
  cartesianProductOf,
  filterPrefix,
  firstToken,
  flatMap,
  normalizeSpacing,
  withoutLastToken
} = CompletionUtils;

describe('CompletionUtils', function() {
  describe('normalizeSpacing', function() {
    it('Should remove internal whitespace', function() {
      assert.deepEqual(normalizeSpacing('A  B  C'), 'A B C');
    });
    it('Should ignore whitespace in quotes', function() {
      assert.deepEqual(normalizeSpacing('A  "B  C"    D'), 'A "B  C" D');
    });
    it('Should strip leading but not trailing whitespace', function() {
      assert.equal(normalizeSpacing('   A  D    '), 'A D ');
    });
    it('Should add whitespace around tokens', function() {
      assert.equal(normalizeSpacing('A>B>C'), 'A > B > C');
      assert.equal(normalizeSpacing('A<'), 'A <');
      assert.equal(normalizeSpacing('A<"A<B"'), 'A < "A<B"');
    });
  });

  describe('filterPrefix', function() {
    it('Should filter simple strings', function() {
      assert.deepEqual(filterPrefix(['A', 'B', 'C', 'BC'], 'B'),
                                    ['B', 'BC']);
    });

    it('Should ignore case differences', function() {
      assert.deepEqual(filterPrefix(['ORDER BY A', 'ORDER BY B'], 'ord'),
                                    ['ordER BY A', 'ordER BY B']);
    });

    it('Should ignore internal whitespace differences', function() {
      assert.deepEqual(filterPrefix(['ORDER BY  A', 'ORDER BY B'], 'ordER   BY'),
                                    ['ordER   BY A', 'ordER   BY B']);
    });

    it('Should filter with leading whitespace', function() {
      assert.deepEqual(filterPrefix(['  ORDER BY A'], '  OR'),
                                    ['  ORDER BY A']);
    });
  });

  describe('cartesianProductOf', function() {
    it('should behave as expected', function() {
      assert.deepEqual(cartesianProductOf([]), []);
      assert.deepEqual(cartesianProductOf([], [], []), []);
      assert.deepEqual(cartesianProductOf([1]), [[1]]);
      assert.deepEqual(cartesianProductOf([1], [2, 3]), [[1, 2], [1, 3]]);
      assert.deepEqual(cartesianProductOf([1, 2], [3, 4]),
                       [[1, 3], [1, 4], [2, 3], [2, 4]]);
    });
  });

  describe('firstToken', function() {
    it('should return the first token', function() {
      assert.equal(firstToken('foo bar'), 'foo');
      assert.equal(firstToken('  baz quux'), '  baz');
    });
  });

  describe('withoutLastToken', function() {
    it('should return a string without the last token', function() {
      assert.equal(withoutLastToken("ORDER BY IN"), "ORDER BY ");
      assert.equal(withoutLastToken("ORDER BY IN   "), "ORDER BY IN   ");
    });
  });
});
