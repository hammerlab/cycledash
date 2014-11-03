// Based on github.com/Khan/react-components/blob/master/test/compiler.js
//
// If globals.reactModulesToStub is defined, it should be an array of paths to
// modules which you'd like to replace with single, empty React components. Any
// path suffix will do.

var fs = require('fs');
var ReactTools = require('react-tools');

var reactStub = 'module.exports = require("react").createClass({render:function(){return null;}});';

var origJs;

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

function transform(module, filename) {
  if (shouldStub(filename)) {
    return module._compile(reactStub, filename);
  }

  var content;
  content = fs.readFileSync(filename, 'utf8');
  if (content.indexOf('@jsx') > 0) {
    var compiled = ReactTools.transform(content, {harmony: true});
    return module._compile(compiled, filename);
  } else {
    return (origJs || require.extensions['.js'])(module, filename);
  }
}

function install() {
  origJs = require.extensions['.js'];
  require.extensions['.js'] = transform;
}

module.exports = {
  shouldStub: shouldStub,
  transform: transform,
  install: install
};
