// Based on github.com/Khan/react-components/blob/master/test/compiler.js
//
// If globals.reactModulesToStub is defined, it should be an array of paths to
// modules which you'd like to replace with single, empty React components. Any
// path suffix will do.
var fs = require('fs');
var ReactTools = require('react-tools');

var origJs = require.extensions['.js'];

var reactStub = 'module.exports = require("react").createClass({render:function(){return null;}});';

function transform(module, filename) {
  if (global.reactModulesToStub) {
    var stubs = global.reactModulesToStub;
    for (var i = 0; i < stubs.length; i++) {
      if (filename.substr(-stubs[i].length) == stubs[i]) {
        return module._compile(reactStub, filename);
      }
    }
  }

  var content;
  content = fs.readFileSync(filename, 'utf8');
  if (content.indexOf('@jsx') > 0) {
    var compiled = ReactTools.transform(content, {harmony: true});
    return module._compile(compiled, filename);
  } else {
    return origJs(module, filename);
  }
}

require.extensions['.js'] = transform;
