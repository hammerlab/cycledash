/**
 * React Components relating to the commenting feature on the examine page.
 *
 * Comments are specific to a run and a row in the variant table.
 * This module also includes features that are grouped with commenting in the
 * UI, such as the Dalliance & IGV links.
 */
'use strict';

var _ = require('underscore'),
    React = require('react/addons'),
    marked = require('marked');

/**
 * Use markdown for comments, and set appropriate flags to:
 * - Sanitize HTML
 * - Use GitHub-flavored markdown
 */
marked.setOptions({
  renderer: new marked.Renderer(),
  gfm: true,
  sanitize: true
});


/**
 * The CommentBox box handles all functionality that requires the record and
 * comment objects, including opening the Dalliance viewer. All child elements
 * only require the comment text.
 */
var CommentBox = React.createClass({
  propTypes: {
    record: React.PropTypes.object.isRequired,
    igvLink: React.PropTypes.string,
    hasOpenedIGV: React.PropTypes.bool.isRequired,
    didClickIGVLink: React.PropTypes.func.isRequired,
    handleOpenViewer: React.PropTypes.func.isRequired,
    handleSetComment: React.PropTypes.func.isRequired,
    handleDeleteComment: React.PropTypes.func.isRequired
  },
  handleSave: function(commentText) {
    var newComment;

    // If an old comment is provided, we clone it.
    if (this.props.record.comment) {
      newComment = _.clone(this.props.record.comment);
      newComment.comment_text = commentText;
    } else {
      // Otherwise, we fashion a new comment out of the record information.
      newComment = _.extend(
        _.pick(
          this.props.record,
          'contig',
          'position',
          'reference',
          'alternates',
          'sample_name'),
          {'comment_text': commentText});
    }

    // Actually send the update request.
    this.props.handleSetComment(newComment);
  },
  handleDelete: function() {
    var result = window.confirm("Are you sure you want to delete this comment?");
    if (result) {
      this.props.handleDeleteComment(this.props.record.comment);
    }
  },
  render: function() {
    var commentText = this.props.record.comment ?
        this.props.record.comment.comment_text : '';
    return (
      <tr>
        <td colSpan={1000} className='variant-info'>
          <VCFComment record={this.props.record}
                      commentText={commentText}
                      igvLink={this.props.igvLink}
                      hasOpenedIGV={this.props.hasOpenedIGV}
                      didClickIGVLink={this.props.didClickIGVLink}
                      handleOpenViewer={this.props.handleOpenViewer}
                      handleDelete={this.handleDelete}
                      handleSave={this.handleSave} />
        </td>
      </tr>
    );
  }
});

/**
 * The VCFComment record handles state (saved comment text and edit mode) for
 * user comments.
 */
var VCFComment = React.createClass({
  propTypes: {
    record: React.PropTypes.object.isRequired,
    commentText: React.PropTypes.string.isRequired,
    igvLink: React.PropTypes.string,
    hasOpenedIGV: React.PropTypes.bool.isRequired,
    didClickIGVLink: React.PropTypes.func.isRequired,
    handleOpenViewer: React.PropTypes.func.isRequired,
    handleDelete: React.PropTypes.func.isRequired,
    handleSave: React.PropTypes.func.isRequired
  },
  getInitialState: function() {
    return {commentText: this.props.commentText, isEdit: false};
  },
  setCommentTextState: function(commentText) {
    // If passed no value, setCommentTextState resets the commentText.
    if (_.isUndefined(commentText)) {
      this.setState({commentText: this.props.commentText});
      return;
    }

    this.setState({commentText: commentText});
  },
  setEditState: function(isEdit) {
    this.setState({isEdit: isEdit});
  },
  makeEditable: function() {
    this.setState({isEdit: true});
  },
  componentDidUpdate: function(prevProps, prevState) {
    if (prevProps.commentText !== this.props.commentText) {
      this.setCommentTextState();
    }
  },
  render: function() {
    var placeHolder = 'No Comment';
    var commentElement = this.state.isEdit ?
      <VCFCommentEditor commentText={this.props.commentText}
                        placeHolder={placeHolder}
                        setCommentTextState={this.setCommentTextState}
                        setEditState={this.setEditState}
                        handleSave={this.props.handleSave} /> :
      <VCFCommentViewer commentText={this.props.commentText}
                        placeHolder={placeHolder} />;
    var commentHeader;
    if (!this.state.isEdit) {
      commentHeader = (
          <VCFCommentHeader handleEdit={this.makeEditable}
                            record={this.props.record}
                            igvLink={this.props.igvLink}
                            hasOpenedIGV={this.props.hasOpenedIGV}
                            didClickIGVLink={this.props.didClickIGVLink}
                            handleOpenViewer={this.props.handleOpenViewer}
                            handleDelete={this.props.handleDelete} />
      );
    }
    return (
      <div className='comment-container'>
        {commentElement}
        {commentHeader}
      </div>
    );
  }
});

var VCFCommentHeader = React.createClass({
  propTypes: {
    record: React.PropTypes.object.isRequired,
    igvLink: React.PropTypes.string,
    hasOpenedIGV: React.PropTypes.bool.isRequired,
    didClickIGVLink: React.PropTypes.func.isRequired,
    handleOpenViewer: React.PropTypes.func.isRequired,
    handleEdit: React.PropTypes.func.isRequired,
    handleDelete: React.PropTypes.func.isRequired
  },
  getInitialState: function() {
    // Stash the initial value to avoid surprising link swaps (see #523).
    return {initialHasOpenedIgv: this.props.hasOpenedIGV};
  },
  render: function() {
    var r = this.props.record,
        locusParam = `locus=${r.contig}:${r.position}`,
        loadIGVLink = this.props.igvLink + '&' + locusParam,
        jumpLink = loadIGVLink.replace(/\/load.*/, '/goto?') + locusParam;

    // The links are worded differently depending on previous actions.
    var didClick = this.props.didClickIGVLink;
    var igvLinks = this.state.initialHasOpenedIgv ?
        [<a key="jump" href={jumpLink} onClick={didClick}>Jump to Locus</a>,
         <a key="load" href={loadIGVLink} onClick={didClick}>(reload)</a>] :
        [<a key="load" href={loadIGVLink} onClick={didClick}>Load at Locus</a>,
         <a key="jump" href={jumpLink} onClick={didClick}>(Jump)</a>];

    return (
      <div className='comment-header'>
        <a className='dalliance-open'
           onClick={() => {this.props.handleOpenViewer(r);}}>
          Open Pileup Viewer
        </a>
        <span className='igv-links'>
          IGV: {igvLinks[0]}&nbsp;
               {igvLinks[1]}&nbsp;
               <a href="https://github.com/hammerlab/cycledash/wiki/IGV-Integration">help</a>
        </span>
        <button className='btn btn-default btn-xs comment-button btn-danger'
                onClick={this.props.handleDelete}>
          Delete
        </button>
        <button className='btn btn-default btn-xs comment-button'
                onClick={this.props.handleEdit}>
          Edit
        </button>
      </div>
    );
  }
});

var VCFCommentViewer = React.createClass({
  propTypes: {
    commentText: React.PropTypes.string.isRequired,
    placeHolder: React.PropTypes.string.isRequired
  },
  render: function() {
    // Warning: by using this dangerouslySetInnerHTML feature, we're relying
    // on marked to be secure.
    var plainText = this.props.commentText !== '' ?
        this.props.commentText : this.props.placeHolder;

    var markedDownText = marked(plainText);
    return (
      <div className='form-control comment-text'
           dangerouslySetInnerHTML={{__html: markedDownText}} />
    );
  }
});

/**
 * VCFCommentEditor represents the active editing of a comment, and it has a
 * separate state variable for updated text that is not yet saved.
 */
var VCFCommentEditor = React.createClass({
  propTypes: {
    commentText: React.PropTypes.string,
    placeHolder: React.PropTypes.string.isRequired,
    setCommentTextState: React.PropTypes.func.isRequired,
    setEditState: React.PropTypes.func.isRequired,
    handleSave: React.PropTypes.func.isRequired
  },
  handleSaveText: function() {
    // Create a new comment if none existed, or update the comment if it
    // changed (creating a new comment object in both cases).
    var newCommentText = this.state.newCommentText;
    if (newCommentText !== '' &&
        newCommentText !== this.props.commentText) {
      this.props.handleSave(newCommentText);
      this.props.setCommentTextState(newCommentText);
      this.props.setEditState(false);
      return;
    }

    // Reset the comment text and edit mode, if not already reset.
    this.props.setCommentTextState();
    this.props.setEditState(false);

    // TODO(tavi) Alert the user to the fact their update (e.g. '') was not
    // submitted.
  },
  handleCancelConfirm: function(event) {
    var result = window.confirm("Are you sure you want to cancel this edit?");
    if (result) {
      this.props.setCommentTextState();
      this.props.setEditState(false);
    }
  },
  getInitialState: function() {
    return {newCommentText: this.props.commentText};
  },
  handleChange: function(event) {
    this.setState({newCommentText: event.target.value});
  },
  render: function() {
    return (
      <div>
        <textarea className='form-control comment-textarea'
                  defaultValue={this.props.commentText}
                  placeholder={this.props.placeHolder}
                  onChange={this.handleChange}
                  ref='textArea' />
        <div className='edit-buttons'>
          <button className='btn btn-xs comment-button btn-default'
                  onClick={this.handleCancelConfirm}>
            Cancel
          </button>
          <button className='btn btn-xs comment-button btn-success'
                  onClick={this.handleSaveText}>
            Save
          </button>
        </div>
      </div>
    );
  }
});

module.exports = CommentBox;
