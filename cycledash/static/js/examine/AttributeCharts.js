/** @jsx React.DOM */
"use strict";

var _ = require('underscore'),
    d3 = require('d3'),
    React = require('react');
var d3BarChart = require('./d3.bar-chart');


/**
 * Render all attribute charts (currently histograms) for the given INFO
 * attributes.
 */
var AttributeCharts = React.createClass({
  propTypes: {
    chartAttributes: React.PropTypes.arrayOf(React.PropTypes.string).isRequired,
    records: React.PropTypes.arrayOf(React.PropTypes.object).isRequired
  },
  render: function() {
    var charts = this.props.chartAttributes.map(function(chartAttribute) {
      return <AttributeChart chartAttribute={chartAttribute} key={chartAttribute}
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
 * Render a histogram for a given INFO attribute of records.
 */
var AttributeChart = React.createClass({
  propTypes: {
    chartAttribute: React.PropTypes.string.isRequired,
    records: React.PropTypes.arrayOf(React.PropTypes.object).isRequired
  },
  TOTAL_BINS: 10,
  binRecords: function(records) {
    var attr = this.props.chartAttribute,
        values = records.map(function(r) { return r.INFO[attr]; }),
        bins = d3.layout.histogram().bins(this.TOTAL_BINS)(values);

    return bins.map(function(bin) { return {count: bin.length, bin: bin.x} });
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
          <h4>{this.props.chartAttribute}</h4>
          <div ref="chartHolder"></div>
        </div>
    );
  }
});


module.exports = AttributeCharts;
