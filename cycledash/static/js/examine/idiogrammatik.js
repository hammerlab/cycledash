(function() {
"use strict";

// Check for the existence (or require) d3.js, which is required for
// idiogrammatik.
if (typeof d3 === 'undefined') {
  if (typeof require === 'function') {
    d3 = require('d3');
  } else {
    throw "d3.js must be included before idiogrammatik.js.";
  }
}


// Data from GRCh38 [cytobands.tsv]
// c.f. http://bioviz.org/quickload//H_sapiens_Dec_2013/
// c.f. http://www.ncbi.nlm.nih.gov/projects/genome/assembly/grc/human/data/
var INCLUDED_CHROMOSOME_NAMES = ["chr1", "chr2", "chr3", "chr4", "chr5", "chr6",
                                 "chr7", "chr8", "chr9", "chr10", "chr11", "chr12",
                                 "chr13", "chr14", "chr15", "chr16", "chr17",
                                 "chr18", "chr19", "chr20", "chr21", "chr22",
                                 "chrX", "chrY"],
    CYTOBAND_TSV_URL = 'cytoband.tsv',
    IDIOGRAM_HEIGHT = 7,
    HIGHLIGHT_HEIGHT = 21,
    HIGHLIGHT_COLOR = 'yellow',
    HIGHLIGHT_OPACITY = 0.2,
    CENTROMERE_RADIUS = 1.5,
    ARM_CLIP_RADIUS = 10,
    WIDTH = 800,
    HEIGHT = 100,
    MARGIN = {top: 50, bottom: 20, left: 20, right: 20};


// This is the primary export of this file. Calling this function returns an
// instance of an idiogram, which can be configured and then called on a d3
// selection.
function _idiogrammatik() {
  var width = WIDTH,
      height = HEIGHT,
      margin = MARGIN,
      xscale = d3.scale.linear(), // Scale to map x-pos to base pair.
      deferred = [], // List of functions to be called upon draw.
      customRedraw = identity, // Additional function to be called upon redraw.
      drawn = false, // True once the kgram has been called once (so, drawn).
      // Aesthetics:
      bandStainer = gstainFiller,
      idiogramHeight = IDIOGRAM_HEIGHT,
      centromereRadius = CENTROMERE_RADIUS,
      highlightHeight = HIGHLIGHT_HEIGHT,
      armClipRadius = ARM_CLIP_RADIUS,
      zoom, // Zoom behavior reference.
      // Closed-over customizable vars:
      svg, chromosomes, listener, data, highlights = [], events = {};

  function kgram(selection) {
    // Function which actually renders and begins the visualization.
    //
    // Closes around nearly everything above.
    data = selection.datum();
    xscale.domain([0, data.totalBases])
        .range([0, width - margin.left - margin.right]);

    svg = appendSvg(selection, width, height, margin),
    chromosomes = appendChromosomes(svg, data, bandStainer, idiogramHeight),
    listener = appendListenerBox(svg, width, height, margin);
    appendArmClips(chromosomes, idiogramHeight);
    initializeMouseListener(listener);

    deferred.map(function(callable) { callable(); });

    redraw();

    drawn = true;
  }
  // Aesthetics:
  kgram.width = function(_) {
    if (!arguments.length) return width;
    width = _;
    return kgram;
  };
  kgram.height = function(_) {
    if (!arguments.length) return height;
    height = _;
    return kgram;
  };
  kgram.margin = function(_) {
    if (!arguments.length) return margin;
    margin = _;
    return kgram;
  };
  kgram.stainer = function(_) {
    if (!arguments.length) return bandStainer;
    bandStainer = _;
    return kgram;
  };
  kgram.highlightHeight = function(_) {
    if (!arguments.length) return highlightHeight;
    highlightHeight = _;
    return kgram;
  };
  kgram.idiogramHeight= function(_) {
    if (!arguments.length) return idiogramHeight;
    idiogramHeight = _;
    return kgram;
  }
  kgram.centromereRadius = function(_) {
    if (!arguments.length) return centromereRadius;
    centromereRadius = _;
    return kgram;
  };
  kgram.armClipRadius = function(_) {
    if (!arguments.length) return armClipRadius;
    armClipRadius = _;
    return kgram;
  };

  // Utilities:
  kgram.positionFromAbsoluteBp = function(bp) {
    // Returns the position at a given absolute base pair.
    if (arguments.length !== 1)
      throw "Must pass argument `absolute bp position`.";
    return positionFromAbsoluteBp(data, bp);
  };
  kgram.positionFromRelative = function(name, bp) {
    // Returns the position at a relative base position within a chromosome
    // given by the string name.
    if (arguments.length !== 2)
      throw "Must pass arguments `name of chromosome` and `relative bp position`.";
    var chr = chromosomeFromName(data, name);
    if (bp === null) bp = chr.end;
    else bp = chr.start + bp;
    return positionFromAbsoluteBp(data, bp);
  };

  // Interact
  kgram.svg = function() {
    return svg;
  };
  kgram.scale = function() {
    return xscale;
  };
  kgram.zoom = function(domain) {
    if (arguments.length !== 1)
      throw "Must pass argument `[domainStart, domainEnd]`.";
    d3.transition().tween('zoom', function() {
      var interpolatedX = d3.interpolate(xscale.domain(), domain);
      return function(t) {
        zoom.x(xscale.domain(interpolatedX(t)));
        redraw();
      };
    });
    return kgram;
  };
  kgram.redraw = function(_) {
    if (!arguments.length) return redraw();
    customRedraw = _;
    return kgram;
  };
  kgram.on = function(type, callback) {
    events[type] = callback || identity;
    return kgram;
  };
  kgram.highlight = function() {
    if (!arguments.length) return highlights;
    var args = Array.prototype.slice.call(arguments);

    var futureHighlight = function() {
      var highlight = parseHighlight(data, args);

      highlight.remove = function() {
        var idx = highlights.indexOf(highlight);
        highlights.splice(idx, 1);
        if (drawn) redraw(null, null, null, true);
        highlight.remove = null;
        return kgram;
      }
      highlights.push(highlight);

      return highlight;
    }

    if (drawn) {
      var result = futureHighlight();
      redraw(null, null, null, true);
      return result;
    } else {
      deferred.push(futureHighlight);
      return kgram;
    }
  };
  kgram.highlights = function() {
    return highlights;
  };
  kgram.zoomBehavior = function() {
    return zoom;
  }


  highlights.remove = function() {
    // This allows us to remove all highlights at once from the highlight array
    // itself.
    highlights.map(function(highlight) {
      return highlight.remove;
    }).map(function(remove) { remove() });
  };


  function redraw() {
    // Redraws (mostly this means repositions and changes the width of chromosomes
    // and their bands) the karyogram.
    //
    // Closes around xscale.
    var chromosomes = svg.selectAll('.chromosome');

    resizeArmClips(chromosomes, xscale, armClipRadius);
    resizeBands(chromosomes, xscale, idiogramHeight, centromereRadius);
    renderHighlights(svg, data, highlights, xscale, idiogramHeight, highlightHeight);
    customRedraw(svg, xscale);
    reattachListenerToTop(svg);

    return kgram;
  }


  function initializeMouseListener(listener) {
    // Initializes all event & behavior listeners on an invisible rectangle on
    // top of all the SVG elements.
    //
    // Closes around xscale, zoom.
    zoom = d3.behavior.zoom()
          .x(xscale)
          .on('zoom', onzoom)
          .on('zoomstart', dispatchEvent('zoomstart'))
          .on('zoomend', dispatchEvent('zoomend'));

    var drag = d3.behavior.drag()
          .on('drag', dispatchEvent('drag'))
          .on('dragstart', dispatchEvent('dragstart'))
          .on('dragend', dispatchEvent('dragend'));

    listener
        .on('mousemove', dispatchEvent('mousemove'))
        .on('mousedown', dispatchEvent('mousedown'))
        .on('mouseup', dispatchEvent('mouseup'))
        .on('click', dispatchEvent('click'))
        .call(zoom)
        .call(drag);

    function onzoom() {
      var position = positionFrom(data, d3.mouse(this), xscale);
      redraw();
      events['zoom'] && events['zoom'](position, kgram);
    }
    function dispatchEvent(type) {
      return function() {
        if (events[type]) {
          var position = positionFrom(data, d3.mouse(this), xscale);
          events[type] && events[type](position, kgram);
        }
      }
    }
  }

  return kgram;
}


function identity(_) {
  return _;
}


function getter(attr) {
  return function(d) {
    return d[attr];
  }
}


function gstainFiller(d) {
  var stain = d.gstain;
  if (stain === 'gneg') {
    return '#dfdfdf';
  } else if (stain === 'gpos') {
    return '#525252';
  } else if (stain === 'acen') {
    return null;
  } else if (stain === 'gvar') {
    return '#cfcfcf';
  } else if (stain === 'stalk') {
    return '#cfcfcf';
  } else {
    return 'white';
  }
}


function addPQArms(chromosome) {
  var bands = chromosome.values;

  var centerP = bands.filter(function(d) {
    return d.gstain === 'acen' && d.bandname[0] === 'p';
  });

  var centerQ = bands.filter(function(d) {
    return d.gstain === 'acen' && d.bandname[0] === 'q';
  });

  chromosome.pArm = { start: chromosome.start };
  chromosome.qArm = { end: chromosome.end };

  if (centerP.length > 0)
    chromosome.pArm.end = chromosome.start + centerP[0].end;
  if (centerQ.length > 0)
    chromosome.qArm.start = chromosome.start + centerQ[0].start;
}


function resizeArmClips(chromosomes, xscale, armClipRadius) {
  var xMin = xscale.domain()[0];

  chromosomes.selectAll('.clipper-p')
      // xMin required because these coords are within-chromosome
      .attr('width', function(d) { return xscale(xMin + d.pArm.end - d.pArm.start); })
      .attr('rx', armClipRadius)
      .attr('ry', armClipRadius);

  chromosomes.selectAll('.clipper-q')
      // xMin required because these coords are within-chromosome
      .attr('x', function(d) { return xscale(xMin + d.pArm.end - d.pArm.start); })
      .attr('width', function(d) { return xscale(xMin + d.qArm.end - d.qArm.start); })
      .attr('rx', armClipRadius)
      .attr('ry', armClipRadius);
}


function resizeBands(chromosomes, xscale, idiogramHeight, centromereRadius) {
  var xMin = xscale.domain()[0],
      xMax = xscale.domain()[1];

  chromosomes
      .attr('transform', function(d) {
        return 'translate(' + xscale(d.start) + ',0)';
      });

  chromosomes
    .selectAll('.band')
      // xMin required because these coords are within-chromosome
      .attr('x', function(d) { return xscale(xMin + d.start); })
      .attr('width', function(d) { return xscale(xMin + d.end - d.start); })
      .attr('clip-path', function(d) {
        if ((d.end + d.chromosome.start) <= d.chromosome.center) // then we're in the P arm
          return 'url(#' + d.chromosomeName + '-clipper-P' + ')';
        else // well, then we're in the Q arm
          return 'url(#' + d.chromosomeName + '-clipper-Q' + ')';
      });

  chromosomes
    .selectAll('.centromere')
      .attr('cx', function(d) {
        return xscale(xMin + d.center - d.start);
      })
      .attr('cy', idiogramHeight/2)
      .attr('fill', '#FF3333')
      .attr('r', centromereRadius);
}


function reattachListenerToTop(svg) {
  svg.node().appendChild(svg.select('#listener').node());
}


function appendSvg(selector, width, height, margin) {
  return selector
    .append('svg')
      .attr('width', width)
      .attr('height', height)
    .append('g')
      .attr('transform', 'translate(' + margin.left + ',' + margin.top + ')');
}


function appendChromosomes(svg, data, bandStainer, idiogramHeight) {
  var chromosomes = svg.selectAll('.chromosome')
      .data(data)
    .enter().append('g')
      .attr('class', 'chromosome');

  chromosomes.selectAll('.band')
      .data(function(d) { return d.values; })
    .enter().append('rect')
      .attr('class', 'band')
      .attr('fill', bandStainer)
      .attr('y', 0)
      .attr('height', idiogramHeight);

  chromosomes.selectAll('.centromere')
      .data(function(d) { return [d]; })
    .enter().append('circle')
      .attr('class', 'centromere');

  return chromosomes;
}


// This appends, to the chromosomes (a d3 selection) clipping rectangles in
// order to display the start and and of p and q arms (and, as such, delineate
// chromosomes from one another as well).
function appendArmClips(chromosomes, idiogramHeight) {
  chromosomes
    .append('g')
    .append('clipPath')
      .attr('id', function(d) {
        return d.key + '-clipper-P';
      })
    .append('rect')
      .attr('class', 'clipper-p')
      .attr('y', 0)
      .attr('height', idiogramHeight)
      .attr('x', 0);

  chromosomes
    .append('g')
    .append('clipPath')
      .attr('id', function(d) {
        return d.key + '-clipper-Q';
      })
    .append('rect')
      .attr('class', 'clipper-q')
      .attr('y', 0)
      .attr('height', idiogramHeight);
}


// This appends an invisible rectangle to the svg, which will listen for events.
function appendListenerBox(svg, width, height, margin) {
  return svg.append('rect')
    .attr('id', 'listener')
    .attr('width', width)
    .attr('height', height)
    .attr('x', -margin.left)
    .attr('y', -margin.top)
    .attr('opacity', 0);
}


function renderHighlights(svg, data, highlights, xscale, idiogramHeight, highlightHeight) {
  var highlight = svg.selectAll('.highlight')
        .data(highlights, highlightKey),
      xMin = xscale.domain()[0],
      xMax = xscale.domain()[1];

  highlight
    .enter().append('rect')
      .attr('class', 'highlight')
      .attr('height', highlightHeight);

  highlight
      .attr('x', function(d) {
        return xscale(d.start);
      })
      .attr('y', -(highlightHeight/2)+(idiogramHeight/2))
      .attr('width', function(d) {
        return xscale(xMin + d.end - d.start);
      })
      .attr('fill', getter('color'))
      .attr('opacity', getter('opacity'));

  highlight.exit().remove();

  function highlightKey(d) {
    return d.chrStart + ':' + d.start + '-' + d.chrEnd + ':' + d.end;
  }
}


function parseHighlight(data, args) {
  // Parses a highlight object from an argument array.
  //
  // Or, if already parsed, returns the object.
  // Returns {chrStart: chr, chrEnd: chr, start: numberInAbsoluteBp,
  //          end: numberInAbsoluteBp, color: 'color', opacity: opacity}
  if (!Array.isArray(args)) return args;

  var chrStart, chrEnd, start, end, opts,
      color = HIGHLIGHT_COLOR, opacity = HIGHLIGHT_OPACITY;

  if (typeof args[0] === 'string') {
    // We assume agr 1 is chr name string, arg 2 is relative bp,
    // args 3 is chr name string 2, arg 4 is relative bp within that chr,
    // then opts (opts is always assumed last).
    chrStart = chromosomeFromName(data, args[0]);
    chrEnd = chromosomeFromName(data, args[2]);
    start = args[1] + chrStart.start;
    end = args[3] + chrEnd.start;
    opts = args[4];
  } else if (typeof args[0] === 'number') {
    // Then we assume args 1 and 2 are the absolute base pairs
    start = args[0];
    end = args[1];
    if (!end) {
      end = data.totalBases;
    }
    chrStart = chromosomeFromAbsoluteBp(data, start);
    chrEnd = chromosomeFromAbsoluteBp(data, end);
    opts = args[2];
  } else if (typeof args[0].chromosome === 'string') {
    // Else we assume args 1, 2 like {bp: relativeBp, chromsome: 'chr1-Y'}
    chrStart = chromosomeFromName(data, args[0].chromosome);
    chrEnd = chromosomeFromName(data, args[1].chromosome);
    start = args[0].bp + chrStart.start;
    end = args[1].bp + chrEnd.start;
    opts = args[2];
  } else {
    // Else we assume it's a position object (as passed to the event handlers)
    // {absoluteBp: xyz, chromsome: { chr object ... }, etc}
    chrStart = args[0].chromosome;
    chrEnd = args[1].chromosome;
    start = args[0].absoluteBp;
    end = args[1].absoluteBp;
    opts = args[2];
  }
  if (opts && opts.color) color = opts.color;
  if (opts && opts.opacity) opacity = opts.opacity;

  var tmp;
  // Order the start and end.
  if (start > end) {
    tmp = start;
    start = end;
    end = tmp;
    tmp = chrStart;
    chrStart = chrEnd;
    chrEnd = tmp;
  }

  return {
    chrStart: chrStart,
    chrEnd: chrEnd,
    start: start,
    end: end,
    color: color,
    opacity: opacity
  }
}


function positionFrom(data, mouse, xscale) {
  var bp = bpFromMouse(mouse, xscale);
  return positionFromAbsoluteBp(data, bp);
}


function positionFromAbsoluteBp(data, absoluteBp) {
  var fmtBp = d3.format(','),
      chromosome = chromosomeFromAbsoluteBp(data, absoluteBp),
      position = { absoluteBp: absoluteBp,
                   fmtAbsoluteBp: fmtBp(absoluteBp) };

  if (chromosome) {
    position.chromosome = chromosome;
    position.relativeBp = absoluteBp - chromosome.start;
    position.fmtRelativeBp = fmtBp(position.relativeBp);
  }
  return position;
}


function bpFromMouse(mouse, xscale) {
  return Math.round(xscale.invert(mouse[0]));
}


function chromosomeFromAbsoluteBp(data, bp) {
  return data.filter(function(chr) {
    return chr.start <= bp && chr.end > bp;
  })[0];
}


function chromosomeFromName(data, name) {
  return data.filter(function(chr) {
    return chr.key === name;
  })[0];
}


function cytobandsToChromosomes(cytobands) {
  // Remove the contigs we don't care about.
  cytobands = cytobands.filter(function(d) {
    return INCLUDED_CHROMOSOME_NAMES.indexOf(d.chromosomeName) != -1;
  });

  // Group bands by chromosomes
  var chromosomes = d3.nest()
    .key(getter('chromosomeName'))
    .sortKeys(chromosomeComparator)
    .entries(cytobands);

  // Add metainformation to each chromosome
  var totalBases = 0;
  for (var i in chromosomes) {
    var bands = chromosomes[i].values;
    var chromosomeLength = d3.max(bands, getter('end'));
    chromosomes[i].basePairs = chromosomeLength;
    chromosomes[i].start = totalBases;
    totalBases += chromosomeLength;
    chromosomes[i].end = totalBases;

    addPQArms(chromosomes[i]);
    bands.map(function(d) {
      d.chromosome = chromosomes[i];
    });
    chromosomes[i].center = chromosomes[i].pArm.end;
  }
  chromosomes.totalBases = totalBases;

  return chromosomes;
}


function chromosomeComparator(k1, k2) {
  // Orders chromosomes strings (e.g. chrX < chr19 etc).
  k1 = k1.slice(3);
  k2 = k2.slice(3);

  if (k1 === 'X' || k1 === 'Y' || k2 === 'X' || k2 === 'Y') {
    if ((k1 === 'X' || k1 === 'Y') && (k2 === 'X' || k2 === 'Y')) {
      // Both are X, Y, Y comes second.
      return k1 === 'Y' ? 1 : -1;
    } else {
      // Then just one of them is X or Y, whichever is comes second.
      return ['X', 'Y'].indexOf(k1) === -1 ? -1 : 1;
    }
  }

  return parseInt(k1) > parseInt(k2) ? 1 : -1;
}


function parseCytoRow(row) {
  return {
    chromosomeName: row.chromosomeName,
    start: parseInt(row.start, 10),
    end: parseInt(row.end, 10),
    bandname: row.bandname,
    gstain: row.gstain
  };
}


function _init(callback) {
  if (_idiogrammatik.__data__)
    callback(null, window.idiogrammatik.__data__);
  else
    d3.tsv(_idiogrammatik.__cytoband_url__, parseCytoRow, function(err, data) {
      if (err) {
        callback(err);
      } else {
        _idiogrammatik.__data__ = cytobandsToChromosomes(data);
        callback(null, _idiogrammatik.__data__);
      }
    });
}


_idiogrammatik.__cytoband_url__ = CYTOBAND_TSV_URL;
_idiogrammatik.load = _init;


// Example usage:
//
//      idiogrammatik.load(function(err, data) {
//        d3.select('body')
//           .datum(data)
//           .call(idiogramatik());
//      });
//
// See more in `test.html` & the README.md/DOCUMENTATION.md files.


// Export idiogrammatik for either node-type requires or for browers.
if (typeof exports !== 'undefined') {
  if (typeof module !== 'undefined' && module.exports) {
    exports = module.exports = _idiogrammatik;
  }
  exports = _idiogrammatik;
} else {
  this.idiogrammatik = _idiogrammatik;
}

}.call(this));
