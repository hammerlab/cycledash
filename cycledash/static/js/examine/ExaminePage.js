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
    columns: React.PropTypes.object.isRequired, // c.f. method deriveColumns
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
            header = vcfData.header,
            columns = this.deriveColumns(header, records),
            chromosomes = _.uniq(records.map((r) => r.CHROM));
        chromosomes.sort(vcfTools.chromosomeComparator);

        this.setProps({
          hasLoaded: true,
          records: records,
          truthRecords: truthVcfData ? truthVcfData.records : null,
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
          isSameItem = utils.everyOver(listedFilter.path, filter.path, utils.equals);
      if (isSameItem) {
        listedFilter.filter = filter.filter;
        found = true;
      }
    }
    if(!found) filters.push(filter);
    this.setState({filters: filters});
  },
  handleChartChange: function(column) {
    var selectedCharts = this.togglePresence(this.state.selectedColumns, column, function(a, b) {
      return utils.everyOver(a.path, b.path, utils.equals);
    });
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
    var filteredRecords = this.getFilteredSortedRecords();
    var idx = filteredRecords.indexOf(this.state.selectedRecord);
    if (idx == -1) return;
    var newIdx = idx + delta;
    if (newIdx >= 0 && newIdx <= filteredRecords.length) {
      this.setState({selectedRecord: filteredRecords[newIdx]});
    }
  },
  deriveColumns: function(header, records) {
    // Columns to be displayed: {INFO: {attr1: {path: ['INFO', 'attr1'],
    //                                          name: 'attr1',
    //                                          info: <attr spec from header>} },
    //                           sampleName1: {attrA:  ..}, ..}
    //
    // NB: Rather than pulling this from the header's INFO and FORMAT fields,
    //     we pull the columns from the records themselves, as sometimes the
    //     header contains many more FORMAT and INFO fields than are actually
    //     used. This would waste a ton of horizontal space in the VCF table.
    //
    //     It's worth noting, too, that in current JS implementations object
    //     key/vals stay ordered as inserted, unless a key is a number type.
    //     This is nice, becauce it keeps the columns displayed in the table in
    //     order.
    var columns = _.reduce(header.sampleNames, (columns, name) => {
      columns[name] = [];
      return columns;
    }, {'INFO': []});
    _.each(records, function(record) {
      _.each(_.keys(columns), function(topLevelAttr) {
        var subCols = record[topLevelAttr];
        for (var attr in subCols) {
          var info = topLevelAttr == 'INFO' ? _.findWhere(header.INFO, {ID: attr})
                                            : _.findWhere(header.FORMAT, {ID: attr});
          columns[topLevelAttr][attr] = {path: [topLevelAttr, attr], info: info, name: attr};
        }
      });
    });
    // If there are no minor columns in a major, remove the major.
    var emptyMajors = [];
    _.each(columns,  function(minors, majorName) {
      if (_.keys(minors).length === 0) emptyMajors.push(majorName);
    });
    _.each(emptyMajors, function(majorName) {
      delete columns[majorName];
    });
    return columns;
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
    return _.reduce(this.state.filters, function(passes, filter) {
      var filterVal = filter.filter,
          valPath = filter.path,
          val = valPath ? utils.getIn(record, valPath) : null;
      if (!passes) return false;  // If one fails, they all fail.
      if (filterVal.length === 0) return true;

      if (_.contains(['<', '>'], filterVal[0])) {  // then do a numeric test
        val = Number(val);
        if (filterVal[0] === '>') {
          return val > Number(filterVal.slice(1));
        } else {
          return val < Number(filterVal.slice(1));
        }
      } else {  // treat it like a regexp, then...
        var re = new RegExp(filterVal);
        if (valPath[0] === types.REF_ALT_PATH[0]) {
          return re.test(record.REF + "/" + record.ALT);
        } else { // this is a regular non-numeric column
          return re.test(String(val));
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
    var [sortByPath, direction] = this.state.sortBy;
    if (sortByPath === null) {
      filteredRecords.sort(vcfTools.recordComparator(direction));
    } else {
      filteredRecords.sort((a, b) => {
        var aVal = utils.getIn(a, sortByPath),
            bVal = utils.getIn(b, sortByPath);
        if (direction === 'desc') {
          return aVal - bVal
        } else {
          return bVal - aVal
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
