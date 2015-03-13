"use strict";

var React = require('react/addons');


var ExamineInformation = React.createClass({
  propTypes: {
    run:  React.PropTypes.object,
  },
  render: function() {
    var run = this.props.run;
    return (
        <div className="examine-information">
          <dl>
            <dt>VCF URI</dt> <dd>{run.uri}</dd>
            <dt>Caller</dt> <dd>{run.caller_name}</dd>
            <dt>Submitted At</dt> <dd>{run.created_at}</dd>
          </dl>
        </div>
    );
  }
});

module.exports = ExamineInformation;
