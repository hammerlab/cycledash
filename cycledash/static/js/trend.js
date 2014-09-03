(function(exports) {
"use strict";


function trendlines() {
  var margin = {top: 20, bottom: 20, right: 80, left: 50},
      width = 1000,
      height = 100,
      x = d3.scale.linear().range([0, width - margin.right - margin.left]),
      y = d3.scale.linear().range([height - margin.top - margin.bottom, 0]),
      yAxis = d3.svg.axis()
         .scale(y)
         .orient("left")
         .ticks([5]);

  function line(attr) {
    return d3.svg.line()
      .y(function(d) { return y(d[attr]); })
      .x(function(d,i) { return x(i); });
  }

  function filler(type) {
    switch (type) {
      case 'f1score':
        return 'green';
      case 'precision':
        return 'gold';
      case 'recall':
        return 'purple';
    }
  }

  function _trendlines(selection) {
    var svg = selection.append('svg')
          .attr('width', width)
          .attr('height', height)
        .append('g')
          .attr('transform', 'translate(' + margin.left + ',' + margin.top + ')'),
      legend = svg.append('g').attr('transform',
                                    'translate(' + (width - (margin.left * 5))  + ',0)');

    _.each(['f1score', 'precision', 'recall'], function(type, idx) {
      x.domain([0, selection.datum().length]);
      y.domain(d3.extent(_.pluck(selection.datum(), type)));

      svg.append('path')
          .datum(function(d) { return d; })
          .attr('class', type)
          .attr('d', line(type))
          .attr('stroke', filler(type));

      legend.append('rect')
          .attr('x', 0)
          .attr('y', idx*12)
          .attr('width', 10)
          .attr('height', 10)
          .attr('fill', filler(type));
      legend.append('text')
          .attr('x', 15)
          .attr('y', idx*12 + 8)
          .text(type);
    });

    svg.append("g")
        .attr("class", "y axis")
        .call(yAxis);
  }
  return _trendlines;
}


function main() {
  var datasetTemplate  = _.template(document.getElementById('dataset-holder').text),
      body = document.getElementsByTagName('body')[0];

  _.each(datasetRuns, function(runs, datasetName) {
    var renderedDataset = datasetTemplate({datasetName: datasetName, runs: runs}),
        div = document.createElement('div'),
        chart = trendlines();
    div.innerHTML = renderedDataset;

    d3.select(div)
      .select('.trendlines')
        .datum(runs)
        .call(chart);

    body.appendChild(div);
  });
}


main();


})(this);
