var fs = require('fs');
var ReactTools = require("react-tools");
require.extensions['.js'] = function(module, filename) {
  var content;
  content = fs.readFileSync(filename, 'utf8');
  console.log('transforming', filename);
  var compiled = ReactTools.transform(content, {harmony: true});
  console.log('transformed ', filename);
  return module._compile(compiled, filename);
};
