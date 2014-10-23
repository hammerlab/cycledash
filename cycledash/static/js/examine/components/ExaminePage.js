/** @jsx React.DOM */
"use strict";

var _ = require('underscore'),
    React = require('react'),
    idiogrammatik = require('idiogrammatik.js'),
    types = require('./types'),

    AttributeCharts = require('./AttributeCharts'),
    BioDalliance = require('./BioDalliance'),
    StatsSummary = require('./StatsSummary'),
    VCFTable = require('./VCFTable'),
    Widgets = require('./Widgets');


// The root component of the page.
var ExaminePage = React.createClass({
  propTypes: {
    recordStore: React.PropTypes.object.isRequired,
    recordActions: React.PropTypes.object.isRequired,
    vcfPath: React.PropTypes.string.isRequired,
    truthVcfPath: React.PropTypes.string,
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
  handleRangeChange: function({chromosome, start, end}) {
    this.props.recordActions.updateRecordRange({chromosome, start, end});
  },
  handleFilterUpdate: function({path, filterValue}) {
    this.props.recordActions.updateFilters({path, filterValue});
  },
  handleChartChange: function({path, info, name}) {
    this.props.recordActions.selectColumn({path, info, name});
  },
  handleSortByChange: function({path, order}) {
    this.props.recordActions.updateSorter({path, order});
  },
  handleChromosomeChange: function(chromosome) {
    this.props.recordActions.updateRecordRange({chromosome, start: null, end: null});
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
    var state = this.state, props = this.props;  // shorthand
    return (
        <div className="examine-page">
          <div className="top-material">
            <StatsSummary hasLoaded={state.hasLoadedVcfs}
                          variantType={state.variantType}
                          handleVariantTypeChange={this.handleVariantTypeChange}
                          records={state.records}
                          truthRecords={state.truthRecords}
                          totalRecords={state.totalRecords} />
            <h1>Examining: <small>{props.vcfPath}</small></h1>
            <Widgets.Loading hasLoaded={state.hasLoadedVcfs}
                             error={state.loadError}
                             files={[props.vcfPath, props.truthVcfPath]} />
            <AttributeCharts records={state.records}
                             selectedColumns={state.selectedColumns} />
          </div>
          <Widgets.Karyogram position={state.range}
                             handleRangeChange={this.handleRangeChange} />
          <VCFTable ref="vcfTable"
                    hasLoaded={state.hasLoadedVcfs}
                    records={state.records}
                    position={state.range}
                    header={state.header}
                    columns={state.columns}
                    selectedColumns={state.selectedColumns}
                    selectedRecord={state.selectedRecord}
                    chromosomes={state.chromosomes}
                    sortBy={state.sortBy}
                    handleSortByChange={this.handleSortByChange}
                    handleChartChange={this.handleChartChange}
                    handleFilterUpdate={this.handleFilterUpdate}
                    handleChromosomeChange={this.handleChromosomeChange}
                    handleRangeChange={this.handleRangeChange}
                    handleSelectRecord={this.handleSelectRecord} />
          <BioDalliance vcfPath={props.vcfPath}
                        vcfBytes={props.recordStore.getVcfBytes()}
                        truthVcfPath={props.truthVcfPath}
                        truthVcfBytes={props.recordStore.getTruthVcfBytes()}
                        normalBamPath={props.normalBamPath}
                        tumorBamPath={props.tumorBamPath}
                        igvHttpfsUrl={props.igvHttpfsUrl}
                        selectedRecord={state.selectedRecord}
                        handlePreviousRecord={this.handlePreviousRecord}
                        handleNextRecord={this.handleNextRecord}
                        handleClose={() => this.handleSelectRecord(null)} />
        </div>
     );
   }
});

module.exports = ExaminePage;
