/** @jsx React.DOM */
"use strict";

var _ = require('underscore'),
    d3 = require('d3/d3'),
    React = require('react'),
    types = require('./types'),
    idiogrammatik = require('idiogrammatik.js'),
    GSTAINED_CHROMOSOMES = require('../../../data/gstained-chromosomes');


var Karyogram = React.createClass({
  shouldComponentUpdate: function() {
    return false;
  },
  componentWillReceiveProps: function(props) {
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
    var karyogram = idiogrammatik().width(1400).highlightHeight(59);

    d3.select(this.getDOMNode())
      .datum(GSTAINED_CHROMOSOMES)
      .call(karyogram);

    var firstPos = null,
        selection = {}, // the current highlight/selected range
        shifted = false, // if the shift key is down
        focused = false; // if the kgram has focus on the page

    var that = this; // so that in 'dragend' handler we have both the real this, and the component this
    karyogram.drag()
      .on('dragstart', function() {
        var position = karyogram.position(this);
        if (!position.chromosome || !shifted) return;
        console.log('drag started', shifted);
        firstPos = position;
      })
      .on('drag', function() {
        var pos = karyogram.position(this);
        if (selection.remove) selection.remove();
        if (!pos.chromosome || !shifted || pos.chromosome !== firstPos.chromosome)
          return;
        var chr = pos.chromosome.name, start = firstPos.basePair, end = pos.basePair;
        if (start > end) var temp = start, start = end, end = temp;

        selection = karyogram.highlight(chr, start, end);
      })
      .on('dragend', function() {
        var pos = karyogram.position(this);
        if (selection.remove) selection.remove();
        if (!pos.chromosome || !shifted || pos.chromosome !== firstPos.chromosome)
          return;
        var chr = pos.chromosome.name, start = firstPos.basePair, end = pos.basePair;
        if (start > end) var temp = start, start = end, end = temp;

        that.props.handleRangeChange({chromosome: chr, start, end});
        selection = karyogram.highlight(chr, start, end);
      });

    karyogram
      .on('.zoom', null) // disable zoom capture by default;
      .on('click.focus', function() { // enable zooming on click
        if (!focused) {
          focused = true;
          karyogram.call(karyogram.zoom());
        }
      })
      .on('mouseout', function() { // and disable again when moused out
        focused = false;
        karyogram.on('.zoom', null);
      });

    window.onkeydown = function(e) {
      if (e.shiftKey) {
        document.getElementsByTagName("body")[0].style.cursor = "text";
        shifted = true;
        karyogram.on(".zoom", null);
      }
    }.bind(this);
    window.onkeyup = function(e) {
      document.getElementsByTagName("body")[0].style.cursor = "default";
      if (shifted && !e.shiftKey) {
        shifted = false;
        karyogram.call(karyogram.zoom());
      }
    }.bind(this);

    this.setState({karyogram: karyogram});
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

module.exports = {Karyogram, Loading};
