/** @jsx React.DOM */
"use strict";

var _ = require('underscore'),
    React = require('react/addons'),
    vcf = require('vcf.js'),
    vcfTools = require('./vcf.tools');


var StatsSummary = React.createClass({
  propTypes: {
    hasLoaded: React.PropTypes.bool.isRequired,
    truthRecords: React.PropTypes.arrayOf(React.PropTypes.object),
    records: React.PropTypes.arrayOf(React.PropTypes.object).isRequired,
    unfilteredRecords: React.PropTypes.arrayOf(React.PropTypes.object).isRequired,
    handleVariantTypeChange: React.PropTypes.func.isRequired,
    variantType: React.PropTypes.string.isRequired
  },
  render: function() {
    if (this.props.truthRecords === null) return null;
    return (
      <div id="stats-container">
        <VariantTypeTabs variantType={this.props.variantType}
                         handleVariantTypeChange={this.props.handleVariantTypeChange} />
        <VariantStats variantType={this.props.variantType}
                      hasLoaded={this.props.hasLoaded}
                      truthRecords={this.props.truthRecords}
                      records={this.props.records} />
        <RecordsShown hasLoaded={this.props.hasLoaded}
                      numberOfFilteredRecords={this.props.records.length}
                      totalNumberOfRecords={this.props.unfilteredRecords.length} />
      </div>
    );
  }
});

var VariantTypeTabs = React.createClass({
  propTypes: {
    handleVariantTypeChange: React.PropTypes.func.isRequired,
    variantType: React.PropTypes.string.isRequired
  },
  handleVariantTypeChange: function(e) {
    this.props.handleVariantTypeChange(e.target.textContent);
  },
  render: function() {
    var tabs = _.map(['All', 'SNV', 'INDEL', 'SV'], (vType) => {
      var cls = React.addons.classSet({'active' : this.props.variantType == vType});
      return (
        <li onClick={this.handleVariantTypeChange} className={cls} key={vType}>
          {vType}
        </li>
      );
    });
    return <ul className="variant-type-tabs">{tabs}</ul>;
  }
});

var VariantStats = React.createClass({
  propTypes: {
    variantType: React.PropTypes.string.isRequired,
    records: React.PropTypes.arrayOf(React.PropTypes.object).isRequired,
    truthRecords: React.PropTypes.arrayOf(React.PropTypes.object).isRequired,
    hasLoaded: React.PropTypes.bool.isRequired
  },
  stats: function() {
    var {records, truthRecords} = this.props;
    return vcfTools.trueFalsePositiveNegative(records, truthRecords);
  },
  precRecF1: function(truePositives, falsePositives, totalTrue) {
    var precision = truePositives / (truePositives + falsePositives),
        recall = truePositives / this.props.truthRecords.length,
        f1score = 2 * (precision * recall) / (precision + recall);
    return {precision, recall, f1score};
  },
  render: function() {
    var fmt = this.props.hasLoaded ? d3.format(',') : _.constant('-'),
        dfmt = this.props.hasLoaded ? d3.format('.4f') : _.constant('-'),
        {truePositives, falsePositives, falseNegatives} = this.stats(),
        {precision, recall, f1score} = this.precRecF1(truePositives, falsePositives);

    return (
      <div className="precision-recall">
        <table>
          <tbody>
            <tr>
              <td></td>
              <td className="label">True</td>
              <td className="label">False</td>
            </tr>
            <tr>
              <td className="label">Postive</td>
              <td>{fmt(truePositives || 0)}</td>
              <td>{fmt(falsePositives || 0)}</td>
            </tr>
            <tr>
              <td className="label">Negative</td>
              <td className="na">-</td>
              <td>{fmt(falseNegatives || 0)}</td>
            </tr>
            <tr>
              <td className="label">Precision</td>
              <td className="label">Recall</td>
              <td className="label">f1score</td>
            </tr>
            <tr>
              <td>{dfmt(precision || 0)}</td>
              <td>{dfmt(recall || 0)}</td>
              <td>{dfmt(f1score || 0)}</td>
            </tr>
          </tbody>
        </table>
      </div>
    );
  }
});

var RecordsShown = React.createClass({
  propTypes: {
    hasLoaded: React.PropTypes.bool.isRequired,
    numberOfFilteredRecords: React.PropTypes.number.isRequired,
    totalNumberOfRecords: React.PropTypes.number.isRequired
  },
  render: function() {
    var fmt = d3.format(','),
        countsText;
    if (this.props.totalNumberOfRecords === this.props.numberOfFilteredRecords) {
      countsText = 'all' + ' ' + fmt(this.props.totalNumberOfRecords);
    } else {
      countsText = fmt(this.props.numberOfFilteredRecords) + ' of ' +
                       fmt(this.props.totalNumberOfRecords);
    }
    return (
      <div className="total-records">
        Showing {this.props.hasLoaded ? countsText : '...'} variants.
      </div>
    );
  }
});


module.exports = StatsSummary;
