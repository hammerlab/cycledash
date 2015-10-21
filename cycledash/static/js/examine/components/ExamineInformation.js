"use strict";

var React = require('react');


var ExamineInformation = React.createClass({
  propTypes: {
    run:  React.PropTypes.object,
  },
  render: function() {
    var run = this.props.run;
    return (
      <div className="examine-information">
        <table className="header-table">
          <tbody>
            <tr>
              <th>Caller Name</th>
              <td>{run.caller_name}</td>
            </tr>
            <tr>
              <th>VCF URI</th>
              <td>{run.uri}</td>
            </tr>
            <tr>
              <th>Submitted</th>
              <td>{run.created_at}</td>
            </tr>
          </tbody>
        </table>
      </div>
    );
  }
});

module.exports = ExamineInformation;
