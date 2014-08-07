var concordanceData = _.reduce(concordanceJson, function(acc, val, key) {
  for (var k in val) {
    acc.push({caller: key, calls: val[k], numConc: k});
  }
  return acc;
}, []);

var concordanceChart = d3.chart.bars()
  .interGroupPadding(.3)
  .stackLabel(function(vals, key, idx) { return d3.sum(vals, function(d) { return d.calls; }); })
  .stackLabelPosition('top')
  .interStackSorter(function(a,b) { return a.numConc < b.numConc;  } )
  .legendLabeler(function(val) { return val + " caller(s) in concordance."})
  .colors(['#FBA6FC', '#410078'])
  .yLabel('Number Variants Called')
  .barValue('calls')
  .groupBy('caller')
  .stackBy('caller')
  .colorBy('numConc');

d3.select("#concordance")
  .datum(concordanceData)
  .call(concordanceChart);
