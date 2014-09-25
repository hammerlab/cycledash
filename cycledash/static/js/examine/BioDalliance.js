/** @jsx React.DOM */
"use strict";

var _ = require('underscore'),
    d3 = require('d3'),
    React = require('react');

// Convert an HDFS path to a browser-accessible URL via igv-httpfs.
function hdfsUrl(path) {
  return 'http://hammerlab-dev3.hpc.mssm.edu:9876' + path;
}


var BioDalliance = React.createClass({
  propTypes: {
    // Currently selected variant, or null for no selection.
    selectedRecord: React.PropTypes.object,
    vcfPath: React.PropTypes.string.isRequired,
    // Truth VCF should become optional once /examine no longer requires it.
    truthVcfPath: React.PropTypes.string.isRequired,
    normalBamPath:  React.PropTypes.string,
    tumorBamPath:  React.PropTypes.string,

    // Event handlers
    handleNextVariant: React.PropTypes.func.isRequired,
    handlePreviousVariant: React.PropTypes.func.isRequired,
    handleClose: React.PropTypes.func.isRequired
  },
  render: function() {
    var style = {};
    if (this.props.selectedRecord == null) {
      style = {display: 'none'};
    }

    return (
      <div className="variant-inspector" style={style}>
        <a href='#' className="close-button" onClick={this.handleClose}>✕</a>
        <div id="svgHolder" />
      </div>
    );
  },
  handleClose: function(e) {
    e.preventDefault();
    this.props.handleClose();
  },
  browser: null,
  lazilyCreateDalliance: function() {
    if (this.browser) return;

    var sources = [
          {
            name: 'Genome',
            twoBitURI: 'http://www.biodalliance.org/datasets/hg19.2bit',
            // twoBitURI: 'http://hgdownload.cse.ucsc.edu/goldenPath/hg19/bigZips/hg19.2bit',
            tier_type: 'sequence'
          },
          {
            name: 'Truth VCF',
            uri: hdfsUrl(this.props.truthVcfPath),
            tier_type: 'memstore',
            payload: 'vcf'
          },
          {
            name: 'Run VCF',
            uri: hdfsUrl(this.props.vcfPath),
            tier_type: 'memstore',
            payload: 'vcf'
          }
    ];
    if (this.props.normalBamPath) {
      sources = sources.concat(
          // (coverage bar charts would be nice, but create duplicate XHRs)
          // {
          //   name: 'Normal',
          //   bamURI: hdfsUrl(this.props.normalBamPath),
          //   tier_type: 'base-coverage',
          //   style: coverageStyle
          // },
          {
            name: 'Normal',
            bamURI: hdfsUrl(this.props.normalBamPath),
            tier_type: 'bam',
            style: bamStyle,
            className: 'pileup'
          });
    }
    if (this.props.tumorBamPath) {
      sources = sources.concat(
          // {
          //   name: 'Tumor',
          //   bamURI: hdfsUrl(this.props.tumorBamPath),
          //   tier_type: 'base-coverage',
          //   style: coverageStyle
          // },
          {
            name: 'Tumor',
            bamURI: hdfsUrl(this.props.tumorBamPath),
            tier_type: 'bam',
            style: bamStyle,
            className: 'pileup'
          }
      );
    }

    // BioDalliance steals these events. We just want default browser behavior.
    var guardian = new EventGuardian(HTMLDivElement, ['mousewheel', 'MozMousePixelScroll']);

    this.browser = new Browser({
        chr:       '20',  // random position -- it will be changed.
        viewStart: 2684736 - 50,
        viewEnd:   2684736 + 50,

        noSourceCSS: true,
        uiPrefix: document.location.protocol + '//' + document.location.host + '/static/dalliance/',
        noPersist: true,

        coordSystem: {
          speciesName: 'Human',
          taxon: 9606,
          auth: 'NCBI',
          version: '37',
          ucscName: 'hg19'
        },

        sources: sources,

        initListeners: function() {
          guardian.destroy();
        }
      });
  },
  panToSelection: function() {
    var rec = this.props.selectedRecord;
    this.browser.setLocation(rec.CHROM, rec.POS - 25, rec.POS + 25);
  },
  update: function() {
    if (this.props.selectedRecord) {
      this.lazilyCreateDalliance();
      this.panToSelection();
    }
  },
  componentDidMount: function() {
    this.update();
  },
  componentDidUpdate: function() {
    this.update();
  },
  shouldComponentUpdate: function(nextProps, nextState) {
    return (nextProps.selectedRecord != this.props.selectedRecord);
  },
});


// Block any attempt to listen to a set of events on a type of element.
// This is a hack to tame badly-behaved libraries.
var EventGuardian = function(elementClass, inputEvents) {
  var events = JSON.parse(JSON.stringify(inputEvents));

  this.elementClass_ = elementClass;
  var realListener = this.elementClass_.prototype.addEventListener;
  console.log('Guarding against', this.elementClass_, events);
  this.elementClass_.prototype.addEventListener = function(name, meth, useCapture) {
    if (events.indexOf(name) >= 0) {
      console.log('Blocking attempt to listen to', name);
      return;
    }
    return realListener.call(this, name, meth, useCapture);
  };

  this.realListener = realListener;
};

EventGuardian.prototype.destroy = function() {
  this.elementClass_.prototype.addEventListener = this.realListener_;
};


// Style for visualizing BAM reads.
var bamStyle = [
  {
    "zoom": "low",
    "style": {
      "glyph": "__NONE",
    }
  },
  {
    "zoom": "medium",
    "style": {
      "glyph": "__NONE",
    },
  },
  {
    "type": "bam",
    "zoom": "high",
    "style": {
      "glyph": "__SEQUENCE",
      "_minusColor": "lightgray",
      "_plusColor": "lightgray",
      "HEIGHT": 8,
      "BUMP": true,
      "LABEL": false,
      "ZINDEX": 20,
      "__INSERTIONS": "no",
      "__SEQCOLOR": "mismatch"  // "mismatch-all" will label all bases
    },
    "_typeRE": {},
    "_labelRE": {},
    "_methodRE": {}
  }
];


// Style for visualizing BAM coverage.
var coverageStyle = [
  {
    "type": "density",
    "zoom": "low",
    "style": {
      "glyph": "HISTOGRAM",
      "COLOR1": "gray",
      "HEIGHT": 30
    }
  },
  {
    "type": "density",
    "zoom": "medium",
    "style": {
      "glyph": "HISTOGRAM",
      "COLOR1": "gray",
      "HEIGHT": 30
    }
  },
  {
    "type": "base-coverage",
    "zoom": "high",
    "style": {
      "glyph": "HISTOGRAM",
      "COLOR1": "lightgray",
      "BGITEM": true,
      "HEIGHT": 30
    }
  }
];


module.exports = {
  BioDalliance
};
