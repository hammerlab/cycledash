'use strict';
var React = require('react'),
    ReactDOM = require('react-dom'),
    CommentsPage = require('./components/comment').CommentsPage;


window.renderCommentsPage = function(el, comments) {
  ReactDOM.render(<CommentsPage comments={comments} />, el);
};
