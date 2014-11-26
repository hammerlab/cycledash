// Via http://www.asbjornenge.com/wwc/testing_react_components.html
'use strict';

module.exports = function(markup) {
  if (typeof document !== 'undefined') return;
  var jsdom = require('jsdom').jsdom;
  global.document = jsdom(markup || '');
  global.window = document.parentWindow;
  global.navigator = {
    userAgent: 'node.js'
  };
  // ... add whatever browser globals your tests might need ...
};
