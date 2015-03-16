"use strict";

var React = require('react'),
    BioDalliance = require('./BioDalliance'),
    StatsSummary = require('./StatsSummary'),
    VCFTable = require('./VCFTable'),
    QueryBox = require('./QueryBox'),
    Downloads = require('./Downloads'),
    ExamineInformation = require('./ExamineInformation'),
    VCFValidation = require('./VCFValidation');


// The root component of the page.
var ExaminePage = React.createClass({
  propTypes: {
    recordStore: React.PropTypes.object.isRequired,
    recordActions: React.PropTypes.object.isRequired,
    igvHttpfsUrl: React.PropTypes.string.isRequired,
    vcf: React.PropTypes.object,
    // a list of VCFs to possibly compare against:
    comparableVcfs: React.PropTypes.arrayOf(React.PropTypes.object)
  },
  getInitialState: function() {
    return this.props.recordStore.getState();
  },
  componentDidMount: function() {
    this.props.recordStore.onChange(() => {
      this.setState(this.props.recordStore.getState());
    });
  },
  handleSortByChange: function(sortBys) {
    this.props.recordActions.updateSortBys(sortBys);
  },
  handleRequestPage: function() {
    this.props.recordActions.requestPage();
  },
  handleSelectRecord: function(record) {
    this.props.recordActions.selectRecord(record);
  },
  handleOpenViewer: function(record) {
    this.props.recordActions.setViewerOpen(true);
    this.refs.vcfTable.scrollRecordToTop(record);
  },
  handleCloseViewer: function() {
    this.props.recordActions.setViewerOpen(false);
  },
  handleNextRecord: function() {
    this.moveSelectionInDirection(+1);
  },
  handlePreviousRecord: function() {
    this.moveSelectionInDirection(-1);
  },
  handleComparisonVcfChange: function(vcfId) {
    this.props.recordActions.selectComparisonVcf(vcfId);
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
  handleSetComment: function(comment) {
    this.props.recordActions.setComment(comment);
  },
  handleDeleteComment: function(comment) {
    this.props.recordActions.deleteComment(comment);
  },
  render: function() {
    var state = this.state, props = this.props;
    return (
      <div className="examine-page">
        <StatsSummary hasLoaded={state.hasLoaded}
                      stats={state.stats} />
        <ExamineInformation run={props.vcf}/>
        {props.comparableVcfs ?
         <VCFValidation vcfs={props.comparableVcfs}
                        selectedVcfId={state.selectedVcfId}
                        handleComparisonVcfChange={this.handleComparisonVcfChange} /> :
          null}
        <QueryBox columns={state.columns}
                  hasPendingRequest={state.hasPendingRequest}
                  loadError={state.loadError}
                  query={state.query}
                  handleQueryChange={this.handleQueryChange} />
        <Downloads query={state.query} run_id={props.vcf.id} />
        <VCFTable ref="vcfTable"
                  hasLoaded={state.hasLoaded}
                  records={state.records}
                  range={state.range}
                  columns={state.columns}
                  selectedRecord={state.selectedRecord}
                  contigs={state.contigs}
                  sortBys={state.sortBys}
                  igvLink={state.igvLink}
                  handleSortByChange={this.handleSortByChange}
                  handleRequestPage={this.handleRequestPage}
                  handleSelectRecord={this.handleSelectRecord}
                  handleOpenViewer={this.handleOpenViewer}
                  handleSetComment={this.handleSetComment}
                  handleDeleteComment={this.handleDeleteComment} />
        <BioDalliance vcfPath={props.vcf.uri}
                      normalBamPath={props.vcf.normal_bam_uri}
                      tumorBamPath={props.vcf.tumor_bam_uri}
                      igvHttpfsUrl={props.igvHttpfsUrl}
                      selectedRecord={state.selectedRecord}
                      isOpen={state.isViewerOpen}
                      handlePreviousRecord={this.handlePreviousRecord}
                      handleNextRecord={this.handleNextRecord}
                      handleClose={this.handleCloseViewer} />
      </div>
     );
   }
});

module.exports = ExaminePage;
