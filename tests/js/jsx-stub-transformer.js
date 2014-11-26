// Based on github.com/Khan/react-components/blob/master/test/compiler.js
//
// If globals.reactModulesToStub is defined, it should be an array of paths to
// modules which you'd like to replace with single, empty React components. Any
// path suffix will do.

var fs = require('fs');
var ReactTools = require('react-tools');

var reactStub = 'module.exports = require("react").createClass({render:function(){return null;}});';

var origJs;

// Should this file be stubbed out for testing?
function shouldStub(filename) {
  if (!global.reactModulesToStub) return false;

  var stubs = global.reactModulesToStub;
  for (var i = 0; i < stubs.length; i++) {
    if (filename.substr(-stubs[i].length) == stubs[i]) {
      return true;
    }
  }
  return false;
}

// Returns transformed JS.
function transform(filename) {
  if (shouldStub(filename)) {
    return reactStub;
  }

  var content = fs.readFileSync(filename, 'utf8');
  return ReactTools.transform(content, {harmony: true});
}

// Implements the node.js "compiler" API
function compile(module, filename) {
  var transformedJs = transform(filename);
  if (transformedJs) {
    return module._compile(transformedJs, filename);
  } else {
    return (origJs || require.extensions['.js'])(module, filename);
  }
}

// Install the JSX+Stub compiler for JS files.
function install() {
  origJs = require.extensions['.js'];
  require.extensions['.js'] = compile;
}

module.exports = {
  shouldStub: shouldStub,
  transform: transform,
  compile: compile,
  install: install
};
