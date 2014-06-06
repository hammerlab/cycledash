  var SCORE_TYPES = ['f1score', 'recall', 'precision'],
      SCORE_COLORS = ['firebrick', 'forestgreen', 'darkorchid'],
      WIDTH = 800,
      HEIGHT = 150,
      RUNS_NUM = 10,
      data = runs.slice(0, RUNS_NUM).reverse(),
      colors = d3.scale.ordinal()
                 .domain(SCORE_TYPES)
                 .range(SCORE_COLORS),
      margin = {top: 20, left: 50, right: 120, bottom: 50},
      chartWidth = WIDTH - margin.left - margin.right,
      chartHeight = HEIGHT - margin.top - margin.bottom,
      ys = window.ys = [d3.min(SCORE_TYPES.map(function(type) {
        return d3.min(data.map(function(d){ return d[type]; }));
      })),
      d3.max(SCORE_TYPES.map(function(type) {
        return d3.max(data.map(function(d){ return d[type]; }));
      }))],
      x = d3.scale.linear()
            .domain([0, RUNS_NUM])
            .range([0, chartWidth]),
      y = d3.scale.linear()
            .domain(ys)
            .range([chartHeight, 0]),
      xAxis = d3.svg.axis().scale(x).orient('bottom')
                .tickValues(d3.range(RUNS_NUM))
                .tickFormat(d3.format("s")),
      yAxis = d3.svg.axis().scale(y).orient('left'),
      line = window.line = function(score_type) {
        return d3.svg.line()
                 .x(function(d, i) {
                   return x(i);
                 })
                 .y(function(d, i) {
                   return y(d[score_type]);
                 })
      };

  var svg = d3.select('body').append('svg')
      .attr('width', WIDTH)
      .attr('height', HEIGHT)
    .append('g')
      .attr('transform',
            'translate(' + margin.left + ',' + margin.top + ')');

  var trends = svg.selectAll('.trend')
      .data(SCORE_TYPES)
    .enter().append('path')
      .attr('class', 'trend')
      .style('stroke', colors)
      .attr('d', function(scoreType, i) {
        return line(scoreType)(data);
      });

  svg.append('g')
      .attr("transform", "translate(0, " + (chartHeight + 5) + ")")
      .call(xAxis);

  svg.append('g')
      .call(yAxis);

  svg.append("g")
      .attr("transform",
            "translate(" + (chartWidth / 2) + ", " + (HEIGHT - 20) + ")")
    .append("text")
      .style("text-anchor", "middle")
      .text("Last " + RUNS_NUM + " Scores")

  var legend = svg.selectAll(".legend")
      .data(colors.domain().slice().reverse())
    .enter().append("g")
      .attr("class", "legend")
      .attr("transform", function(d, i) {
        return "translate(0," + i * 20 + ")";
      });

  legend.append("rect")
      .attr("x", chartWidth)
      .attr("width", 18)
      .attr("height", 18)
      .style("fill", colors);

  legend.append("text")
      .attr("x", chartWidth + 23)
      .attr("y", 9)
      .attr("dy", ".35em")
      .text(function(d) {
        return d;
      });
