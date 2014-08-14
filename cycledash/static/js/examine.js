(function() {
"use strict";

console.log("Loading Examine.js.");


function loadVcf(vcfPath, callback) {
  d3.xhr('/vcf' + vcfPath, callback);
}

function vcfHandler(error, data) {
  if (error) {
    console.log('ERROR loading primary VCF', error);
  } else {
    var vcfText = data.responseText,
        primaryVcf = vcf().data(vcfText),
        truthVcfPath = document.getElementById('truth-path').value;

    loadVcf(truthVcfPath, function(error, data) {
      if (error) {
        console.log('ERROR loading truth', error);
      } else {
        var truthVcf = vcf().data(data.responseText);
        initializeUI(primaryVcf, truthVcf);
      }
    });
  }
}

function initializeUI(primary, truth) {
  var res = preprocessVcfs(primary, truth);

  primary = res.primaryData;
  truth = res.truthData;

  initializeRangeListener(primary, truth);
  updateStatsFromRange(primary, truth);
  drawReadDepthBoxcharts(primary);

  console.log('Initialized');
}

function preprocessVcfs(primary, truth) {
  // Here we remove all SVs from truth and SNVs in `primary` which are in SV
  // regions in `truth`.
  primary = primary.filter(function(record) {
    if (!record.isSnv()) return false;
    var truthAtPos = truth.fetch(record.CHROM, record.POS, record.POS + 1);
    for (var idx in truthAtPos) {
      if (truthAtPos[idx].isSv()) {
        return false;
      }
    }
    return true;
  });
  truth = truth.filter(function(record) {
    return record.isSnv();
  });
  truth.sort(vcf.tools.recordComparitor);
  primary.sort(vcf.tools.recordComparitor);

  return {truthData: truth, primaryData: primary};
}

function initializeRangeListener(primary, truth) {
  // Listens to the range selector and updates the display when it changes.
  var rangeTypeRadios = document.querySelectorAll("#range-selector input, #range-selector select");

  // add all options to the chromosome selection dropdown
  var chromosomes = _.uniq(_.map(primary, function(r) { return r.CHROM; }));
  window.chr = chromosomes;
  for (var cidx in chromosomes) {
    var chromosome = chromosomes[cidx],
        option = document.createElement("option");

    option.value = chromosome;
    option.innerText = "Chromosome " + chromosome;
    document.querySelector("select[name=chromosome]").appendChild(option);
  }

  for (var idx in rangeTypeRadios) {
    rangeTypeRadios[idx].onchange = function(ev) {
      updateStatsFromRange(primary, truth);
    };
  }
}

function updateStatsFromRange(primary, truth) {
  var selectedType = document.querySelector('#range-selector input[type=radio]:checked').value,
      chromosomeEl = document.querySelector('#range-selector select[name=chromosome]'),
      start = document.querySelector('#range-selector input[name=start]').value,
      end = document.querySelector('#range-selector input[name=end]').value,
      chromosome = chromosomeEl.options[chromosomeEl.selectedIndex].value,
      range = selectedType === 'all' ? {} : { start: parseInt(start), end: parseInt(end), chromosome: chromosome};

  setDisabledFormInputs('#range-selector', true);

  primary = vcf.tools.recordsIn(primary, range);
  truth = vcf.tools.recordsIn(truth, range);

  var truePos = vcf.tools.truePositives(truth, primary).length,
      falsePos = vcf.tools.falsePositives(truth, primary).length,
      falseNeg = vcf.tools.falseNegatives(truth, primary).length,
      precision = vcf.tools.precision(truth, primary),
      recall = vcf.tools.recall(truth, primary),
      f1score = vcf.tools.f1score(truth, primary),
      dpSummary = vcf.tools.summaryStats(primary, 'DP');

  document.querySelector("#positive .true").innerText = truePos;
  document.querySelector("#positive .false").innerText = falsePos;
  document.querySelector("#negative .false").innerText = falseNeg;

  document.getElementById("precision").innerText = precision.toFixed(4);
  document.getElementById("recall").innerText = recall.toFixed(4);
  document.getElementById("f1score").innerText = f1score.toFixed(4);

  document.getElementById("dp-min").innerText = dpSummary.min;
  document.getElementById("dp-first-q").innerText = dpSummary.firstQuartile;
  document.getElementById("dp-median").innerText = dpSummary.median;
  document.getElementById("dp-third-q").innerText = dpSummary.thirdQuartile;
  document.getElementById("dp-max").innerText = dpSummary.max;

  document.getElementById("dp-mean").innerText = dpSummary.mean.toFixed(4);
  document.getElementById("dp-sd").innerText = dpSummary.standardDeviation.toFixed(4);
  document.getElementById("dp-sum").innerText = dpSummary.sum;
  document.getElementById("dp-len").innerText = dpSummary.length;

  setDisabledFormInputs('#range-selector', false);
}

function setDisabledFormInputs(containerSelector, disabled) {
  var selector = containerSelector + ' input, ' + containerSelector + ' select',
      inputs = Array.prototype.slice.call(document.querySelectorAll(selector));
  inputs.map(function(input) {
    input.disabled = disabled;
  });
}

function displayLoader(display) {
  var loader = document.getElementById('loader');
  if (display) loader.style.display = "block";
  else loader.style.display = "none";
}

function drawReadDepthBoxcharts(records) {
  // This is not tidy. Will likely be completely re-written shortly.
  var chromosomes = _.map(_.range(1, 23), String).concat(['M', 'X', 'Y']);

  var boxMap = {};
  for (var cidx in chromosomes) {
    var chromosome = chromosomes[cidx];
    var range = {start: 0, end: null, chromosome: chromosome};
    var summary = vcf.tools.fiveNumberSummary(records, 'DP', range);
    if (summary.total > 0)
      boxMap[chromosome] = summary;
  }

  var boxes = []
  for (var chromosome in boxMap) {
    var box = boxMap[chromosome];
    box.chromosome = chromosome;
    boxes.total = boxMap.total;
    boxes.push(box);
  }

  // transition to d3 terminology
  var data = boxes;

  var height = 200, width = 800, margin = {top: 17, bottom: 17, right: 17, left: 50};
  var chartHeight = height - margin.top - margin.bottom,
      chartWidth = width - margin.right - margin.left;
  var xscale = d3.scale.linear()
    .domain([0, data.length]).range([0, width - margin.left - margin.right]);
  var yscale = d3.scale.linear()
    .domain([0, d3.max(data, function(d) { return d.max; })]).range([height - margin.top - margin.bottom, 0]);

  var svg = d3.select("#read-depth-chart")
    .append("svg")
      .attr("height", height)
      .attr("width", width)

  var chart = svg.append("g")
      .attr("transform", "translate(" + margin.left + ", " + margin.top + ")");

  var boxes = chart.selectAll(".box")
      .data(data).enter()
    .append("g")
      .attr("class", "box")
      .attr("transform", function(d, i) { return "translate(" + xscale(i) + ",0)"; });

  var yaxis = d3.svg.axis().scale(yscale).orient("left");
  svg.append("g").attr("transform", "translate(" + 29 + ", " + margin.top + ")").call(yaxis);

  boxes.append("text")
    .attr("x", function(d, i) { return xscale(i) + 2; })
    .attr("y", -9)
    .text(function(d) { return d.chromosome; })
    .style("text-anchor", "start")

  boxes.append("rect")
    .attr("class", "box-body")
    .attr("height", function(d) { return chartHeight - yscale(d.thirdQuartile - d.firstQuartile)})
    .attr("width", 10)
    .attr("y", function(d) { return yscale(d.thirdQuartile); });

  boxes.append("line")
    .attr("class", "box-to-max")
    .attr("x1", function(d) { return 5;})
    .attr("x2", function(d) { return 5;})
    .attr("y1", function(d) { return yscale(d.thirdQuartile);})
    .attr("y2", function(d) { return yscale(d.max);});

  boxes.append("line")
    .attr("class", "max-hatch")
    .attr("x1", function(d) { return 3;})
    .attr("x2", function(d) { return 8;})
    .attr("y1", function(d) { return yscale(d.max);})
    .attr("y2", function(d) { return yscale(d.max);});

  boxes.append("line")
    .attr("class", "min-hatch")
    .attr("x1", function(d) { return 3;})
    .attr("x2", function(d) { return 8;})
    .attr("y1", function(d) { return yscale(d.min);})
    .attr("y2", function(d) { return yscale(d.min);});

  boxes.append("line")
    .attr("class", "median-hatch")
    .attr("x1", function(d) { return 0;})
    .attr("x2", function(d) { return 10;})
    .attr("y1", function(d) { return yscale(d.median);})
    .attr("y2", function(d) { return yscale(d.median);});

  boxes.append("line")
    .attr("class", "box-to-min")
    .attr("x1", function(d) { return 5;})
    .attr("x2", function(d) { return 5;})
    .attr("y1", function(d) { return yscale(d.firstQuartile);})
    .attr("y2", function(d) { return yscale(d.min);});

}

function main() {
  var vcfPath = document.getElementById('vcf-path').value;
  loadVcf(vcfPath, vcfHandler);
}

main();

})();
