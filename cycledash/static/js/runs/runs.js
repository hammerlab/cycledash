'use strict';
var React = require('react'),
    RunsPage = require('./components/RunsPage');


window.renderRunPage = function(el, runs, runDescriptionTitleKeys, lastComments, completions, orphanTasks) {
  React.render(<RunsPage runs={runs}
                         runDescriptionTitleKeys={runDescriptionTitleKeys}
                         comments={lastComments}
                         orphanTasks={orphanTasks}
                         completions={completions} />, el);
};

