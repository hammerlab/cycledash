/** @jsx React.DOM */
"use strict";

var _ = require('underscore'),
    React = require('react'),
    idiogrammatik = require('idiogrammatik.js'),

    AttributeCharts = require('./AttributeCharts'),
    BioDalliance = require('./BioDalliance'),
    StatsSummary = require('./StatsSummary'),
    VCFTable = require('./VCFTable'),
    Karyogram = require('./Karyogram'),
    LoadingStatus = require('./LoadingStatus');


// The root component of the page.
var ExaminePage = React.createClass({
  propTypes: {
    recordStore: React.PropTypes.object.isRequired,
    recordActions: React.PropTypes.object.isRequired,
    normalBamPath:  React.PropTypes.string,
    tumorBamPath:  React.PropTypes.string,
    igvHttpfsUrl: React.PropTypes.string.isRequired
  },
  getInitialState: function() {
    return this.props.recordStore.getState();
  },
  componentDidMount: function() {
    this.props.recordStore.onChange(() => {
      this.setState(this.props.recordStore.getState());
    });
  },
  handleRangeChange: function({contig, start, end}) {
    this.props.recordActions.updateRecordRange({contig, start, end});
  },
  handleContigChange: function(contig) {
    var start = null, end = null;
    this.props.recordActions.updateRecordRange({contig, start, end});
  },
  handleFilterUpdate: function({columnName, filterValue, type}) {
    this.props.recordActions.updateFilters({columnName, filterValue, type});
  },
  handleSortByChange: function({columnName, order}) {
    this.props.recordActions.updateSorter({columnName, order});
  },
  handleRequestPage: function() {
    this.props.recordActions.requestPage();
  },
  handleChartChange: function({columnName, info, name}) {
    this.props.recordActions.selectColumn({columnName, info, name});
  },
  handleVariantTypeChange: function(vtype) {
    this.props.recordActions.updateVariantType(vtype);
  },
  handleSelectRecord: function(record) {
    this.props.recordActions.selectRecord(record);
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
    var records = this.state.records,
        idx = records.indexOf(this.state.selectedRecord);
    if (idx == -1) return;
    var newIdx = idx + delta;
    if (newIdx >= 0 && newIdx <= records.length) {
      this.props.recordActions.selectRecord(records[newIdx]);
    }
  },
  render: function() {
    var state = this.state, props = this.props;
    return (
      <div className="examine-page">
        <StatsSummary hasLoaded={state.hasLoaded}
                      variantType={state.variantType}
                      handleVariantTypeChange={this.handleVariantTypeChange}
                      stats={state.stats} />
        <div className="top-material">
          <h1>Examining: <small>{props.vcfPath}</small></h1>
          <LoadingStatus hasLoaded={state.hasLoaded}
                         error={state.loadError}
                         files={[props.vcfPath, props.truthVcfPath]} />
        </div>
        <BioDalliance vcfPath={props.vcfPath}
                      truthVcfPath={props.truthVcfPath}
                      normalBamPath={props.normalBamPath}
                      tumorBamPath={props.tumorBamPath}
                      igvHttpfsUrl={props.igvHttpfsUrl}
                      selectedRecord={state.selectedRecord}
                      handlePreviousRecord={this.handlePreviousRecord}
                      handleNextRecord={this.handleNextRecord}
                      handleClose={() => this.handleSelectRecord(null)} />
        <VCFTable ref="vcfTable"
                  hasLoaded={state.hasLoaded}
                  records={state.records}
                  range={state.range}
                  columns={state.columns}
                  selectedColumns={state.selectedColumns}
                  selectedRecord={state.selectedRecord}
                  contigs={state.contigs}
                  sortBys={state.sortBys}
                  handleSortByChange={this.handleSortByChange}
                  handleChartChange={this.handleChartChange}
                  handleFilterUpdate={this.handleFilterUpdate}
                  handleContigChange={this.handleContigChange}
                  handleRequestPage={this.handleRequestPage}
                  handleRangeChange={this.handleRangeChange}
                  handleSelectRecord={this.handleSelectRecord} />
      </div>
     );
   }
});

module.exports = ExaminePage;

