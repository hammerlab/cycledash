/** @jsx React.DOM */
"use strict";

var _ = require('underscore'),
    d3 = require('d3'),
    React = require('react'),
    idiogrammatik = require('idiogrammatik.js'),
    vcf = require('vcf.js'),
    GSTAINED_CHROMOSOMES = require('../../data/gstained-chromosomes'),
    AttributeCharts = require('./AttributeCharts'),
    BioDalliance = require('./BioDalliance'),
    VCFTable = require('./VCFTable'),
    StatsSummary = require('./StatsSummary'),
    Widgets = require('./Widgets'),
    vcfTools = require('./vcf.tools'),
    $ = require('jquery');


window.renderExaminePage = function(el, vcfPath, truthVcfPath,
                                    normalBamPath, tumorBamPath, igvHttpfsUrl) {
  React.renderComponent(<ExaminePage vcfPath={vcfPath}
                                     truthVcfPath={truthVcfPath}
                                     normalBamPath={normalBamPath}
                                     tumorBamPath={tumorBamPath}
                                     igvHttpfsUrl={igvHttpfsUrl}
                                     karyogramData={GSTAINED_CHROMOSOMES} />, el);
}


// The Root element of the /examine page
var ExaminePage = React.createClass({
  propTypes: {
    hasLoaded: React.PropTypes.bool.isRequired,
    karyogramData: React.PropTypes.arrayOf(React.PropTypes.object).isRequired,
    vcfPath: React.PropTypes.string.isRequired,
    truthVcfPath: React.PropTypes.string.isRequired,
    normalBamPath:  React.PropTypes.string,
    tumorBamPath:  React.PropTypes.string,
    chromosomes: React.PropTypes.arrayOf(React.PropTypes.string).isRequired,
    attrs: React.PropTypes.arrayOf(React.PropTypes.string).isRequired,
    records: React.PropTypes.arrayOf(React.PropTypes.object).isRequired,
    truthRecords: React.PropTypes.arrayOf(React.PropTypes.object).isRequired,
    igvHttpfsUrl: React.PropTypes.string.isRequired
  },
  getInitialState: function() {
    return {chartAttributes: [],
            records: [],
            sortBy: [null, 'desc'], // null sorts by default = CHR/POS
            variantType: 'All',
            filters: {},
            selectedRecord: null,
            position: {start: null,
                       end: null,
                       chromosome: idiogrammatik.ALL_CHROMOSOMES}};
  },
  getDefaultProps: function() {
    return {header: {},
            truthRecords: [],
            karyogram: initializeKaryogram(),
            chromosomes: [],
            attrs: [],
            hasLoaded: false};
  },
  componentDidMount: function() {
    var vcfParser = vcf.parser();
    function deferredVcf(vcfPath) {
      return $.get('/vcf' + vcfPath).then(function(data) {
        return vcfParser(data);
      });
    };

    $.when(deferredVcf(this.props.vcfPath), deferredVcf(this.props.truthVcfPath))
      .done((vcfData, truthVcfData) => {
        var records = vcfData.records,
            chromosomes = _.uniq(records.map((r) => r.CHROM));
        chromosomes.sort(vcfTools.chromosomeComparator);
        this.setProps({
          hasLoaded: true,
          records: records,
          truthRecords: truthVcfData.records,
          chromosomes: chromosomes,
          attrs: _.keys(records[0].INFO),
          header: vcfData.header
        });
      });
  },
  handleRangeChange: function(chromosome, start, end) {
    this.setState({position: {start: start, end: end, chromosome: chromosome}});
  },
  handleFilterUpdate: function(filters) {
    this.setState({filters: filters});
  },
  handleChartChange: function(chartAttribute) {
    this.setState({charts: this.togglePresence(this.state.chartAttributes, chartAttribute)});
  },
  handleSortByChange: function(sortByAttribute, direction) {
    this.setState({sortBy: [sortByAttribute, direction]});
  },
  handleChromosomeChange: function(chromosome) {
    if (chromosome === 'all') chromosome = this.props.karyogram.ALL_CHROMOSOMES;
    this.setState({position: {start: null, end: null, chromosome: chromosome}});
  },
  handleVariantTypeChange: function(variantType) {
    this.setState({variantType: variantType});
  },
  handleSelectRecord: function(record) {
    this.setState({selectedRecord: record});
    this.refs.vcfTable.scrollRecordToTop(record);
  },
  handleNextRecord: function() {
    this.moveSelectionInDirection(+1);
  },
  handlePreviousRecord: function() {
    this.moveSelectionInDirection(-1);
  },
  moveSelectionInDirection: function(delta) {
    if (!this.state.selectedRecord) return;
    var filteredRecords = this.getFilteredSortedRecords();
    var idx = filteredRecords.indexOf(this.state.selectedRecord);
    if (idx == -1) return;
    var newIdx = idx + delta;
    if (newIdx >= 0 && newIdx <= filteredRecords.length) {
      this.setState({selectedRecord: filteredRecords[newIdx]});
    }
  },
  togglePresence: function(list, el) {
    // Adds el to list if it's not in list, else removed it from list.
    var idx;
    if ((idx = list.indexOf(el)) > -1) {
      list.splice(idx, 1);
    } else {
      list.push(el);
    }
    return list;
  },
  isRecordCorrectVariantType: function(record) {
    switch (this.state.variantType) {
      case 'All':
        return true;
      case 'SNV':
        return record.isSnv();
      case 'INDEL':
        return record.isIndel();
      case 'SV':
        return record.isSv();
      default:
        throw "this.state.variantType must be one of All, SNV, SV, INDEL, is '" +
          this.props.variantType + "'";
    }
  },
  isRecordWithinRange: function(record) {
    var {start, end, chromosome} = this.state.position;

    if (chromosome === idiogrammatik.ALL_CHROMOSOMES) {
      return true;
    } else if (record.CHROM !== chromosome) {
      return false;
    } else if (_.isNull(start) && _.isNull(end)) {
      return true;
    } else if (_.isNull(end)) {
      return record.POS >= start;
    } else if (_.isNull(start)) {
      return record.POS <= end;
    } else {
      return record.POS >= start && record.POS <= end;
    }
  },
  doesRecordPassFilters: function(record) {
    return _.reduce(this.state.filters, function(passes, filterVal, filterName) {
      if (!passes) return false;  // If one fails, they all fail.
      if (filterVal.length === 0) return true;

      if (_.contains(['<', '>'], filterVal[0])) {  // then do a numeric test
        var val = Number(record.INFO[filterName]);
        if (filterVal[0] === '>') {
          return val > Number(filterVal.slice(1));
        } else {
          return val < Number(filterVal.slice(1));
        }
      } else {  // treat it like a regexp, then...
        var re = new RegExp(filterVal);
        if (filterName === 'refAlt') {
          return re.test(record.REF + "/" + record.ALT);
        } else {
          return re.test(record.INFO[filterName]);
        }
      }
    }, true);
  },
  filterRecords: function(records /*, predicates */) {
    var predicates = _.rest(_.toArray(arguments), 1)
    return _.filter(records, (record) => {
      return _.every(_.map(predicates, (pred) => pred(record)));
    });
  },
  getFilteredSortedRecords: function() {
    var filteredRecords = this.filterRecords(this.props.records,
                                             this.isRecordWithinRange,
                                             this.doesRecordPassFilters,
                                             this.isRecordCorrectVariantType);
    var [sortByAttr, direction] = this.state.sortBy;
    if (sortByAttr === null) {
      filteredRecords.sort(vcfTools.recordComparator(direction));
    } else {
      filteredRecords.sort((a, b) => {
        if (direction === 'desc') {
          return a.INFO[sortByAttr] - b.INFO[sortByAttr];
        } else {
          return b.INFO[sortByAttr] - a.INFO[sortByAttr];
        }
      });
    }
    return filteredRecords;
  },
  render: function() {
    var filteredRecords = this.getFilteredSortedRecords(),
        filteredTruthRecords = this.filterRecords(this.props.truthRecords,
                                                  this.isRecordWithinRange,
                                                  this.isRecordCorrectVariantType);

    return (
        <div className="examine-page">
          <h1>Examining: <small>{this.props.vcfPath}</small></h1>
          <Widgets.Loading hasLoaded={this.props.hasLoaded}
                           files={[this.props.vcfPath, this.props.truthVcfPath]} />
          <StatsSummary hasLoaded={this.props.hasLoaded}
                        variantType={this.state.variantType}
                        handleVariantTypeChange={this.handleVariantTypeChange}
                        records={filteredRecords}
                        unfilteredRecords={this.props.records}
                        truthRecords={filteredTruthRecords} />
          <AttributeCharts records={filteredRecords}
                           chartAttributes={this.state.chartAttributes} />
          <Widgets.Karyogram data={this.props.karyogramData}
                             karyogram={this.props.karyogram}
                             position={this.state.position}
                             handleRangeChange={this.handleRangeChange} />
          <VCFTable ref="vcfTable"
                    hasLoaded={this.props.hasLoaded}
                    records={filteredRecords}
                    position={this.state.position}
                    header={this.props.header}
                    attrs={this.props.attrs}
                    selectedAttrs={this.state.chartAttributes}
                    selectedRecord={this.state.selectedRecord}
                    chromosomes={this.props.chromosomes}
                    karyogram={this.props.karyogram}
                    sortBy={this.state.sortBy}
                    handleSortByChange={this.handleSortByChange}
                    handleChartChange={this.handleChartChange}
                    handleFilterUpdate={this.handleFilterUpdate}
                    handleChromosomeChange={this.handleChromosomeChange}
                    handleRangeChange={this.handleRangeChange}
                    handleSelectRecord={this.handleSelectRecord} />
          <BioDalliance vcfPath={this.props.vcfPath}
                        truthVcfPath={this.props.truthVcfPath}
                        normalBamPath={this.props.normalBamPath}
                        tumorBamPath={this.props.tumorBamPath}
                        igvHttpfsUrl={this.props.igvHttpfsUrl}
                        selectedRecord={this.state.selectedRecord}
                        handlePreviousRecord={this.handlePreviousRecord}
                        handleNextRecord={this.handleNextRecord}
                        handleClose={() => this.handleSelectRecord(null)} />
        </div>
     );
   }
});

function initializeKaryogram() {
  return idiogrammatik()
           .width(1400)
           .highlightHeight(59);
}
