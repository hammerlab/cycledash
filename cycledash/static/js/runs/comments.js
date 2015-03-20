'use strict';
var React = require('react'),
    CommentsPage = require('./components/comment').CommentsPage;


window.renderCommentsPage = function(el, comments) {
  React.render(<CommentsPage comments={comments} />, el);
};
