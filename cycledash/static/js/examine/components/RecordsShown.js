"use strict";

var d3 = require('d3'),
    React = require('react');

var RecordsShown = React.createClass({
  propTypes: {
    hasLoaded: React.PropTypes.bool.isRequired,
    numberOfFilteredRecords: React.PropTypes.number.isRequired,
    totalNumberOfRecords: React.PropTypes.number.isRequired
  },
  render: function() {
    var fmt = d3.format(','),
        countsText;
    if (this.props.totalNumberOfRecords === this.props.numberOfFilteredRecords) {
      countsText = 'all' + ' ' + fmt(this.props.totalNumberOfRecords);
    } else {
      countsText = fmt(this.props.numberOfFilteredRecords) + ' of ' +
                       fmt(this.props.totalNumberOfRecords);
    }
    return (
      <div className="total-records">
        Showing {this.props.hasLoaded ? countsText : '...'} variants
      </div>
    );
  }
});

module.exports = RecordsShown;
