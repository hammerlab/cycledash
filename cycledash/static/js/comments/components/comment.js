'use strict';

var React = require('react'),
    moment = require('moment');


var CommentsPage = React.createClass({
  propTypes: {
    comments: React.PropTypes.arrayOf(React.PropTypes.object).isRequired
  },
  render: function() {
    return (
      <section>
        <h1>All Comments</h1>
        <Comments comments={this.props.comments} />
      </section>
    );
  }
});

var LatestComments = React.createClass({
  propTypes: {
    comments: React.PropTypes.arrayOf(React.PropTypes.object).isRequired
  },
  render: function() {
    var numComments = this.props.comments.length;
    var recentComments;
    if (numComments > 0) {
      recentComments = <div>
                        <h4>Last {numComments} Comments<a href='/comments' className='all-comments'>See all</a></h4>
                        <Comments comments={this.props.comments} />
                       </div>;
    } else {
      recentComments = <div className="comments-empty-state">No comments yet</div>;
    }
    return (
      <div className='recent-comments-container'>
        {recentComments}
      </div>
    );
  }
});

var Comments = React.createClass({
  propTypes: {
    comments: React.PropTypes.arrayOf(React.PropTypes.object).isRequired
  },
  render: function() {
    var comments = this.props.comments.map(c => <Comment comment={c} key={c.id} />);
    return (
      <ul className='comments-list'>
        {comments}
      </ul>
    );
  }
});

var Comment = React.createClass({
  propTypes: {
    comment: React.PropTypes.object.isRequired
  },
  urlForComment: function(c) {
    return `/runs/${c.vcfId}/examine?query=${c.contig}:${c.position}-${1+c.position}`;
  },
  render: function() {
    var comment = this.props.comment;
    // moment uses the local timezone by default (converting the
    // value, which starts as a UNIX timestamp, to that timezone)
    var relativeDate = moment.unix(comment.created).fromNow();
    var authorName = comment.userId ? comment.user.username : "Anonymous";
    return (
        <li>
          <div className='author-name'>{authorName}</div>
          <a className='run-id' href={`/runs/${comment.vcfId}/examine`}>Run {comment.vcfId}</a>
          <a className='location' href={this.urlForComment(comment)}>
            {comment.contig}:{comment.position}
          </a>
          <div className='comment-text'>{comment.commentText.slice(0, 45)}</div>
          <div className='time'>
            <span title={comment.lastModified}>{relativeDate}</span>
          </div>
        </li>
    );
  }
});


module.exports = { LatestComments, CommentsPage };
