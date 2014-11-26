var Utils = require('./Utils'),
    assert = require('assert');

describe('Utils', function() {
  describe('makeObj', function() {
    it('should construct objects', function() {
      assert.deepEqual({a: 1, b: 2}, Utils.makeObj(['a', 'b'], (v, i) => [v, i + 1]));
    });
  });

  describe('mapValues', function() {
    it('should map values, preserving keys', function() {
      assert.deepEqual({a: 1, b: 4, c: 9},
                       Utils.mapValues({a: 1, b: 2, c: 3}, (v, k) => v * v));
    });
  });
});
