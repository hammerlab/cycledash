/**
 * React Components relating to the commenting feature on the examine page.
 *
 * Comments are specific to a run and a row in the variant table.
 * This module also includes features that are grouped with commenting in the
 * UI, such as the Dalliance & IGV links.
 */
'use strict';

var _ = require('underscore'),
    utils = require('../utils'),
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
  getHandleDelete: function(comment) {
    var handleDeleteComment = this.props.handleDeleteComment;
    return function() {
      var result = window.confirm("Are you sure you want to delete this comment?");
      if (result) {
        handleDeleteComment(comment);
      }
    }
  },
  getHandleSaveForUpdate: function(comment) {
    var handleSetComment = this.props.handleSetComment;
    return function(commentText) {
      var newComment = _.clone(comment);
      newComment.comment_text = commentText;

      handleSetComment(newComment);
    };
  },
  getHandleSaveForCreate: function(record) {
    var handleSetComment = this.props.handleSetComment;
    return function(commentText) {
      var newComment = _.extend(
        _.pick(
          record,
          'contig',
          'position',
          'reference',
          'alternates',
          'sample_name'),
        {'comment_text': commentText,
         'user_id': 'test',
         // Note: this is a temporary date that does not get persisted
         // to the DB. Instead, the DB creates its own date, but this
         // date is used for distinguishing between comments in the
         // meantime.
         'created_timestamp': new Date().getTime()});
      handleSetComment(newComment);
    };
  },
  render: function() {
    var comments = this.props.record.comments;
    var commentNodes = [];
    _.each(comments, comment => {
      commentNodes.push(
          <VCFComment record={this.props.record}
                      commentText={comment.comment_text}
                      key={utils.getCommentKey(comment)}
                      handleSave={this.getHandleSaveForUpdate(comment)}
                      defaultEditState={false}
                      allowCancel={true}
                      handleDelete={this.getHandleDelete(comment)} />
      );
    });

    return (
      <tr>
        <td colSpan={1000} className='variant-info'>
          <VCFCommentHeader record={this.props.record}
                            igvLink={this.props.igvLink}
                            hasOpenedIGV={this.props.hasOpenedIGV}
                            didClickIGVLink={this.props.didClickIGVLink}
                            handleOpenViewer={this.props.handleOpenViewer} />
          {commentNodes}
          <VCFComment record={this.props.record}
                      commentText={''}
                      key={utils.getRowKey(this.props.record) + 'newcomment'}
                      handleSave={this.getHandleSaveForCreate(this.props.record)}
                      defaultEditState={true}
                      allowCancel={false} />
        </td>
      </tr>
    );
  }
});

/**
 * The VCFComment handles state (saved comment text and edit mode) for
 * user comments.
 */
var VCFComment = React.createClass({
  propTypes: {
    record: React.PropTypes.object.isRequired,
    commentText: React.PropTypes.string.isRequired,
    handleSave: React.PropTypes.func.isRequired,
    defaultEditState: React.PropTypes.bool.isRequired,
    allowCancel: React.PropTypes.bool.isRequired,

    // handleDelete is intentionally optional. See render function.
    handleDelete: React.PropTypes.func,
  },
  getInitialState: function() {
    return {commentText: this.props.commentText,
            isEdit: this.props.defaultEditState};
  },
  setCommentTextState: function(commentText) {
    // If passed no value, setCommentTextState resets the commentText.
    if (_.isUndefined(commentText)) {
      this.setState({commentText: this.props.commentText});
      return;
    }

    this.setState({commentText: commentText});
  },
  setDefaultEditState: function() {
    this.setState({isEdit: this.props.defaultEditState});
  },
  setEditState: function(isEdit) {
    this.setState({isEdit: isEdit});
  },

  makeEditable: function() {
    this.setState({isEdit: true});
  },
  componentDidUpdate: function(prevProps, prevState) {
    if (prevProps.commentText !==
        this.props.commentText) {
      this.setCommentTextState();
    }
  },
  render: function() {
    var placeHolder = 'Enter your comment here';

    // handleDelete is optional, but not providing it requires the
    // edit view.
    var commentElement = (this.state.isEdit || !this.props.handleDelete) ?
      <VCFCommentEditor commentText={this.props.commentText}
                        placeHolder={placeHolder}
                        setCommentTextState={this.setCommentTextState}
                        setEditState={this.setEditState}
                        setDefaultEditState={this.setDefaultEditState}
                        handleSave={this.props.handleSave}
                        allowCancel={this.props.allowCancel} /> :
      <VCFCommentViewer commentText={this.props.commentText}
                        placeHolder={placeHolder}
                        handleDelete={this.props.handleDelete}
                        handleEdit={this.makeEditable} />;
    return (
      <div className='comment-container'>
        {commentElement}
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
    handleOpenViewer: React.PropTypes.func.isRequired
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
      <div className='comment-box-header'>
        <a className='dalliance-open'
           onClick={() => {this.props.handleOpenViewer(r);}}>
          Open Pileup Viewer
        </a>
        <span className='igv-links'>
          IGV: {igvLinks[0]}&nbsp;
               {igvLinks[1]}&nbsp;
               <a href="https://github.com/hammerlab/cycledash/wiki/IGV-Integration">help</a>
        </span>
      </div>
    );
  }
});

var VCFCommentViewer = React.createClass({
  propTypes: {
    commentText: React.PropTypes.string.isRequired,
    placeHolder: React.PropTypes.string.isRequired,
    handleDelete: React.PropTypes.func.isRequired,
    handleEdit: React.PropTypes.func.isRequired
  },
  render: function() {
    // Warning: by using this dangerouslySetInnerHTML feature, we're relying
    // on marked to be secure.
    var plainText = this.props.commentText !== '' ?
        this.props.commentText : this.props.placeHolder;

    var markedDownText = marked(plainText);
    return (
      <div>
        <div className='comment-header'>
          <button className='btn btn-default btn-xs comment-button btn-danger'
                  onClick={this.props.handleDelete}>
            Delete
          </button>
          <button className='btn btn-default btn-xs comment-button'
                  onClick={this.props.handleEdit}>
            Edit
          </button>
        </div>
        <div className='form-control comment-text'
             dangerouslySetInnerHTML={{__html: markedDownText}} />
      </div>
    );
  }
});

/**
 * VCFCommentEditor represents the active editing (or creating) of a 
 * comment, and it has a separate state variable for updated text that
 * is not yet saved.
 */
var VCFCommentEditor = React.createClass({
  propTypes: {
    commentText: React.PropTypes.string,
    placeHolder: React.PropTypes.string.isRequired,
    setCommentTextState: React.PropTypes.func.isRequired,
    setEditState: React.PropTypes.func.isRequired,
    setDefaultEditState: React.PropTypes.func.isRequired,
    handleSave: React.PropTypes.func.isRequired,
    allowCancel: React.PropTypes.bool.isRequired
  },
  handleSaveText: function() {
    // If non-blank text is entered that differs from what was originally
    // in the editor, save it.
    var newCommentText = this.state.newCommentText;
    if (newCommentText !== '' &&
        newCommentText !== this.props.commentText) {
      this.props.handleSave(newCommentText);
      this.props.setCommentTextState(newCommentText);
      this.props.setEditState(false);

      // Reset the text of the textarea, so it can be used for creating
      // yet another comment.
      this.setState({newCommentText: ''});
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
      this.props.setDefaultEditState();
    }
  },
  getInitialState: function() {
    return {newCommentText: this.props.commentText};
  },
  handleChange: function(event) {
    this.setState({newCommentText: event.target.value});
  },
  render: function() {
    var buttons = [];
    if (this.props.allowCancel) {
      buttons.push(
        <button className='btn btn-xs comment-button btn-default'
                key='cancel'
                onClick={this.handleCancelConfirm}>
          Cancel
        </button>
      );
    }
    buttons.push(
      <button className='btn btn-xs comment-button btn-success'
              key='save'
              onClick={this.handleSaveText}>
        Save
      </button>
    );
    return (
      <div>
        <input ref='author' className='comment-author' type='text'
               placeholder='Enter your name here' />
        <textarea className='form-control comment-textarea'
                  value={this.state.newCommentText}
                  placeholder={this.props.placeHolder}
                  onChange={this.handleChange}
                  ref='textArea' />
        <div className='edit-buttons'>
          {buttons}
        </div>
      </div>
    );
  }
});

module.exports = CommentBox;
