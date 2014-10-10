/** @jsx React.DOM */
"use strict";

var _ = require('underscore'),
    d3 = require('d3/d3'),
    React = require('react'),
    idiogrammatik = require('idiogrammatik.js'),
    vcf = require('vcf.js'),
    GSTAINED_CHROMOSOMES = require('../../data/gstained-chromosomes'),
    AttributeCharts = require('./AttributeCharts'),
    BioDalliance = require('./BioDalliance'),
    DataStore = require('./DataStore'),
    StatsSummary = require('./StatsSummary'),
    VCFTable = require('./VCFTable'),
    Widgets = require('./Widgets'),
    vcfTools = require('./vcf.tools'),
    $ = require('jquery'),
    utils = require('./utils'),
    types = require('./types');


window.renderExaminePage = function(el, vcfPath, truthVcfPath,
                                    normalBamPath, tumorBamPath, igvHttpfsUrl) {
  React.renderComponent(<ExaminePage vcfPath={vcfPath}
                                     truthVcfPath={truthVcfPath}
                                     normalBamPath={normalBamPath}
                                     tumorBamPath={tumorBamPath}
                                     igvHttpfsUrl={igvHttpfsUrl}
                                     karyogramData={GSTAINED_CHROMOSOMES} />, el);
};

// The Root element of the /examine page
var ExaminePage = React.createClass({
  propTypes: {
    hasLoaded: React.PropTypes.bool.isRequired,
    karyogramData: React.PropTypes.arrayOf(React.PropTypes.object).isRequired,
    vcfPath: React.PropTypes.string.isRequired,
    truthVcfPath: React.PropTypes.string,
    normalBamPath:  React.PropTypes.string,
    tumorBamPath:  React.PropTypes.string,
    chromosomes: React.PropTypes.arrayOf(React.PropTypes.string).isRequired,
    columns: React.PropTypes.object.isRequired, // c.f. vcfTools.deriveColumns
    records: React.PropTypes.arrayOf(React.PropTypes.object).isRequired,
    truthRecords: React.PropTypes.arrayOf(React.PropTypes.object),
    igvHttpfsUrl: React.PropTypes.string.isRequired
  },
  getInitialState: function() {
    return {selectedColumns: [],
            sortBy: [null, 'desc'], // null sorts by default = CHR/POS
            variantType: 'All',
            filters: [], // list of objects of shape: {path: ['INFO', 'DP'], filter: '>20'}
            selectedRecord: null,
            position: {start: null,
                       end: null,
                       chromosome: idiogrammatik.ALL_CHROMOSOMES}};
  },
  getDefaultProps: function() {
    return {header: {},
            records: [],
            truthRecords: [],
            karyogram: initializeKaryogram(),
            chromosomes: [],
            columns: {},
            hasLoaded: false};
  },
  componentDidMount: function() {
    var vcfParser = vcf.parser();
    function deferredVcf(vcfPath) {
      return $.get('/vcf' + vcfPath).then(function(data) {
        return vcfParser(data);
      });
    };
    var deferreds = [deferredVcf(this.props.vcfPath)];
    if (this.props.truthVcfPath) deferreds.push(deferredVcf(this.props.truthVcfPath));
    $.when.apply(this, deferreds)
      .done((vcfData, truthVcfData) => {
        var records = vcfData.records,
            columns = vcfTools.deriveColumns(vcfData),
            chromosomes = _.uniq(records.map((r) => r.CHROM));
        chromosomes.sort(vcfTools.chromosomeComparator);

        var store = new DataStore(vcfData, truthVcfData);

        this.setProps({
          hasLoaded: true,
          store: store,
          records: records,
          chromosomes: chromosomes,
          columns: columns,
          header: vcfData.header
        });
      });
  },
  handleRangeChange: function(chromosome, start, end) {
    this.setState({position: {start: start, end: end, chromosome: chromosome}});
  },
  handleFilterUpdate: function(filter) {
    var filters = this.state.filters,
        found = false;
    for (var i = 0; i < filters.length; i++) {
      var listedFilter = filters[i],
          isSameItem = _.isEqual(listedFilter.path, filter.path);
      if (isSameItem) {
        listedFilter.filter = filter.filter;
        found = true;
      }
    }
    if (!found) filters.push(filter);
    this.setState({filters: filters});
  },
  handleChartChange: function(column) {
    var selectedCharts = this.togglePresence(this.state.selectedColumns, column, _.isEqual);
    this.setState({selectedColumns: selectedCharts});
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
    var storeState = this.getStoreState();
    var filteredRecords = this.props.store.getFilteredSortedRecords(storeState);
    var idx = filteredRecords.indexOf(this.state.selectedRecord);
    if (idx == -1) return;
    var newIdx = idx + delta;
    if (newIdx >= 0 && newIdx <= filteredRecords.length) {
      this.setState({selectedRecord: filteredRecords[newIdx]});
    }
  },
  togglePresence: function(list, item, pred) {
    // Adds item to list if pred doesn't return true for any item in list, else
    // remove the item in list that pred is true for. Returns the modified list.
    var colIdx = null;
    for (var i = 0; i < list.length; i++) {
      var listItem = list[i],
          isSameItem = pred(listItem, item);
      if (isSameItem) colIdx = i;
    }
    if (colIdx !== null) {
      list.splice(colIdx, 1);
    } else {
      list.push(item);
    }
    return list;
  },
  getStoreState: function() {
    return {
      variantType: this.state.variantType,
      filters: this.state.filters,
      position: this.state.position,
      sortBy: this.state.sortBy
    };
  },
  render: function() {
    var storeState = this.getStoreState();
    var store = this.props.store;
    var filteredRecords = store ? store.getFilteredSortedRecords(storeState) : [],
        filteredTruthRecords = store ? store.getFilteredTruthRecords(storeState) : [];

    return (
        <div className="examine-page">
          <h1>Examining: <small>{this.props.vcfPath}</small></h1>
          <Widgets.Loading hasLoaded={this.props.hasLoaded}
                           files={[this.props.vcfPath, this.props.truthVcfPath]} />
          <StatsSummary hasLoaded={this.props.hasLoaded}
                        variantType={this.state.variantType}
                        handleVariantTypeChange={this.handleVariantTypeChange}
                        records={filteredRecords}
                        truthRecords={filteredTruthRecords}
                        unfilteredRecords={this.props.records} />
          <AttributeCharts records={filteredRecords}
                           selectedColumns={this.state.selectedColumns} />
          <Widgets.Karyogram data={this.props.karyogramData}
                             karyogram={this.props.karyogram}
                             position={this.state.position}
                             handleRangeChange={this.handleRangeChange} />
          <VCFTable ref="vcfTable"
                    hasLoaded={this.props.hasLoaded}
                    records={filteredRecords}
                    position={this.state.position}
                    header={this.props.header}
                    columns={this.props.columns}
                    selectedColumns={this.state.selectedColumns}
                    selectedRecord={this.state.selectedRecord}
                    chromosomes={this.props.chromosomes}
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

module.exports = ExaminePage;
