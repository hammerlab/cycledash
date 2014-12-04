"use strict";

var _ = require('underscore'),
    React = require('react'),
    idiogrammatik = require('idiogrammatik.js'),
    BioDalliance = require('./BioDalliance'),
    StatsSummary = require('./StatsSummary'),
    VCFTable = require('./VCFTable'),
    QueryBox = require('./QueryBox'),
    ExamineInformation = require('./ExamineInformation');


// The root component of the page.
var ExaminePage = React.createClass({
  propTypes: {
    recordStore: React.PropTypes.object.isRequired,
    recordActions: React.PropTypes.object.isRequired,
    run: React.PropTypes.object,
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
  handleSortByChange: function({columnName, order}) {
    this.props.recordActions.updateSortBy({columnName, order});
  },
  handleRequestPage: function() {
    this.props.recordActions.requestPage();
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
  handleQueryChange: function(parsedQuery) {
    this.props.recordActions.setQuery(parsedQuery);
  },
  render: function() {
    var state = this.state, props = this.props;
    return (
      <div className="examine-page">
        <StatsSummary hasLoaded={state.hasLoaded}
                      stats={state.stats} />
        <ExamineInformation run={props.run}/>
        <QueryBox columns={state.columns}
                  hasPendingRequest={state.hasPendingRequest}
                  loadError={state.loadError}
                  query={state.query}
                  handleQueryChange={this.handleQueryChange} />
        <VCFTable ref="vcfTable"
                  hasLoaded={state.hasLoaded}
                  records={state.records}
                  range={state.range}
                  columns={state.columns}
                  selectedRecord={state.selectedRecord}
                  contigs={state.contigs}
                  sortBys={state.sortBys}
                  handleSortByChange={this.handleSortByChange}
                  handleRequestPage={this.handleRequestPage}
                  handleSelectRecord={this.handleSelectRecord} />
        <BioDalliance vcfPath={props.run.uri}
                      normalBamPath={props.run.normal_bam_uri}
                      tumorBamPath={props.run.tumor_bam_uri}
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

