/** @jsx React.DOM */
"use strict";

var React = require('react'),
    $ = require('jquery'),
    _ = require('underscore');

require('jquery-mousewheel')($);

// Indicator value that the BAI chunks are still loading.
var CHUNKS_LOADING = 'loading',
    CHUNKS_NOT_AVAILABLE = null;

var BioDalliance = React.createClass({
  propTypes: {
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
    console.log('PROPS:', this.props);
    var style = {};
    if (!this.props.selectedRecord ||
        this.state.normalBaiChunks == CHUNKS_LOADING ||
        this.state.tumorBaiChunks == CHUNKS_LOADING) {
      style = {display: 'none'};
    }

    return (
      <div className="variant-inspector" ref="inspector" style={style}>
        <a href='#' className="close-button" onClick={this.handleClose}>✕</a>
        <a href='#' className="left-button" onClick={this.handleLeft}>←</a>
        <a href='#' className="right-button" onClick={this.handleRight}>→</a>
        <div id="svgHolder" />
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

    // Workaround for https://github.com/dasmoth/dalliance/issues/125
    var uniquelyNamedBlob = (function() {
      var id = 0;
      return function(bytes) {
        var blob = new Blob([bytes]);
        blob.name = id++;
        return blob;
      };
    })();

    var vcfSource = (name, path) => {
      var source = {
        name: name,
        tier_type: 'memstore',
        payload: 'vcf'
      };
      source.uri = this.hdfsUrl(path);
      return source;
    };

    var bamSource = (name, path, chunks) => ({
        name: name,
        bamURI: this.hdfsUrl(path),
        tier_type: 'bam',
        style: bamStyle,
        className: 'pileup',
        indexChunks: chunks
    });

    var sources = [
        {
          name: 'Genome',
          twoBitURI: 'http://www.biodalliance.org/datasets/hg19.2bit',
          tier_type: 'sequence'
        },
        vcfSource('Run VCF', this.props.vcfPath)
    ];
    if (this.props.truthVcfPath) {
      sources.push(vcfSource('Truth VCF', this.props.truthVcfPath));
    }

    if (this.props.normalBamPath) {
      sources.push(bamSource('Normal', this.props.normalBamPath, this.state.normalBaiChunks));
    }
    if (this.props.tumorBamPath) {
      sources.push(bamSource('Tumor', this.props.tumorBamPath, this.state.tumorBaiChunks));
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
          }).fail((jqXHR, textStatus) => {
            this.setState(_.object([propName], [CHUNKS_NOT_AVAILABLE]));
          });
      });
  },
  componentDidMount: function() {
    this.fetchIndexChunks();
    this.update();

    $(this.refs.inspector.getDOMNode()).on('mousewheel.biodalliance', (e) => {
      var $target = $(e.target);
      var $tiers = $target.parents('.tier.pileup');
      if ($tiers.length === 0) {
        e.preventDefault();
      }
    }).on('mousewheel.biodalliance', '.tier.pileup', (e, d) => {
      // See http://stackoverflow.com/q/5802467/388951
      var t = $(e.currentTarget);
      if (d > 0 && t.scrollTop() === 0) {
        e.preventDefault();
      } else {
        if (d < 0 && (t.scrollTop() == t.get(0).scrollHeight - t.innerHeight())) {
          e.preventDefault();
        }
      }
    });

    // This uses a capture-phase event listener so that it gets informed of ESC
    // key presses before BioDalliance, which will capture them. We only want
    // to bypass the usual event bubbling system for ESC, not for arrow keys.
    window.addEventListener('keydown', (e) => {
      if (!this.props.selectedRecord) return;
      var isDallianceActive = $(document.activeElement).is('.dalliance');

      if (e.which == 27 /* esc */) {
        e.preventDefault();
        this.props.handleClose();
      }
      
      if (isDallianceActive) return;
      if (e.which == 37 /* left arrow */) {
        this.handleLeft(e);
      } else if (e.which == 39 /* right arrow */) {
        this.handleRight(e);
      }
    }, true /* capture */);
  },
  componentDidUpdate: function() {
    this.update();
  },
  componentWillUnmount: function() {
    $(this.props.inspector.getDOMNode()).off('mousewheel.biodalliance');
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


module.exports = BioDalliance;
