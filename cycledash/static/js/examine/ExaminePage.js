/** @jsx React.DOM */
"use strict";

var _ = require('underscore'),
    d3 = require('d3'),
    React = require('react'),
    idiogrammatik = require('idiogrammatik.js'),
    vcf = require('vcf.js'),
    GSTAINED_CHROMOSOMES = require('../../data/gstained-chromosomes'),
    AttributeCharts = require('./AttributeCharts'),
    VCFTable = require('./VCFTable'),
    Widgets = require('./Widgets');
require('./vcf.tools')(vcf);


window.renderExaminePage = function(el, vcfPath, truthVcfPath) {
  React.renderComponent(<ExaminePage vcfPath={vcfPath}
                                     truthVcfPath={truthVcfPath}
                                     karyogramData={GSTAINED_CHROMOSOMES} />, el);
}


// The Root element of the /examine page
var ExaminePage = React.createClass({
   propTypes: {
     hasLoaded: React.PropTypes.bool.isRequired,
     karyogramData: React.PropTypes.arrayOf(React.PropTypes.object).isRequired,
     vcfPath: React.PropTypes.string.isRequired,
     truthVcfPath: React.PropTypes.string.isRequired,
     chromosomes: React.PropTypes.arrayOf(React.PropTypes.string).isRequired,
     attrs: React.PropTypes.arrayOf(React.PropTypes.string).isRequired,
     records: React.PropTypes.arrayOf(React.PropTypes.object).isRequired,
     truthRecords: React.PropTypes.arrayOf(React.PropTypes.object).isRequired
   },
   getInitialState: function() {
     return {chartAttributes: [],
             filters: {},
             position: {start: null,
                        end: null,
                        chromosome: idiogrammatik.ALL_CHROMOSOMES}};
   },
   getDefaultProps: function() {
     return {records: [],
             header: {},
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
         .done(function(vcfData, truthVcfData) {
           var records = vcfData.records;
           this.setProps({
             hasLoaded: true,
             records: records,
             truthRecords: truthVcfData.records,
             chromosomes: chromosomesFrom(records),
             attrs: _.keys(records[0].INFO),
             header: vcfData.header
           });
         }.bind(this));
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
   handleChromosomeChange: function(chromosome) {
     if (chromosome === 'all') {
       chromosome = this.props.karyogram.ALL_CHROMOSOMES;
     }
     this.setState({position: {start: null, end: null, chromosome: chromosome}});
   },
   togglePresence: function(list, el) {
     var idx;
     if ((idx = list.indexOf(el)) > -1) {
       list.splice(idx, 1);
     } else {
       list.push(el);
     }
     return list;
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
   recordPassesInfoFilters: function(record) {
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
   filterRecords: function(records, skipFilters) {
     return records.filter(function(record) {
       return this.isRecordWithinRange(record) &&
         (skipFilters || this.recordPassesInfoFilters(record));
     }.bind(this));
   },
   render: function() {
     var filteredRecords = this.filterRecords(this.props.records);
     var filteredTruthRecords = this.filterRecords(this.props.truthRecords, true);

     // We need to sort the records on their keys so that VCF tools'
     // {true,false}Positives works properly.
     filteredRecords.sort(vcf.tools.recordComparator);
     filteredTruthRecords.sort(vcf.tools.recordComparator);

     return (
       <div className="examine-page">
         <h1>Examining: <small>{this.props.vcfPath}</small></h1>
         <Widgets.Loading hasLoaded={this.props.hasLoaded}
                          files={[this.props.vcfPath, this.props.truthVcfPath]} />
         <Widgets.GlobalStatsTable hasLoaded={this.props.hasLoaded}
                                   records={filteredRecords}
                                   unfilteredRecords={this.props.records}
                                   truthRecords={filteredTruthRecords} />
         <AttributeCharts records={filteredRecords}
                          chartAttributes={this.state.chartAttributes} />
         <Widgets.Karyogram data={this.props.karyogramData}
                            karyogram={this.props.karyogram}
                            position={this.state.position}
                            handleRangeChange={this.handleRangeChange} />
         <VCFTable hasLoaded={this.props.hasLoaded}
                   records={filteredRecords}
                   position={this.state.position}
                   header={this.props.header}
                   attrs={this.props.attrs}
                   selectedAttrs={this.state.chartAttributes}
                   handleChartChange={this.handleChartChange}
                   handleFilterUpdate={this.handleFilterUpdate}
                   handleChromosomeChange={this.handleChromosomeChange}
                   handleRangeChange={this.handleRangeChange}
                   chromosomes={this.props.chromosomes}
                   karyogram={this.props.karyogram} />
       </div>
     );
   }
});

function chromosomesFrom(records) {
  return _.reduce(records, function(acc, val, key) {
     var chromosome = val.CHROM;
     if (acc.mem[chromosome] === undefined) {
       acc.mem[chromosome] = true;
       acc.chromosomes.push(chromosome);
     }
     return acc;
   }, {chromosomes: [], mem: {}}).chromosomes;
}

function initializeKaryogram() {
  return idiogrammatik()
           .width(1400)
           .highlightHeight(59);
}
