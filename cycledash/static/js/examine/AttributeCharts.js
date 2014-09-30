/** @jsx React.DOM */
"use strict";

var _ = require('underscore'),
    d3 = require('d3'),
    React = require('react'),
    getIn = require('./utils').getIn;
var d3BarChart = require('./d3.bar-chart');


/**
 * Render all attribute charts (currently histograms) for the given columns.
 */
var AttributeCharts = React.createClass({
  propTypes: {
    selectedColumns: React.PropTypes.arrayOf(React.PropTypes.object).isRequired,
    records: React.PropTypes.arrayOf(React.PropTypes.object).isRequired
  },
  render: function() {
    var charts = this.props.selectedColumns.map(function(column) {
      return <AttributeChart column={column} key={column.path.join('>')}
                             records={this.props.records} />;
    }.bind(this));
    return (
      <div className="attribute-charts">
        {charts}
      </div>
    );
  }
});

/**
 * Render a histogram for a given column of records.
 */
var AttributeChart = React.createClass({
  propTypes: {
    column: React.PropTypes.object.isRequired,
    records: React.PropTypes.arrayOf(React.PropTypes.object).isRequired
  },
  TOTAL_BINS: 10,
  binRecords: function(records) {
    var path = this.props.column.path,
        values = records.map(function(record) { return getIn(record, path); }),
         bins = d3.layout.histogram().bins(this.TOTAL_BINS)(values);
    return bins.map(bin => ({count: bin.length, bin: bin.x}));
  },
  renderHistogram: function(records) {
    var datum = this.binRecords(records),
        barChart = d3BarChart()
           .xTickFormatter(d3.format('.1f'))
           .width(450).height(250).margin({top:0, bottom:30, right:0, left: 50})
           .yLabel('Count')
           .intraGroupPadding(0.033)
           .groupBy('bin')
           .barValue('count');

    d3.select(this.refs.chartHolder.getDOMNode())
        .datum(datum)
        .call(barChart);
  },
  componentDidMount: function() {
    this.renderHistogram(this.props.records);
  },
  componentWillReceiveProps: function(nextprops) {
    d3.select(this.refs.chartHolder.getDOMNode()).select('svg').remove();
    this.renderHistogram(nextprops.records);
  },
  render: function() {
    return (
        <div className="attr-chart">
          <h4>{this.props.column.name}</h4>
          <div ref="chartHolder"></div>
        </div>
    );
  }
});


module.exports = AttributeCharts;
