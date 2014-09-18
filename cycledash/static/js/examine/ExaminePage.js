/** @jsx React.DOM */
"use strict";

var _ = require('underscore'),
    d3 = require('d3'),
    React = require('react'),
    idiogrammatik = require('./idiogrammatik'),
    vcf = require('./vcf'),
    AttributeCharts = require('./AttributeCharts'),
    VCFTable = require('./VCFTable'),
    Widgets = require('./Widgets');


window.renderExaminePage = function(el, vcfPath, truthVcfPath) {
  React.renderComponent(<ExaminePage vcfPath={vcfPath} truthVcfPath={truthVcfPath} />, el);
}


// The Root element of the /examine page
var ExaminePage = React.createClass({
   propTypes: {
     vcfPath: React.PropTypes.string.isRequired,
     truthVcfPath: React.PropTypes.string.isRequired
   },
   getInitialState: function() {
     return {chartAttributes: [],
             filters: {},
             position: {start: 0,
                        end: null,  // 'null' for end means "the end."
                        chromosome: "all"}};
   },
   getDefaultProps: function() {
     return {records: [],
             truthRecords: [],
             karyogram: initializeKaryogram(),
             chromosomes: [],
             attrs: []};
   },
   componentDidMount: function() {
     d3.xhr('/vcf' + this.props.vcfPath, function(err, response) {
       var records = vcf()
                        .parseChrom(function(chr){ return 'chr' + chr; })
                        .data(response.responseText)
                        .data(),
           attrs = _.keys(records[0].INFO),
           chromosomes = chromosomesFrom(records);

       d3.xhr('/vcf' + this.props.truthVcfPath, function(err, response) {
         var truthRecords = vcf()
                              .parseChrom(function(chr){ return 'chr' + chr; })
                              .data(response.responseText)
                              .data();

         this.setProps({records: records, chromosomes: chromosomes,
                        attrs: attrs, truthRecords: truthRecords});
       }.bind(this))
     }.bind(this));
   },
   handleRangeChange: function(start, end) {
     this.setState({position: {start: start, end: end, chromosome: "all"}});
   },
   handleRelativeRangeChange: function(start, end) {
     this.setState({position: {start: start, end: end,
                               chromosome: this.state.position.chromosome}});
   },
   handleFilterUpdate: function(filters) {
     this.setState({filters: filters});
   },
   handleChartChange: function(chartAttribute) {
     this.setState({charts: this.togglePresence(this.state.chartAttributes, chartAttribute)});
   },
   handleChromosomeChange: function(chromosome) {
     var start, end;
     if (chromosome === 'all') {
       start = 0;
       end = null;
     } else {
       var chr = chromosome;
       start = this.props.karyogram.positionFromRelative(chr, 0).absoluteBp;
       end = this.props.karyogram.positionFromRelative(chr, null).absoluteBp;
     }
     this.setState({position: {start: start, end: end, chromosome: chromosome}});
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
   recordWithinRange: function(record) {
     var start = this.state.position.start,
         end = this.state.position.end;

     try {
       var pos = this.props.karyogram.positionFromRelative(record.CHROM, record.POS).absoluteBp;
     } catch (e) {
       console.warn('Ignoring: ', record.__KEY__);
       return false;
     }
     return pos >= start && (!end || pos <= end);
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
       return this.recordWithinRange(record) && (skipFilters || this.recordPassesInfoFilters(record));
     }.bind(this));
   },
   render: function() {
     var filteredRecords = this.filterRecords(this.props.records);
     var filteredTruthRecords = this.filterRecords(this.props.truthRecords, true);
     return (
       <div className="examinePage">
         <h1>Examining: <small>{this.props.vcfPath}</small></h1>
         <Widgets.PrecisionRecallTable records={filteredRecords} truthRecords={filteredTruthRecords} />
         <AttributeCharts records={filteredRecords}
                          chartAttributes={this.state.chartAttributes} />
         <Widgets.Karyogram start={this.state.position.start}
                    end={this.state.position.end}
                    karyogram={this.props.karyogram}
                    handleRangeChange={this.handleRangeChange} />
         <VCFTable records={filteredRecords} position={this.state.position}
                   attrs={this.props.attrs}
                   handleChartChange={this.handleChartChange}
                   handleFilterUpdate={this.handleFilterUpdate}
                   handleChromosomeChange={this.handleChromosomeChange}
                   handleRelativeRangeChange={this.handleRelativeRangeChange}
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
  idiogrammatik.__cytoband_url__ = '/static/js/examine/cytoband.tsv'
  var karyogram = idiogrammatik()
        .width(1400)
        .highlightHeight(59);

  return karyogram;
}
