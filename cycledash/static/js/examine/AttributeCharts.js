/** @jsx React.DOM */
"use strict";

var _ = require('underscore'),
    d3 = require('d3'),
    React = require('react');
var d3BarChart = require('./d3.bar-chart');


var AttributeCharts = React.createClass({
  /**
   * Render all attribute charts (currently histograms) for the given INFO
   * attributes.
   */
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


var AttributeChart = React.createClass({
  /**
   * Render a histogram for a given INFO attribute of records.
   */
  propTypes: {
    chartAttribute: React.PropTypes.string.isRequired,
    records: React.PropTypes.arrayOf(React.PropTypes.object).isRequired
  },
  binPos: _.sortedIndex,
  processRecordsForHistogram: function(records) {
    /**
     * Bins the records into a list of bins, each bin of the form
     * {bin: binNumber, count: numberOfRecordsInBin}.
     */
    var TOTAL_BINS = 10,
         attr = this.props.chartAttribute,
         binRange = d3.extent(records.map(function(record) { return record.INFO[attr]; })),
         binGap = (binRange[1] - binRange[0]) / TOTAL_BINS,
         bins = _.range(TOTAL_BINS + 1).map(function(idx) {
           return binRange[0] + (binGap * idx);
         }),
         binned = bins.map(function(bin){ return {bin: bin, count: 0}; });

    _.each(records, function(record) {
      var attrVal = record.INFO[attr],
          pos = this.binPos(bins, attrVal);
      binned[pos].count += 1;
    }.bind(this));

    return binned;
  },
  renderHistogram: function(records) {
    var datum = this.processRecordsForHistogram(records),
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
