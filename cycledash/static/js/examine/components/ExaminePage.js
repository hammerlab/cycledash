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
    karyogramData: React.PropTypes.arrayOf(React.PropTypes.object).isRequired,
    vcfPath: React.PropTypes.string.isRequired,
    truthVcfPath: React.PropTypes.string,
    normalBamPath:  React.PropTypes.string,
    tumorBamPath:  React.PropTypes.string,
    igvHttpfsUrl: React.PropTypes.string.isRequired
  },
  getInitialState: function() {
    return this.props.recordStore.getState();
  },
  getDefaultProps: function() {
    return {karyogram: initializeKaryogram()};
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
    return (
        <div className="examine-page">
          <h1>Examining: <small>{this.props.vcfPath}</small></h1>
          <StatsSummary hasLoaded={this.state.hasLoadedVcfs}
                        variantType={this.state.variantType}
                        handleVariantTypeChange={this.handleVariantTypeChange}
                        records={this.state.records}
                        truthRecords={this.state.truthRecords}
                        totalRecords={this.state.totalRecords} />
          <Widgets.Loading hasLoaded={this.state.hasLoadedVcfs}
                           files={[this.props.vcfPath, this.props.truthVcfPath]} />
          <AttributeCharts records={this.state.records}
                           selectedColumns={this.state.selectedColumns} />
          <Widgets.Karyogram data={this.props.karyogramData}
                             karyogram={this.props.karyogram}
                             position={this.state.range}
                             handleRangeChange={this.handleRangeChange} />
          <VCFTable ref="vcfTable"
                    hasLoaded={this.state.hasLoadedVcfs}
                    records={this.state.records}
                    position={this.state.range}
                    header={this.state.header}
                    columns={this.state.columns}
                    selectedColumns={this.state.selectedColumns}
                    selectedRecord={this.state.selectedRecord}
                    chromosomes={this.state.chromosomes}
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
