/** @jsx React.DOM */
"use strict";

var _ = require('underscore'),
    d3 = require('d3/d3'),
    React = require('react/addons'),
    types = require('./types'),
    idiogrammatik = require('idiogrammatik.js'),
    vcf = require('vcf.js'),
    CHROMOSOMES = require('../../../data/basic-chromosomes');


var Karyogram = React.createClass({
  propTypes: {
    position: React.PropTypes.object.isRequired,
    hasLoaded: React.PropTypes.bool.isRequired,
    records: React.PropTypes.arrayOf(React.PropTypes.object).isRequired,
    handleRangeChange: React.PropTypes.func.isRequired
  },
  getInitialState: function() {
    return {
      focused: false,
      karyogram: null,
      chromosomes: CHROMOSOMES,
      maxVariantsInABand: 0
    };
  },
  componentWillReceiveProps: function(props) {
    if (!this.props.hasLoaded && props.hasLoaded) {
      var chromosomes = this.state.chromosomes,
          width = this.getDOMNode().offsetWidth,
          chromosomes = addVariantDensity(chromosomes, props.records, width),
          maxVariantsInABand = d3.max(chromosomes, c => d3.max(c.bands, b => b.value)),
          karyogram = this.initializeKaryogram({width, maxVariantsInABand});
      this.setState({chromosomes, maxVariantsInABand, karyogram});
    }

    if (!this.state.karyogram) return;

    var chromosome = props.position.chromosome,
        start = props.position.start,
        end = props.position.end,
        kgram = this.state.karyogram;
    kgram.highlights().remove();

    if (chromosome !== this.props.position.chromosome) {
      if (chromosome === null) kgram.zoom(kgram.ALL_CHROMOSOMES);
      else kgram.zoom(chromosome);
    }
    if (this.props.position.chromosome !== types.ALL_CHROMOSOMES) {
      if (!start && !end) {
        // We don't want to highlight the whole chromosome, that's cluttering.
      } else if (start && !end) {
        // We'll highlight until the end of the chromosome.
        kgram.highlight(chromosome, start, kgram.get(chromosome).totalBases);
      } else if (!start && end) {
        // We'll highlight from 0 to the end of the chromosome.
        kgram.highlight(chromosome, 0, end);
      } else if (start && end) {
        // We'll highlight the selected range of the chromosome.
        kgram.highlight(chromosome, start, end);
      }
    }
  },
  /**
   * Adds listeners for giving the karyogram focus when clicked on, and losing
   * it when mouseout occurs.
   */
  initializeFocusSelection: function(karyogram) {
    karyogram
      .on('.zoom', null)  // disable zoom capture by default;
      .on('click.focused', function() {  // enable zooming on click
        if (!this.state.focused) {
          karyogram.call(karyogram.zoom());
          this.setState({focused: true});
        }
      }.bind(this))
      .on('mouseout', function() {  // and disable again when moused out
        karyogram.on('.zoom', null);
        this.setState({focused: false});
      }.bind(this));
  },
  /**
   * Adds listeners for selecting and highlighting ranges of the karyogram.
   */
  initializeHighlightingSelection: function(karyogram) {
    var firstPos = null,
        selection = {},  // the current highlight/selected range
        shiftKey = false,  // if the shift key is down
        that = this;

    window.addEventListener('keydown', function(e) {
      if (e.shiftKey && this.state.focused) {
        document.getElementsByTagName("body")[0].style.cursor = "text";
        shiftKey = true;
        that.setState({focused: true});
        karyogram.on(".zoom", null);
      }
    }.bind(this));

    window.addEventListener('keyup', function(e) {
      document.getElementsByTagName("body")[0].style.cursor = "default";
      if (shiftKey && !e.shiftKey) {
        shiftKey = false;
        karyogram.call(karyogram.zoom());
        if (!this.state.focused) that.setState({focused: false});
      }
    }.bind(this));

    karyogram.drag()
      .on('dragstart', function() {
        var position = karyogram.position(this);
        if (!position.chromosome || !shiftKey) return;
        firstPos = position;
      })
      .on('drag', function() {
        var pos = karyogram.position(this);
        if (selection.remove) selection.remove();
        if (!pos.chromosome || !shiftKey || pos.chromosome !== firstPos.chromosome)
          return;
        var chr = pos.chromosome.name, start = firstPos.basePair, end = pos.basePair;
        if (start > end) var temp = start, start = end, end = temp;

        selection = karyogram.highlight(chr, start, end);
      })
      .on('dragend', function() {
        var pos = karyogram.position(this);
        if (selection.remove) selection.remove();
        if (!pos.chromosome || !shiftKey || pos.chromosome !== firstPos.chromosome)
          return;
        var chr = pos.chromosome.name, start = firstPos.basePair, end = pos.basePair;
        if (start > end) var temp = start, start = end, end = temp;

        that.props.handleRangeChange({chromosome: chr, start, end});
        selection = karyogram.highlight(chr, start, end);
      });
  },
  /** Render the karyogram into the DOM. */
  renderKaryogram: function() {
    var karyogram = this.state.karyogram,
        node = this.getDOMNode();

    // Remove old karyogram.
    d3.select(node)
      .selectAll('*')
      .remove();

    d3.select(node)
      .datum(this.state.chromosomes)
      .call(karyogram);

    this.initializeHighlightingSelection(karyogram);
    this.initializeFocusSelection(karyogram);
  },
  /** Return configured karyogram object to be rendered into the DOM. */
  initializeKaryogram: function({width, maxVariantsInABand}) {
    var that = this,
        depthColorScale = d3.scale.linear()
            .domain([0, maxVariantsInABand])
        .range(['#e8e8e8', 'black']);

    var kgram =  idiogrammatik()
        .width(width)
        .idiogramHeight(11)
        .highlightHeight(59)
        .stainer(band => depthColorScale(band.value));

    kgram
        .redraw(function(svg, scale) {
          // Extract the actual chromosome data.
          var data = svg.selectAll('.chromosome').data();

          svg.selectAll('.chromosome-name').remove();

          // Appends the elements once.
          svg.selectAll('.chromosome-name')
              .data(data, d => d.name)
            .enter().append('text')
              .attr('class', 'chromosome-name')
            .attr('y', -9)
            .style('cursor', 'pointer')
            .text(d => d.name)
            .attr('x', d => scale(d.absoluteStart))
            .on('click', function() {
              that.props.handleRangeChange({chromosome: this.__data__.name,
                                            start: null,
                                            end: null});
              kgram.call(kgram.zoom());
              that.setState({focused: true});
            })
            .on('mouseover', function() {
              kgram.call(kgram.zoom());
              that.setState({focused: true});
            });
        });
    return kgram;
  },
  componentDidUpdate: function(prevProps, prevState) {
    var newlyLoaded = !prevProps.hasLoaded && this.props.hasLoaded;
    if (newlyLoaded) this.renderKaryogram();
  },
  render: function() {
    var classes = React.addons.classSet({'karyogram': true,
                                         'visible': this.props.hasLoaded,
                                         'focused': this.state.focused});
    return <div className={classes}></div>;
  }
});


/**
 * Return chromosomes with records binned inside of them (count of records in
 * a given bin at the `value' key on the bin), with `bin' total bins.
 */
function addVariantDensity(chromosomes, records, bins) {
  var totalLength = _.reduce(chromosomes, (total, chromosome) => {
    return total + chromosome.bands[0].end;
  }, 0);

  _.each(chromosomes, chromosome => {
    var bases = chromosome.bands[0].end,
        innerBins = Math.ceil(bases / totalLength * bins),
        basesPerBin = Math.round(bases / innerBins);

    chromosome.bands = _.map(_.range(innerBins), bIdx => {
      var start = bIdx * basesPerBin,
          end = (bIdx + 1) * basesPerBin,
          value = vcf.fetch(records, chromosome.name, start, end).length;
      return {value, start, end};
    });
  });
  return chromosomes;
}

module.exports = Karyogram;
