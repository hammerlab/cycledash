/** @jsx React.DOM */
"use strict";

var _ = require('underscore'),
    d3 = require('d3'),
    React = require('react'),
    idiogrammatik = require('./idiogrammatik'),
    vcf = require('./vcf');
require('./vcf.tools')(vcf);


var Karyogram = React.createClass({
   componentDidMount: function() {
     idiogrammatik.load(function(err, data) {
       if (err) throw err;
       var firstPos = null,
           selection = {},  // the current highlight/selected range
           shifted = false;  // if the shift key is down

       this.props.karyogram
        .on('dragstart', function(position, kgram) {
          if (!position.chromosome || !shifted) return;
          firstPos = position;
         })
        .on('drag', function(position, kgram) {
          if (!position.chromosome || !shifted) return;
          kgram.highlights().remove();
          selection = kgram.highlight(firstPos, position);
         })
        .on('dragend', function(position, kgram) {
          if (!position.chromosome || !shifted) return;
          kgram.highlights().remove();
          var start, end;
          start = Math.min(position.absoluteBp, firstPos.absoluteBp);
          end = Math.max(position.absoluteBp, firstPos.absoluteBp);
          this.props.handleRangeChange(start, end);
          selection = kgram.highlight(firstPos, position);
         }.bind(this));

       window.onkeydown = function(e) {
         if (e.shiftKey) {
           document.getElementsByTagName("body")[0].style.cursor = "text";
           shifted = true;
           try {
             // This disables pan/zoom by unsetting the x domain.
             this.props.karyogram.zoomBehavior().x(null);
           } catch(err) {
            // We catch here, because setting the x attr above throws, though
            // it does what we want without causing problems...
           }
         }
       }.bind(this);
       window.onkeyup = function(e) {
         document.getElementsByTagName("body")[0].style.cursor = "default";
         if (shifted && !e.shiftKey) {
           shifted = false;
           this.props.karyogram.zoomBehavior().x(this.props.karyogram.scale());
         }
       }.bind(this);

       d3.select(this.getDOMNode())
           .datum(data)
           .call(this.props.karyogram);
     }.bind(this));
   },
   render: function() {
     this.props.karyogram.highlights().remove();
     this.props.karyogram.highlight(this.props.start, this.props.end);
     return <div className="karyogram"></div>;
   }
});

var PrecisionRecallTable = React.createClass({
   render: function() {
     var truePositives = vcf.tools.truePositives(this.props.truthRecords, this.props.records).length,
         falsePositives = vcf.tools.falsePositives(this.props.truthRecords, this.props.records).length,
         falseNegatives = vcf.tools.falseNegatives(this.props.truthRecords, this.props.records).length;

     var precision = truePositives / (truePositives + falsePositives),
         recall = truePositives / this.props.truthRecords.length,
         f1score = 2 * (precision * recall) / (precision + recall);

     var fmt = d3.format(','),
         dfmt = d3.format('.4f');
     return (
       <table className="precision-recall-table">
         <thead>
           <tr>
             <th></th>
             <th>True</th>
             <th>False</th>
           </tr>
         </thead>
         <tbody>
           <tr id="positive">
             <td>Postive</td>
             <td>{fmt(truePositives)}</td>
             <td>{fmt(falsePositives)}</td>
           </tr>
           <tr id="negative">
             <td>Negative</td>
             <td className="na">-</td>
             <td>{fmt(falseNegatives)}</td>
           </tr>
           <tr>
             <td>Precision</td>
             <td>Recall</td>
             <td>f1score</td>
           </tr>
           <tr>
             <td>{dfmt(precision) || "-"}</td>
             <td>{dfmt(recall) || "-"}</td>
             <td>{dfmt(f1score) || "-"}</td>
           </tr>
         </tbody>
       </table>
     );
   }
});


module.exports.Karyogram = Karyogram;
module.exports.PrecisionRecallTable = PrecisionRecallTable;
