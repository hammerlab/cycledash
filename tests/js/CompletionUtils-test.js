/** @jsx React.DOM */

var _ = require('underscore'),
    assert = require('assert'),
    CompletionUtils = require('../../cycledash/static/js/CompletionUtils.js');

var {
  cartesianProductOf,
  flatMap,
  fuzzyMatch,
  splitLastToken,
  tokenize
} = CompletionUtils;

describe('CompletionUtils', function() {
  describe('tokenize', function() {
    it('Should remove internal whitespace', function() {
      assert.deepEqual(tokenize('A  B  C'), [
        {token: 'A', start: 0, stop: 1},
        {token: 'B', start: 3, stop: 4},
        {token: 'C', start: 6, stop: 7},
      ]);
    });
    it('Should ignore whitespace in quotes', function() {
      assert.deepEqual(tokenize('A  "B  C"    D'), [
        {token: 'A',      start: 0, stop: 1},
        {token: '"B  C"', start: 3, stop: 9},
        {token: 'D',      start: 13, stop: 14}
      ]);
    });
    it('Should strip leading but not trailing whitespace', function() {
      assert.deepEqual(tokenize('   A  D    '), [
        {token: 'A', start: 3, stop: 4},
        {token: 'D', start: 6, stop: 7}
      ]);
    });
    it('Should add whitespace around tokens', function() {
      assert.deepEqual(tokenize('A>B>C'), [
        {token: 'A', start: 0, stop: 1},
        {token: '>', start: 1, stop: 2},
        {token: 'B', start: 2, stop: 3},
        {token: '>', start: 3, stop: 4},
        {token: 'C', start: 4, stop: 5},
      ]);
      assert.deepEqual(tokenize('A<'), [
        {token: 'A', start: 0, stop: 1},
        {token: '<', start: 1, stop: 2},
      ]);
      assert.deepEqual(tokenize('A<"A<B"'), [
        {token: 'A',     start: 0, stop: 1},
        {token: '<',     start: 1, stop: 2},
        {token: '"A<B"', start: 2, stop: 7},
      ]);
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

  describe('splitLastToken', function() {
    it('should split off the last token', function() {
      assert.deepEqual(splitLastToken('ORDER BY IN'), ['ORDER BY ', 'IN']);
      assert.deepEqual(splitLastToken('ORDER BY IN   '), ['ORDER BY IN   ', '']);
    });
  });

  describe('fuzzyMatch', function() {
    it('should perform a fuzzy match', function() {
      assert.ok(!fuzzyMatch('ACLn', 'Abe C Lincoln'));
      assert.ok( fuzzyMatch('', 'sample:GQ > 0'));
    });

    it('should only perform a fuzzy match on the last token', function() {
      assert.ok( fuzzyMatch('Abe C Ln', 'Abe C Lincoln'));
      // trailing space = done typing the last token, so no fuzzy match.
      assert.ok(!fuzzyMatch('Abe C Ln ', 'Abe C Lincoln'));
      assert.ok( fuzzyMatch('b', 'Abe C Lincoln'));
      assert.ok(!fuzzyMatch('b ', 'Abe C Lincoln'));
    });

    it('should return the string with one extra token', function() {
      assert.equal(fuzzyMatch('', 'sample:GQ > 0'), 'sample:GQ');
      assert.equal(fuzzyMatch('Abe C Ln', 'Abe C Lincoln'), 'Abe C Lincoln');
      assert.equal(fuzzyMatch('b', 'Abe C Lincoln'), 'Abe');
      assert.equal(fuzzyMatch('ORDER', 'ORDER BY A'), 'ORDER BY');
    });
  });
});
