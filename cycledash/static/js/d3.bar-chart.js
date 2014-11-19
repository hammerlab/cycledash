(function(){

'use strict';

function uniq(list) {
  return list.reduce(function(a,v){
    if (a.indexOf(v) != -1) {
      return a;
    } else {
      a.push(v);
      return a;
    }
  }, []);
}

function getter(name) {
  return function(d) {
    return d[name];
  };
}


function d3_bars() {

  var margin = {top: 60, right: 175, bottom: 40, left: 40},
      svgWidth = 675,
      svgHeight = 500,
      groupScale = d3.scale.ordinal(),
      intraGroupScale = d3.scale.ordinal(),
      barHeightScale = d3.scale.linear(),
      _customBarHeightScale = false,
      intraBarScale = d3.scale.ordinal(),
      barValue = function(d, i) { return d; },
      _idxGetter = getter('__index__'),
      groupBy = _idxGetter,
      stackBy = _idxGetter,
      colorBy = function() { return true; }, // No coloring by default.
      interStackSorter = null,
      intraStackSorter = function() { return 1; },
      colors = ['#ffffff', '#000000'],
      barLabel = null,
      stackLabel = null,
      stackLabelPosition = "bottom",
      yAxisTitle = "",
      xAxisTitle = "",
      title = "",
      interGroupPadding = 0,
      intraGroupPadding = 0,
      yTickFormatter = function(d) { return d; },
      xTickFormatter = function(d) { return d; },
      legendLabeler = function(d, i) { return d; },
      color = d3.scale.ordinal(),
      colorScale = d3.scale.linear();


  function chart(selection) {
    var chartWidth = svgWidth - margin.right - margin.left,
        chartHeight = svgHeight - margin.top - margin.bottom,
        xAxis = d3.svg.axis().scale(groupScale).orient("bottom"),
        yAxis = d3.svg.axis().scale(barHeightScale).orient("left");

    if (stackLabel && stackLabelPosition === 'bottom') {
      // TODO(ihodes): Choose a dynamic height, not just 10%
      //               to make room for stackLabel.
      chartHeight = chartHeight - (chartHeight * 0.1); // to make room for the stackLabel
    }

    selection.each(function(data) {

      // TODO(ihodes): HACK! This is not ideal. If nest().key(fn) passed indices
      //               to fn, then we wouldn't need to do this.
      if (typeof data[0] === 'object') {
        data = data.map(function(d,i) { d.__index__ = i; return d; });
      }


        ////////////////
       // Initialize //
      ////////////////

      var maxBarValue = d3.max(data, function(d, i) {
            return barValue(d, i);
          }),
          nestedData = d3.nest().key(groupBy).key(stackBy).entries(data),
          maxStackValue = d3.max(nestedData, function(group) {
            return d3.max(group.values, function(stack) {
              return d3.sum(stack.values.map(barValue));
            });
          }),
          minStackValue = 0,
          maxGroupSize = d3.max(nestedData, function(group) {
            return group.values.length;
          }),
          maxStackSize = d3.max(nestedData, function(group) {
            return d3.max(group.values, function(stack) {
              return stack.values.length;
            });
          }),
          svg = d3.select(this).append("svg")
              .attr("width", svgWidth)
              .attr("height", svgHeight)
            .append("g")
              .attr("class", "chart")
              .attr("transform", "translate(" + margin.left + ", " + margin.top + ")");


      // TODO(ihodes): rangeRoundBands might be preferable here, but with it we
      //               get odd spacing issues between groups when we don't want
      //               spaces between them.
      groupScale
          .domain(data.map(groupBy))
          .rangeBands([0, chartWidth], interGroupPadding);

      intraGroupScale
          .domain(d3.range(0, maxGroupSize))
          .rangeBands([0, groupScale.rangeBand()], intraGroupPadding);

      if (!_customBarHeightScale) {
        barHeightScale
          .domain([minStackValue, maxStackValue])
          .rangeRound([chartHeight, 0]);
      }

      intraBarScale
          .domain(d3.range(0, maxStackSize))
          .rangeRoundBands([0, chartHeight]);


      var colorDomain = uniq(data.map(colorBy));
      colorScale
          .domain([0, colorDomain.length - 1])
          .range(colors);

      color
          .domain(colorDomain)
          .range(d3.range(0, colorDomain.length).map(colorScale));


        //////////
       // Bars //
      //////////

      var groups = svg.selectAll(".group")
          .data(nestedData)
        .enter().append("g")
          .attr("class", "group")
          .attr("transform", function(d, i) {
            // This transformation is to detmerine how groups are placed along
            // the x axis.
            return "translate(" + groupScale(d.key) + ", 0)";
          });

      var stacks = groups.selectAll(".stack")
          .data(function(d) {
            return d.values.sort(function(a,b) {
              return intraStackSorter(a.key, b.key);
            });
          })
        .enter().append("g")
          .attr("class", "stack")
          .attr("transform", function(d, i) {
            // This transformation is to determing how stacks of bars within the
            // same group are placed relative to each other.
            return "translate(" + intraGroupScale(i) + ", 0)";
          });

      var bars = stacks.selectAll(".bar")
          .data(function(d) { return d.values.sort(interStackSorter); })
        .enter().append("g")
          .attr("class", "bar")
          .attr("transform", function(d, i) {
            // This tranformation is to determine how bars stack on top of one
            // another.
            var barHeight = barHeightScale(barValue(d)),
                siblings = this.parentNode.childNodes,
                cumulativeSiblingsHeight, barPosY;

            siblings = Array.prototype.slice.call(siblings, 0, i);
            cumulativeSiblingsHeight = siblings.reduce(function(acc, sibling) {
              var data = sibling.__data__,
                  prevSiblingHeight = barHeightScale(barValue(data));
                return acc + (chartHeight - prevSiblingHeight);
            }, 0);

            barPosY = barHeightScale(barValue(d)) - cumulativeSiblingsHeight;
            return "translate(0, " + barPosY + ")";
          });

      bars
        .append("rect")
          .attr("width", intraGroupScale.rangeBand())
          .attr("height", function(d, i) {
            return chartHeight - barHeightScale(barValue(d));
          })
          .attr("fill", function(d, i) {
            return color(colorBy(d, i));
          });

      // TODO(ihodes): WIP
      if (stackLabel) {
        var t = stacks.append("text").attr("class", "stackText");
        if (stackLabelPosition === "bottom") {
          t
            .attr("transform", "rotate(-50 20,"+(chartHeight+10)+")")
            .attr("dx", 20) // TODO(ihodes): position properly...
            .attr("dy", chartHeight+10)
            .style("text-anchor", "end");
        } else if (stackLabelPosition === "top") {
          t
            .attr("transform", function(d, i) {
              var pos = barHeightScale(d3.sum(d.values, barValue));
              return "translate(0,"+ (pos-3) +")";
            })
            .attr("dx", intraGroupScale.rangeBand()/2)
            .style("text-anchor", "middle");
        }
        // TODO(ihodes): Why d.key instead of just d? Is this a good API to
        //               pass d.values and d.key?) Should I just pass `d`
        //               instead? (I think it is a good idea... just want to
        //               be sure)
        t.text(function(d, idx) { return stackLabel(d.values, d.key, idx); });
      }

      if (barLabel) {
        bars.append("text")
          .attr("class", "barText")
          .attr("transform", "rotate(-90)")
          .attr("dy", intraGroupScale.rangeBand() / 2 + 4) // TODO(ihodes):
                                                           // position properly
          .attr("dx", "-1em")
          .style("text-anchor", "end")
          .text(barLabel); // TODO(ihodes): should be similar to the above stackLabel
      }


        ///////////////////
       // Axes & Titles //
      ///////////////////

      svg
        .append("text")
          .text(title)
          .style("text-anchor", "middle")
          .attr("class", "chartTitle")
          .attr("transform", "translate(" + chartWidth/2 + "," + -margin.top/2  + ")");

      xAxis
        .tickFormat(xTickFormatter);

      var xAxisPos = chartHeight;
      if (stackLabel && stackLabelPosition === 'bottom') {
        xAxisPos = xAxisPos / 0.9; // We shaved off 0.1 from the top of
                                   // chartHeight because of stackLabel earlier.
      }

      var xAxisGroup = svg.append("g")
          .attr("class", "x axis")
          .attr("transform", "translate(0, " + xAxisPos + ")")
          .call(xAxis);

      xAxisGroup.append("text")
          .attr("y", 30)
          .attr("x", chartWidth/2)
          .attr("dy", ".71em")
          .style("text-anchor", "middle")
          .text(xAxisTitle);

      yAxis
        .tickFormat(yTickFormatter);

      var yAxisGroup = svg.append("g")
          .attr("class", "y axis")
          .call(yAxis);

      yAxisGroup.append("text")
          .attr("transform", "rotate(-90)")
          .attr("y", 6)
          .attr("x", 0)
          .attr("dy", ".71em")
          .style("text-anchor", "end")
          .text(yAxisTitle);


        //////////////
       //  Legend  //
      //////////////

      // TODO(ihodes): Legend WIP (should be in one g element, for e.g.,
      //               positioning etc)
      var legend = svg.selectAll(".legend")
          .data(color.domain().slice().reverse())
        .enter().append("g")
          .attr("class", "legend")
          .attr("transform", function(d, i) { return "translate(0," + i * 20 + ")"; });

      legend.append("rect")
          .attr("x", chartWidth + margin.left - 23)
          .attr("width", 18)
          .attr("height", 18)
          .attr("class", "legendColorBox")
          .style("fill", color);

      legend.append("text")
          .attr("x", chartWidth + margin.left + 6 + 18 - 23)
          .attr("y", 9)
          .attr("dy", ".35em")
          .attr("class", "legendText")
          .text(function(d) { return legendLabeler(d); });
    });
  }


  chart.margin = function(_) {
    if (!arguments.length) return margin;
    margin = _;
    return chart;
  };

  chart.width = function(_) {
    if (!arguments.length) return svgWidth;
    svgWidth = _;
    return chart;
  };

  chart.height = function(_) {
    if (!arguments.length) return svgHeight;
    svgHeight = _;
    return chart;
  };

  chart.barValue = function(_) {
    if (!arguments.length) return barValue;
    barValue = typeof _ === 'function' ? _ : getter(_);
    return chart;
  };

  chart.xLabel = function(_) {
    if (!arguments.length) return xAxisTitle;
    xAxisTitle = _;
    return chart;
  };

  chart.yScale = function(_) {
    if (!arguments.length) return barHeightScale;
    barHeightScale = _;
    _customBarHeightScale = true;
    return chart;
  };

  chart.title = function(_) {
    if (!arguments.length) return title;
    title = _;
    return chart;
  };

  chart.yLabel = function(_) {
    if (!arguments.length) return yAxisTitle;
    yAxisTitle = _;
    return chart;
  };

  chart.xLabel = function(_) {
    if (!arguments.length) return xAxisTitle;
    xAxisTitle = _;
    return chart;
  };

  chart.groupBy = function(_) {
    if (!arguments.length) return groupBy;
    groupBy = typeof _ === 'function' ? _ : getter(_);
    return chart;
  };

  chart.stackBy = function(_) {
    if (!arguments.length) return stackBy;
    stackBy = typeof _ === 'function' ? _ : getter(_);
    return chart;
  };

  chart.colorBy = function(_) {
    if (!arguments.length) return colorBy;
    colorBy = typeof _ === 'function' ? _ : getter(_);
    return chart;
  };

  chart.colors = function(_) {
    if (!arguments.length) return colors;
    colors = _;
    return chart;
  };

  chart.barLabel = function(_) {
    if (!arguments.length) return barLabel;
    barLabel = typeof _ === 'function' ? _ : getter(_);
    return chart;
  };

  chart.stackLabel = function(_) {
    if (!arguments.length) return stackLabel;
    stackLabel = typeof _ === 'function' ? _ : getter(_);
    return chart;
  };

  chart.stackLabelPosition = function(_) {
    if (!arguments.length) return stackLabelPosition;
    stackLabelPosition = _;
    return chart;
  };

  chart.legendLabeler = function(_) {
    if (!arguments.length) return legendLabeler;
    legendLabeler = _;
    return chart;
  };

  chart.interGroupPadding = function(_) {
    if (!arguments.length) return interGroupPadding;
    interGroupPadding = _;
    return chart;
  };

  chart.intraGroupPadding = function(_) {
    if (!arguments.length) return intraGroupPadding;
    intraGroupPadding = _;
    return chart;
  };

  chart.yTickFormatter = function(_) {
    if (!arguments.length) return yTickFormatter;
    yTickFormatter = _;
    return chart;
  };

  chart.xTickFormatter = function(_) {
    if (!arguments.length) return xTickFormatter;
    xTickFormatter = _;
    return chart;
  };

  chart.interStackSorter = function(_) {
    if (!arguments.length) return interStackSorter;
    interStackSorter = _;
    return chart;
  };

  chart.intraStackSorter = function(_) {
    if (!arguments.length) return intraStackSorter;
    intraStackSorter = _;
    return chart;
  };


  return chart;
}

if (d3.chart === undefined)  d3.chart = {};
d3.chart.bars = d3_bars;

})();
