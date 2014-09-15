/** @jsx React.DOM */
var _ = require('underscore'),
    d3 = require('d3'),
    React = require('react');



var VCFTable = React.createClass({
   render: function() {
     return (
       <table>
         <VCFTableHeader attrs={this.props.attrs}
                         handleChartChange={this.props.handleChartChange} />
         <VCFTableFilter chromosomes={this.props.chromosomes}
                         records={this.props.records}
                         handleFilterUpdate={this.props.handleFilterUpdate}
                         handleChromosomeChange={this.props.handleChromosomeChange}
                         chromosome={this.props.position.chromosome}
                         position={this.props.position}
                         handleRelativeRangeChange={this.props.handleRelativeRangeChange}
                         attrs={this.props.attrs}
                         karyogram={this.props.karyogram}/>
         <VCFTableBody records={this.props.records} attrs={this.props.attrs} />
       </table>
     );
   }
});


var VCFTableHeader = React.createClass({
   handleChartToggle: function(e) {
     this.props.handleChartChange(e.target.textContent);
   },
   render: function() {
     var attrs = this.props.attrs.map(function(attr) {
       return <th className="attr" key={attr} onClick={this.handleChartToggle}>{attr}</th>;
     }.bind(this));
     return (
       <thead>
         <tr>
           <th>Chromosome</th>
           <th>Position</th>
           <th>REF / ALT</th>
           {attrs}
         </tr>
       </thead>
     );
   }
});


var VCFTableFilter = React.createClass({
   handleChromosomeChange: function(e) {
     var chromosome = this.refs.chromosome.getDOMNode().value;
     this.props.handleChromosomeChange(chromosome);
   },
   handleRelativeRangeChange: function(e) {
     var start = this.refs.startPos.getDOMNode().value,
         end = this.refs.endPos.getDOMNode().value,
         chromosome = this.props.position.chromosome;
     if (start.length === 0 || Number(start) === NaN || Number(end) === NaN) {
       return;
     } else {
       start = Number(start);
       end.length > 0 && Number(end) != NaN ? end = Number(end) : end = null;
     }

     if (chromosome != 'all') {
       var position = this.props.karyogram.positionFromRelative(chromosome, start);
       start = position.absoluteBp;
       if (end != null) {
         end = this.props.karyogram.positionFromRelative(chromosome, end).absoluteBp;
       } else {
         end = position.chromosome.end;
       }
     }
     this.props.handleRelativeRangeChange(start, end);
   },
   handleFilterUpdate: function(e) {
     var filters = Array.prototype.slice.call(document.querySelectorAll('input.infoFilter'));
     filters = _.object(filters.map(function(f) {
       return [f.name, f.value];
     }));
     this.props.handleFilterUpdate(filters);
   },
   render: function() {
     var start, end,
         kgram = this.props.karyogram;
     if (this.props.position.chromosome != 'all') {
       start = kgram.positionFromAbsoluteBp(this.props.position.start).relativeBp;
       end = kgram.positionFromAbsoluteBp(this.props.position.end).relativeBp;
     } else {
       start = this.props.position.start;
       end = this.props.position.end;
     }

     var chromosomeOptions = this.props.chromosomes.map(function(chromosome) {
       return (
         <option name="chromosome" key={chromosome} value={chromosome}>{chromosome}</option>
       );
     }.bind(this));
     var attrs = this.props.attrs.map(function(attr) {
       return (
         <th key={attr}>
           <input name={attr} className="infoFilter" type="text"
                  onChange={this.handleFilterUpdate}>
           </input>
         </th>
       );
     }.bind(this));
     return (
       <thead>
         <tr>
           <th>
             <select onChange={this.handleChromosomeChange}
                     ref="chromosome" value={this.props.chromosome}>
               <option name="chromosome" key="all" value="all">&lt;all&gt;</option>
               {chromosomeOptions}
             </select>
           </th>
           <th id="position">
             <input name="start" type="text" placeholder="start"
                    ref="startPos" value={start} onChange={this.handleRelativeRangeChange}>
             </input>
             <input name="end" type="text" placeholder="end"
                    ref="endPos" value={end} onChange={this.handleRelativeRangeChange}>
             {this.props.position.end}
             </input>
           </th>
           <th>
             <input name="refAlt" className="infoFilter" type="text"
                    onChange={this.handleFilterUpdate}></input>
           </th>
           {attrs}
         </tr>
       </thead>
     );
   }
});


var VCFTableBody = React.createClass({
   render: function() {
     var rows = this.props.records.map(function(record, idx) {
       return <VCFRecord record={record} key={record.__KEY__} even={idx % 2 == 0}
                         attrs={this.props.attrs}/>;
     }.bind(this));
     return (
       <tbody>
         {rows}
       </tbody>
     );
   }
});


var VCFRecord = React.createClass({
   render: function() {
     var attrs = this.props.attrs.map(function(attr) {
       var val = this.props.record.INFO[attr];
       return <td key={attr}>{String(val)}</td>;
     }.bind(this));
     return (
       <tr className={this.props.even ? "even" : "odd"}>
         <td>{this.props.record.CHROM}</td>
         <td className="pos">{this.props.record.POS}</td>
         <td>{this.props.record.REF}/{this.props.record.ALT}</td>
         {attrs}
       </tr>
     );
   }
});


module.exports = VCFTable;
