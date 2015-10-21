'use strict';
var React = require('react'),
    ReactDOM = require('react-dom'),
    RunsPage = require('./components/RunsPage');


window.renderRunPage = function(el, projects, lastComments) {
  ReactDOM.render(<RunsPage projects={projects}
                            comments={lastComments} />, el);
};
