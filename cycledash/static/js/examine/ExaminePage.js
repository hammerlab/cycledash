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
    getIn = require('./utils').getIn;


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
    truthVcfPath: React.PropTypes.string.isRequired,
    normalBamPath:  React.PropTypes.string,
    tumorBamPath:  React.PropTypes.string,
    chromosomes: React.PropTypes.arrayOf(React.PropTypes.string).isRequired,
    columns: React.PropTypes.object.isRequired,
    records: React.PropTypes.arrayOf(React.PropTypes.object).isRequired,
    truthRecords: React.PropTypes.arrayOf(React.PropTypes.object).isRequired,
    igvHttpfsUrl: React.PropTypes.string.isRequired
  },
  getInitialState: function() {
    return {selectedColumns: [],
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

    $.when(deferredVcf(this.props.vcfPath), deferredVcf(this.props.truthVcfPath))
      .done((vcfData, truthVcfData) => {
        var records = vcfData.records,
            header = vcfData.header,
            columns = this.deriveColumns(header, records),
            chromosomes = _.uniq(records.map((r) => r.CHROM));
        chromosomes.sort(vcfTools.chromosomeComparator);

        window.h = header;
        window.c = columns;

        this.setProps({
          hasLoaded: true,
          records: records,
          truthRecords: truthVcfData.records,
          chromosomes: chromosomes,
          columns: columns,
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
  handleChartChange: function(column) {
    var selected = this.state.selectedColumns,
        colIdx = null;
    for (var i = 0; i < selected.length; i++) {
      var selectedColumn = selected[i],
          pairedPath = _.zip(selectedColumn.path, column.path),
          isSameColumn = _.every(pairedPath, function(pair) {
            return pair[0] == pair[1];
          });
      if (isSameColumn) colIdx = i;
    }
    if (colIdx !== null) {
      selected.splice(colIdx, 1);
    } else {
      selected.push(column);
    }
    this.setState({selectedColumns: selected});
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
    // NB: rather than pulling this from the header's INFO and FORMAT fields,
    //     we pull the columns from the records themselves, as sometimes the
    //     header contains many more FORMAT and INFO fields than are actually
    //     used. This would waste a ton of horizontal space in the VCF table.
    var columns = _.reduce(header.sampleNames, (columns, name) => {
      columns[name] = [];
      return columns;
    }, {'INFO': []});
    _.each(records, function(record) {
      _.each(_.keys(columns), function(topLvlAttr) {
        var subCols = record[topLvlAttr];
        for (var attr in subCols) {
          var info = topLvlAttr == 'INFO' ? _.findWhere(header.INFO, {ID: attr})
                                          : _.findWhere(header.FORMAT, {ID: attr});
          columns[topLvlAttr][attr] = {path: [topLvlAttr, attr], info: info, name: attr};
        }
      });
    });
    return columns;
  },
  toggleChartPresence: function(selectedColumns, column) {
    // Adds col to selectedColumns if it's not in list, else remove it.
    function samePath(selected, newCol) {
      var selPath = selected.path,
      newPath = newCol.path,
      same = true;
      for (var i = 0; i < selPath.length; i++) {
        if (selPath[i] != newPath[i]) same = false;
      }
      return same;
    }

    var found = false;
    for (var i = 0; i < selectedColumns.length; i++) {
      if (samePath(selected, column)) {
        selectedColumns.splice(i, 1);
        found = true;
      }
    }
    if (!found) selectedColumns.push(column);
    return selectedColumns;
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
    var [sortByPath, direction] = this.state.sortBy;
    if (sortByPath === null) {
      filteredRecords.sort(vcfTools.recordComparator(direction));
    } else {
      filteredRecords.sort((a, b) => {
        var aVal = getIn(a, sortByPath),
            bVal = getIn(b, sortByPath);
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
                        unfilteredRecords={this.props.records}
                        truthRecords={filteredTruthRecords} />
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
