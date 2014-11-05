/** @jsx React.DOM */
"use strict";

var _ = require('underscore'),
    d3 = require('d3/d3'),
    React = require('react'),
    utils = require('../utils');
var d3BarChart = require('./d3.bar-chart')(d3);


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
  isIntegerType: function() {
    var typeString = utils.getIn(this.props.column, ["info", "Type"]);
    return typeString === "Integer";
  },
  recordValues: function(records, path) {
    var values = [];
    _.each(records, function(record) {
      var value = utils.getIn(record, path);
      if (_.isFinite(value)) {
        values.push(value);
      }
    });

    return values;
  },
  binRecords: function(records) {
    var values = this.recordValues(records, this.props.column.path);
    var binScale = d3.scale.linear().domain([d3.min(values), d3.max(values)]);

    // Nice extends the domain to round-number edges, while ticks splits
    // the domain into round-number divisions.
    var ticks = binScale.nice().ticks(this.TOTAL_BINS);

    var bins = d3.layout.histogram().bins(ticks)(values);
    return bins.map(bin => ({count: bin.length, bin: bin.x}));
  },
  renderHistogram: function(records) {
    var formatString = this.isIntegerType() ? 'd' : '.1f';
    var datum = this.binRecords(records),
        barChart = d3BarChart()
           .xTickFormatter(d3.format(formatString))
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
