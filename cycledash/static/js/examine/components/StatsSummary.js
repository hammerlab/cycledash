"use strict";

var _ = require('underscore'),
    d3 = require('d3'),
    React = require('react/addons');


var StatsSummary = React.createClass({
  propTypes: {
    hasLoaded: React.PropTypes.bool.isRequired,
    stats: React.PropTypes.object.isRequired,
  },
  render: function() {
    var props = this.props;
    if (props.truthRecords === null) return null;
    return (
      <div id="stats-container">
        <VariantStats hasLoaded={props.hasLoaded}
                      stats={props.stats} />
        <RecordsShown hasLoaded={props.hasLoaded}
                      numberOfFilteredRecords={props.stats.totalRecords}
                      totalNumberOfRecords={props.stats.totalUnfilteredRecords} />
      </div>
    );
  }
});

var VariantStats = React.createClass({
  propTypes: {
    stats: React.PropTypes.object.isRequired,
    hasLoaded: React.PropTypes.bool.isRequired
  },
  render: function() {
    var fmt = this.props.hasLoaded ? d3.format(',') : _.constant('-'),
        dfmt = this.props.hasLoaded ? d3.format('.4f') : _.constant('-'),
        {truePositives, falsePositives,
         falseNegatives, precision, recall, f1score} = this.props.stats;

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
