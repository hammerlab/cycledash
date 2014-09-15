/** @jsx React.DOM */
"use strict";

var _ = require('underscore'),
    d3 = require('d3'),
    React = require('react');
require('./d3.bar-chart')(d3);



var AttributeCharts = React.createClass({
  render: function() {
    var charts = this.props.charts.map(function(chart) {
      return <AttributeChart chart={chart} key={chart}
                             records={this.props.records} />;
    }.bind(this));
    return (
      <div className="attributeCharts">
        {charts}
      </div>
    );
  }
});


var AttributeChart = React.createClass({
   binPos: function(bins, val) {
     // Given a sorted array of numbers, bins, of lower bin bounds, returns the
     // position index in those bins that val should go. Undefined behavior if
     // the val is outside the bins.
     //
     // e.g. bins = [5, 10, 15, 20], val = 7   =>   0
     // e.g. bins = [0, 10, 20, 30], val = 21  =>   2
     // e.g. bins = [0, 10, 20, 30], val = 31  =>   3
     return _.reduce(bins, function(pos, binMin) {
       if (binMin >= val) return pos;
       else return pos + 1;
     }, 0);
   },
   processRecordsForHistogram: function(records) {
     var TOTAL_BINS = 10,
         attr = this.props.chart,
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
   componentDidMount: function() {
    console.log(d3.chart) // THIS BUG AGAIN WHAT WHAT WHAT WHAT WHAT WHAT WHY
     var datum = this.processRecordsForHistogram(this.props.records),
         barChart = d3.chart.bars()
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
   componentWillReceiveProps: function(nextprops) {
     d3.select(this.refs.chartHolder.getDOMNode()).select('svg')
       .remove();

     var datum = this.processRecordsForHistogram(nextprops.records),
         barChart = d3.chart.bars()
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
   render: function() {
     return (
       <div className="attrChart">
         <h4>{this.props.chart}</h4>
         <div ref="chartHolder"></div>
       </div>
     );
   }
});


module.exports = AttributeCharts;
