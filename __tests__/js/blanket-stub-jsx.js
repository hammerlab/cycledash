// Transform & instrument JS for Blanket coverage analysis.
// based on https://github.com/alex-seville/blanket/blob/master/src/node-loaders/coffee-script.js

var fs = require('fs');
    path = require('path'),
    transformer = require('./jsx-stub-transformer'),
    ReactTools = require('react-tools');

module.exports = function(blanket) {

  var origJs = require.extensions['.js'];

  require.extensions['.js'] = function(localModule, filename) {
    // short-circuit for common case.
    if (filename.match(/node_modules/)) {
      return origJs(localModule, filename);
    }

    if (transformer.shouldStub(filename)) {
      return transformer.transform(localModule, filename);
    }

    // React-ify as necessary.
    var content;
    content = fs.readFileSync(filename, 'utf8');
    if (content.indexOf('@jsx') > 0) {
      content = ReactTools.transform(content, {harmony: true});
    }

    // Don't instrument code unless it passes the filter.
    var pattern = blanket.options('filter');
    var normalizedFilename = blanket.normalizeBackslashes(filename);
    if (!blanket.matchPattern(normalizedFilename, pattern)) {
      return localModule._compile(content, normalizedFilename);
    }

    blanket.instrument({
      inputFile: content,
      inputFileName: normalizedFilename
    }, function(instrumented){
      var baseDirPath = blanket.normalizeBackslashes(path.dirname(normalizedFilename)) + '/.';
      try {
        instrumented = instrumented.replace(/require\s*\(\s*("|')\./g,'require($1' + baseDirPath);
        localModule._compile(instrumented, normalizedFilename);
      } catch(err){
        console.log("Error parsing instrumented code: " + err);
      }
    });
  };

};
