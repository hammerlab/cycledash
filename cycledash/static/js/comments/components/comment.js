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
    return (
      <div className='container'>
        <h4>Last {this.props.comments.length} Comments
        <a href='/comments' className='all-comments'>(See all)</a></h4>
        <Comments comments={this.props.comments} />
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
      <table className='comments'>
        {comments}
      </table>
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
    var authorName = comment.authorName ?
        comment.authorName.slice(0, 15) : 'Anonymous';
    return (
        <tr>
          <td className='location'>
            <a className='run-id' href={`/runs/${comment.vcfId}/examine`}>Run {comment.vcfId}</a>
            <a className='location' href={this.urlForComment(comment)}>
              {comment.contig}:{comment.position}
            </a>
          </td>
          <td className='summary-container'>
            <span>
              <span className='author-name'>{authorName}</span><span className='summary'>{comment.commentText.slice(0, 45)}</span>
            </span>
          </td>
          <td className='time'>
            <span title={comment.lastModified}>{relativeDate}</span>
          </td>
        </tr>
    );
  }
});


module.exports = { LatestComments, CommentsPage };
