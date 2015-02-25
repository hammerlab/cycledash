'use strict';

var React = require('react'),
    moment = require('moment');


var LatestComments = React.createClass({
  propTypes: {
    comments: React.PropTypes.arrayOf(React.PropTypes.object).isRequired
  },
  render: function() {
    var comments = this.props.comments.map(c => <Comment comment={c} key={c.id} />);
    return (
      <div className='comments'>
        <h4>Last {comments.length} Comments</h4>
        <ul className='comments'>
          {comments}
        </ul>
        <a href='/comments' className='all-comments'>See all…</a>
      </div>
    );
  }
});

var Comment = React.createClass({
  propTypes: {
    comment: React.PropTypes.object.isRequired
  },
  render: function() {
    var comment = this.props.comment,
        relativeDate = moment(new Date(comment.last_modified)).fromNow();
    return (
        <li>
          <span className='run-id'>
            <a href='/runs/{ comment.vcf_id }/examine'>Run { comment.vcf_id }</a>
          </span>
          <span className='location'>{ comment.contig }:{ comment.position }</span>
          <span className='summary'>{ comment.comment_text.slice(0, 60) }</span>
          <span className='time' title='{ comment.last_modified }'>{ relativeDate }</span>
        </li>
    );
  }
});


module.exports = LatestComments;
