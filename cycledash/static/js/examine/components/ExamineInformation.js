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
          <dl className='dl-horizontal'>
            <dt>Caller</dt> <dd>{run.caller_name}</dd>
            <dt>VCF URI</dt> <dd>{run.uri}</dd>
            <dt>Submitted</dt> <dd>{run.created_at}</dd>
          </dl>
        </div>
    );
  }
});

module.exports = ExamineInformation;
