'use strict';

require('./testdom')('<html><body></body></html>');
var Utils = require('./Utils'),
    assert = require('assert'),
    React = require('react/addons');

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

  describe('stubReactMethod', function() {
    it('should stub a React class method, then restore it', function() {
      var TestUtils = React.addons.TestUtils;
      var captured = [];
      var RC = React.createClass({
        render: function() {
          this.method();
          return null;
        },
        method: function() {
          captured.push('original');
        }
      });

      var stubFn = function() { captured.push('stubbed'); };

      var el = React.createElement(RC, null);
      TestUtils.renderIntoDocument(el);
      assert.deepEqual(['original'], captured);

      var stub = Utils.stubReactMethod(RC, 'method', stubFn);
      captured = [];
      TestUtils.renderIntoDocument(el);
      assert.deepEqual(['stubbed'], captured);

      stub.restore();
      captured = [];
      TestUtils.renderIntoDocument(el);
      assert.deepEqual(['original'], captured);
    });
  });
});
