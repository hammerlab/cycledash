"use strict";

var _ = require('underscore'),
    d3 = require('d3'),
    React = require('react');


var StatsSummary = React.createClass({
  propTypes: {
    hasLoaded: React.PropTypes.bool.isRequired,
    stats: React.PropTypes.object.isRequired,
  },
  render: function() {
    var stats = this.props.stats;
    var variantStats = null;
    if (stats.totalTruthRecords !== undefined) {
      variantStats = <VariantStats hasLoaded={this.props.hasLoaded}
                                   stats={stats} />;
    }

    return (
      <div id="stats-container">
        {variantStats}
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
              <th></th>
              <th>True</th>
              <th>False</th>
              <th>Precision</th>
              <th>Recall</th>
              <th>f1score</th>
            </tr>
            <tr>
              <th>Positive</th>
              <td>{fmt(truePositives || 0)}</td>
              <td>{fmt(falsePositives || 0)}</td>
              <td className="other-stats">{dfmt(precision || 0)}</td>
              <td className="other-stats">{dfmt(recall || 0)}</td>
              <td className="other-stats">{dfmt(f1score || 0)}</td>
            </tr>
            <tr>
              <th>Negative</th>
              <td className="na">-</td>
              <td>{fmt(falseNegatives || 0)}</td>
              <td className="other-stats"></td>
              <td className="other-stats"></td>
              <td className="other-stats"></td>
            </tr>
          </tbody>
        </table>
      </div>
    );
  }
});

module.exports = StatsSummary;
