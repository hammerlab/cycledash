/** @jsx React.DOM */
"use strict";

var _ = require('underscore'),
    React = require('react/addons');


var LoadingStatus = React.createClass({
  propTypes: {
    hasLoaded: React.PropTypes.bool.isRequired,
    files: React.PropTypes.arrayOf(React.PropTypes.string).isRequired,
    error: React.PropTypes.string
  },
  render: function() {
    if (this.props.hasLoaded) {
      return null;
    } else if (this.props.error) {
      console.error("Error loading VCFs:", this.props.error);
      return (
        <div className="loading-initial-data">
          <p className="error">{this.props.error}</p>
        </div>
      );
    } else {
      var filePs = this.props.files.map(function(file, idx) {
        return <p key={idx}>{file}</p>;
      });
      return (
        <div className="loading-initial-data">
          <h1>Loading files&hellip;</h1>
          {filePs}
        </div>
      );
    }
  }
});

module.exports = LoadingStatus;
