"use strict";

var React = require('react'),
    _ = require('underscore'),
    pileup = require('pileup'),
    $ = require('jquery'),
    VCFTable = require('./VCFTable');

// Indicator value that the BAI chunks are still loading.
var CHUNKS_LOADING = 'loading',
    CHUNKS_NOT_AVAILABLE = null;

// Number of loci to show around the variant.
var VIEW_WINDOW = 50;

var PileupViewer = React.createClass({
  propTypes: {
    isOpen: React.PropTypes.bool,
    // Currently selected variant, or null for no selection.
    selectedRecord: React.PropTypes.object,
    columns: React.PropTypes.object.isRequired,
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
    var isVisible = true;
    if (!this.props.isOpen ||
        !this.props.selectedRecord ||
        this.state.normalBaiChunks == CHUNKS_LOADING ||
        this.state.tumorBaiChunks == CHUNKS_LOADING) {
      isVisible = false;
    }
    var style = isVisible ? {} : {display: 'none'};

    var vcfTable = !isVisible ? null : (
      <VCFTable columns={this.props.columns}
                selectedRecord={null}
                records={[this.props.selectedRecord]}
                sortBys={[]}
                handleSortByChange={_.noop}
                handleRequestPage={_.noop}
                handleSelectRecord={_.noop}
                handleOpenViewer={_.noop}
                handleSetComment={_.noop}
                handleDeleteComment={_.noop}
                currentUser={{}}
                handleStarGenotype={_.noop} />
    );

    return (
      <div className="variant-inspector" ref="inspector" style={style}>
        {vcfTable}
        <a href='#' className="close-button" onClick={this.handleClose}></a>
        <a href='#' className="left-button" onClick={this.handleLeft}></a>
        <a href='#' className="right-button" onClick={this.handleRight}></a>
        <div ref="pileupElement" id="pileup-container" />
      </div>
    );
  },
  canDisplayPath: function(path) {
    return path &&
      (path.indexOf('http://') > -1 || path.indexOf('https://') > -1);
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
        url: path
      })
    });

    var bamSource = (name, cssClass, path, chunks) => {
      var data = pileup.formats.bam({
          url: path,
          indexUrl: path + '.bai',
          indexChunks: chunks
        });
      return [
        {
          name, cssClass, data,
          viz: pileup.viz.coverage()
        },
        {
          name, cssClass, data,
          viz: pileup.viz.pileup()
        }
      ];
    };

    var sources = [
        {
          name: 'Genome',
          viz: pileup.viz.genome(),
          isReference: true,
          data: pileup.formats.twoBit({
            url: 'http://www.biodalliance.org/datasets/hg19.2bit'
          })
        },
        {
          name: 'Scale',
          viz: pileup.viz.scale()
        },
        {
          name: 'Location',
          viz: pileup.viz.location()
        }
    ];

    // See https://github.com/hammerlab/cycledash/issues/525
    if (this.canDisplayPath(this.props.vcfPath)) {
      sources.push(vcfSource('Run VCF', this.props.vcfPath));
    }
    if (this.canDisplayPath(this.props.truthVcfPath)) {
      sources.push(vcfSource('Truth VCF', this.props.truthVcfPath));
    }

    if (this.props.normalBamPath) {
      sources = sources.concat(bamSource('Normal', 'normal', this.props.normalBamPath, this.state.normalBaiChunks));
    }
    if (this.props.tumorBamPath) {
      sources = sources.concat(bamSource('Tumor', 'tumor', this.props.tumorBamPath, this.state.tumorBaiChunks));
    }

    var pileupEl = this.refs.pileupElement;

    this.browser = pileup.create(pileupEl, {
      range: this.rangeForRecord(this.props.selectedRecord),
      tracks: sources
    });
  },
  panToSelection: function() {
    this.browser.setRange(this.rangeForRecord(this.props.selectedRecord));
  },
  update: function() {
    if (this.props.isOpen && this.props.selectedRecord) {
      if (!this.browser) {
        this.lazilyCreateDalliance();
      } else {
        this.panToSelection();
      }
    }
  },
  rangeForRecord: function(record) {
    return {
      contig: record.contig,
      start: record.position - VIEW_WINDOW / 2,
      stop: record.position + VIEW_WINDOW / 2
    };
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
        $.getJSON(chunkPath)
          .done((chunks) => {
            this.setState(_.object([propName], [chunks]));
          }).fail((jqXHR, error, textStatus) => {
            this.setState(_.object([propName], [CHUNKS_NOT_AVAILABLE]));
            if (textStatus != 'Not Found') {
              console.warn(`Invalid bai.json file ${chunkPath} ${error} ${textStatus}`);
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
  shouldComponentUpdate: function(nextProps, nextState) {
    return ((nextProps.isOpen != this.props.isOpen) ||
            (nextProps.selectedRecord != this.props.selectedRecord));
  },
});


module.exports = PileupViewer;
