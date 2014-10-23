/** @jsx React.DOM */
"use strict";

var _ = require('underscore'),
    d3 = require('d3/d3'),
    React = require('react'),
    types = require('./types'),
    idiogrammatik = require('idiogrammatik.js');


var Karyogram = React.createClass({
  shouldComponentUpdate: function() {
    return false;
  },
  componentWillReceiveProps: function(props) {
    var chromosome = props.position.chromosome,
        start = props.position.start,
        end = props.position.end,
        kgram = this.props.karyogram;
    kgram.highlights().remove();

    if (chromosome !== this.props.position.chromosome) {
      if (chromosome === null) kgram.zoom(kgram.ALL_CHROMOSOMES);
      else kgram.zoom(chromosome);
    }
    if (this.props.position.chromosome !== types.ALL_CHROMOSOMES) {
      if (!start && !end) {
        // We don't want to highlight the whole chromosome, that's cluttering.
      } else if (start && !end) {
        // we'll highlight until the end of the chromosome
        kgram.highlight(chromosome, start, kgram.get(chromosome).totalBases);
      } else if (!start && end) {
        // we'll highlight from 0 to the end of the chromosome
        kgram.highlight(chromosome, 0, end);
      } else if (start && end) {
        // we'll highlight the selected range of the chromosome
        kgram.highlight(chromosome, start, end);
      }
    }
  },
  componentDidMount: function() {
    d3.select(this.getDOMNode())
      .datum(this.props.data)
      .call(this.props.karyogram);

    var firstPos = null,
        selection = {},  // the current highlight/selected range
        shifted = false;  // if the shift key is down

    this.props.karyogram
      .on('dragstart', function(position, kgram) {
        if (!position.chromosome || !shifted) return;
        firstPos = position;
      })
      .on('drag', function(pos, kgram) {
        if (selection.remove) selection.remove();
        if (!pos.chromosome || !shifted || pos.chromosome !== firstPos.chromosome)
          return;
        var chr = pos.chromosome.name, start = firstPos.basePair, end = pos.basePair;
        if (start > end) var temp = start, start = end, end = temp;

        selection = kgram.highlight(chr, start, end);
      })
      .on('dragend', (pos, kgram) => {
        if (selection.remove) selection.remove();
        if (!pos.chromosome || !shifted || pos.chromosome !== firstPos.chromosome)
          return;
        var chr = pos.chromosome.name, start = firstPos.basePair, end = pos.basePair;
        if (start > end) var temp = start, start = end, end = temp;

        this.props.handleRangeChange(chr, start, end);
        selection = kgram.highlight(chr, start, end);
      });

    window.onkeydown = function(e) {
      if (e.shiftKey) {
        document.getElementsByTagName("body")[0].style.cursor = "text";
        shifted = true;
        try {
          // This disables pan/zoom by unsetting the x domain.
          this.props.karyogram.zoomBehavior().x(null);
        } catch(err) {
          // We catch here, because setting the x attr above throws, though
          // it does what we want without causing problems...
        }
      }
    }.bind(this);
    window.onkeyup = function(e) {
      document.getElementsByTagName("body")[0].style.cursor = "default";
      if (shifted && !e.shiftKey) {
        shifted = false;
        this.props.karyogram.zoomBehavior().x(this.props.karyogram.scale());
      }
    }.bind(this);
  },
  render: function() {
    return <div className="karyogram"></div>;
  }
});

var Loading = React.createClass({
  propTypes: {
    hasLoaded: React.PropTypes.bool.isRequired,
    files: React.PropTypes.arrayOf(React.PropTypes.string).isRequired
  },
  render: function() {
    if (this.props.hasLoaded) {
      return null;
    } else if (this.props.error) {
      console.error("Error loading VCFs:", this.props.error);
      return (
        <div className="loading-initial-data">
          <p className="error">{this.props.error}</p>
        </div>
      );
    } else {
      var filePs = this.props.files.map(function(file, idx) {
        return <p key={idx}>{file}</p>;
      });
      return (
        <div className="loading-initial-data">
          <h1>Loading files&hellip;</h1>
          {filePs}
        </div>
      );
    }
  }
});

module.exports = {
  Karyogram: Karyogram,
  Loading: Loading
};
