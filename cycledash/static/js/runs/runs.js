'use strict';
var React = require('react'),
    RunsPage = require('./components/RunsPage');


window.renderRunPage = function(el, projects, lastComments) {
  React.render(<RunsPage projects={projects}
                         comments={lastComments} />, el);
};
