"use strict";

var React = require('react'),
    _ = require('underscore');
// Someday: pileup = require('pileup');

// Indicator value that the BAI chunks are still loading.
var CHUNKS_LOADING = 'loading',
    CHUNKS_NOT_AVAILABLE = null;

var PileupViewer = React.createClass({
  propTypes: {
    isOpen: React.PropTypes.bool,
    // Currently selected variant, or null for no selection.
    selectedRecord: React.PropTypes.object,
    vcfPath: React.PropTypes.string.isRequired,
    truthVcfPath: React.PropTypes.string,
    normalBamPath: React.PropTypes.string,
    tumorBamPath: React.PropTypes.string,
    // Event handlers
    handleClose: React.PropTypes.func.isRequired,
    handlePreviousRecord: React.PropTypes.func.isRequired,
    handleNextRecord: React.PropTypes.func.isRequired,
    // Configuration
    igvHttpfsUrl: React.PropTypes.string.isRequired
  },
  getInitialState: () => ({
    // Chunk props can either be null (not available), loading or the chunks.
    normalBaiChunks: CHUNKS_LOADING,
    tumorBaiChunks: CHUNKS_LOADING,
  }),
  render: function() {
    var style = {};
    if (!this.props.isOpen ||
        !this.props.selectedRecord ||
        this.state.normalBaiChunks == CHUNKS_LOADING ||
        this.state.tumorBaiChunks == CHUNKS_LOADING) {
      style = {display: 'none'};
    }

    return (
      <div className="variant-inspector" ref="inspector" style={style}>
        <a href='#' className="close-button" onClick={this.handleClose}>✕</a>
        <a href='#' className="left-button" onClick={this.handleLeft}>←</a>
        <a href='#' className="right-button" onClick={this.handleRight}>→</a>
        <div ref="pileupElement" id="svgHolder" />
      </div>
    );
  },
  // Convert an HDFS path to a browser-accessible URL via igv-httpfs.
  hdfsUrl: function(path) {
    return this.props.igvHttpfsUrl + path;
  },
  handleClose: function(e) {
    e.preventDefault();
    this.props.handleClose();
  },
  handleLeft: function(e) {
    e.preventDefault();
    this.props.handlePreviousRecord();
  },
  handleRight: function(e) {
    e.preventDefault();
    this.props.handleNextRecord();
  },
  browser: null,
  lazilyCreateDalliance: function() {
    if (this.browser) return;

    var vcfSource = (name, path) => ({
      name: name,
      viz: pileup.viz.variants(),
      data: pileup.formats.vcf({
        url: this.hdfsUrl(path)
      })
    });

    var bamSource = (name, cssClass, path, chunks) => ({
      name: name,
      cssClass: cssClass,
      viz: pileup.viz.pileup(),
      data: pileup.formats.bam({
        url: this.hdfsUrl(path),
        indexUrl: this.hdfsUrl(path + '.bai'),
        // TODO: indexChunks: chunks
      })
    });

    var sources = [
        {
          name: 'Genome',
          viz: pileup.viz.genome(),
          isReference: true,
          data: pileup.formats.twoBit({
            url: 'http://www.biodalliance.org/datasets/hg19.2bit'
          })
        },
        vcfSource('Run VCF', this.props.vcfPath)
    ];
    if (this.props.truthVcfPath) {
      sources.push(vcfSource('Truth VCF', this.props.truthVcfPath));
    }

    if (this.props.normalBamPath) {
      sources.push(bamSource('Normal', 'normal', this.props.normalBamPath, this.state.normalBaiChunks));
    }
    if (this.props.tumorBamPath) {
      sources.push(bamSource('Tumor', 'tumor', this.props.tumorBamPath, this.state.tumorBaiChunks));
    }

    var pileupEl = this.refs.pileupElement.getDOMNode();

    this.browser = pileup.create(pileupEl, {
      range: {
        contig: '20',  // random position -- it will be changed.
        start:  2684736 - 50,
        stop:   2684736 + 50
      },
      tracks: sources
    });
  },
  panToSelection: function() {
    var rec = this.props.selectedRecord;
    this.browser.setRange({
      contig: rec.contig,
      start: rec.position - 25,
      stop: rec.position + 25
    });
  },
  update: function() {
    if (this.props.isOpen && this.props.selectedRecord) {
      this.lazilyCreateDalliance();
      this.panToSelection();
    }
  },
  fetchIndexChunks: function() {
    var propBamPathPairs = [['normalBaiChunks', this.props.normalBamPath],
                            ['tumorBaiChunks', this.props.tumorBamPath]];

    propBamPathPairs.forEach(v => {
        var [propName, bamPath] = v;
        if (!bamPath) {
          this.setState(_.object([propName], [CHUNKS_NOT_AVAILABLE]));
          return;
        }

        var chunkPath = bamPath.replace('.bam', '.bam.bai.json');
        $.getJSON(this.hdfsUrl(chunkPath))
          .done((chunks) => {
            this.setState(_.object([propName], [chunks]));
          }).fail((jqXHR, error, textStatus) => {
            this.setState(_.object([propName], [CHUNKS_NOT_AVAILABLE]));
            if (textStatus != 'Not Found') {
              throw `Invalid bai.json file ${chunkPath} ${error} ${textStatus}`;
            }
          });
      });
  },
  componentDidMount: function() {
    this.fetchIndexChunks();
    this.update();
  },
  componentDidUpdate: function() {
    this.update();
  },
  componentWillUnmount: function() {
  },
  shouldComponentUpdate: function(nextProps, nextState) {
    return ((nextProps.isOpen != this.props.isOpen) ||
            (nextProps.selectedRecord != this.props.selectedRecord));
  },
});


module.exports = PileupViewer;
