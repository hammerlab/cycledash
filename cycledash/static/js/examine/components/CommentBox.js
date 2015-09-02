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
    marked = require('marked'),
    moment = require('moment');

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
    handleOpenViewer: React.PropTypes.func.isRequired,
    handleSetComment: React.PropTypes.func.isRequired,
    handleDeleteComment: React.PropTypes.func.isRequired,
    currentUser: React.PropTypes.object.isRequired
  },
  getHandleDelete: function(comment) {
    var handleDeleteComment = this.props.handleDeleteComment;
    var record = this.props.record;
    return function() {
      var result = window.confirm("Are you sure you want to delete this comment?");
      if (result) {
        handleDeleteComment(comment, record);
      }
    };
  },
  getHandleSaveForUpdate: function(comment) {
    var handleSetComment = this.props.handleSetComment;
    var record = this.props.record;
    return function(commentText) {
      var newComment = _.clone(comment);
      newComment.commentText = commentText;
      handleSetComment(newComment, record);
    };
  },
  getHandleSaveForCreate: function() {
    var handleSetComment = this.props.handleSetComment;
    var getGranularUnixSeconds = this.getGranularUnixSeconds;
    var record = this.props.record;
    var currentUser = this.props.currentUser;

    return function(commentText) {
      // Subtract the offset to get GMT (to match what's in the DB)
      var newComment = _.extend(
        _.pick(record,
               'contig',
               'position',
               'reference',
               'alternates',
               'sample_name'),
        {'commentText': commentText,
         'user': currentUser,
         'userId': currentUser.id,
         // Note: this is a temporary date that does not get persisted
         // to the DB. Instead, the DB creates its own date, but this
         // timestamp is used for distinguishing between comments in
         // the meantime.
         'created': getGranularUnixSeconds(moment())});
      handleSetComment(newComment, record);
    };
  },
  getGranularUnixSeconds: function(momentObject) {
    // moment does not appear to provide this functionality.
    return momentObject.valueOf() / 1000.0;
  },
  render: function() {
    var comments = this.props.record.comments;
    var commentNodes = _.sortBy(comments, 'created').map(
      comment => {
        // moment uses the local timezone by default (converting the
        // value, which starts as a UNIX timestamp, to that timezone)
        var createdString = moment.unix(comment.created).fromNow();
        // Prevent react key collisions
        var rowKey = utils.getRowKey(this.props.record);
        var reactKey = _.has(comment, 'id') ?
            rowKey + comment.id :
            rowKey + String(this.getGranularUnixSeconds(
              moment(comment.created)));
        return <VCFComment record={this.props.record}
                           commentText={comment.commentText}
                           user={comment.user}
                           key={reactKey}
                           handleSave={this.getHandleSaveForUpdate(comment)}
                           startInEditState={false}
                           cancelable={true}
                           createdString={createdString}
                           handleDelete={this.getHandleDelete(comment)} />;
    });

    return (
      <tr>
        <td colSpan={1000} className='variant-info'>
          <VCFCommentHeader record={this.props.record}
                            igvLink={this.props.igvLink}
                            handleOpenViewer={this.props.handleOpenViewer} />
          {commentNodes}
          <VCFComment record={this.props.record}
                      commentText={''}
                      key={utils.getRowKey(this.props.record) + 'newcomment'}
                      handleSave={this.getHandleSaveForCreate()}
                      startInEditState={true}
                      cancelable={false}/>
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
    startInEditState: React.PropTypes.bool.isRequired,
    cancelable: React.PropTypes.bool.isRequired,

    // Optional arguments.
    user: React.PropTypes.object,
    createdString: React.PropTypes.string,
    handleDelete: React.PropTypes.func,
  },
  getInitialState: function() {
    return {commentText: this.props.commentText,
            isEditing: this.props.startInEditState};
  },
  setCommentTextState: function(commentText) {
    // If passed no value, setCommentTextState resets the commentText.
    if (_.isUndefined(commentText)) {
      this.setState({commentText: this.props.commentText});
      return;
    }

    this.setState({commentText: commentText});
  },
  setStartingEditState: function() {
    this.setState({isEditing: this.props.startInEditState});
  },
  setEditState: function(isEditing) {
    this.setState({isEditing});
  },

  makeEditable: function() {
    this.setState({isEditing: true});
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
    var commentElement = (this.state.isEditing || !this.props.handleDelete) ?
      <VCFCommentEditor commentText={this.props.commentText}
                        placeHolder={placeHolder}
                        setCommentTextState={this.setCommentTextState}
                        setEditState={this.setEditState}
                        setStartingEditState={this.setStartingEditState}
                        handleSave={this.props.handleSave}
                        cancelable={this.props.cancelable} /> :
      <VCFCommentViewer commentText={this.props.commentText}
                        user={this.props.user}
                        createdString={this.props.createdString}
                        placeHolder={placeHolder}
                        handleDelete={this.props.handleDelete}
                        handleEdit={this.makeEditable} />;
    return commentElement;
  }
});

var VCFCommentHeader = React.createClass({
  propTypes: {
    record: React.PropTypes.object.isRequired,
    igvLink: React.PropTypes.string,
    handleOpenViewer: React.PropTypes.func.isRequired
  },
  getInitialState: function() {
    // Stash the initial value to avoid surprising link swaps (see #523).
    return {initialHasOpenedIgv: this.props.hasOpenedIGV};
  },
  render: function() {
    var r = this.props.record,
        locusParam = `locus=${r.contig}:${r.position}`,
        loadIGVLink = this.props.igvLink + '&' + locusParam;

    return (
      <div className='comment-box-header'>
        <a className='dalliance-open'
           onClick={() => {this.props.handleOpenViewer(r);}}>
          Open Pileup Viewer
        </a>
        <div className='igv-links'>
          <a className='igv-load' href={loadIGVLink}>Load in IGV</a>
          <a href="https://github.com/hammerlab/cycledash/wiki/IGV-Integration" className="igv-help" title="IGV Help" target="_blank"></a>
        </div>
      </div>
    );
  }
});

var VCFCommentViewer = React.createClass({
  propTypes: {
    commentText: React.PropTypes.string.isRequired,
    createdString: React.PropTypes.string.isRequired,
    placeHolder: React.PropTypes.string.isRequired,
    handleDelete: React.PropTypes.func.isRequired,
    handleEdit: React.PropTypes.func.isRequired,
    user: React.PropTypes.object
  },
  render: function() {
    // Warning: by using this dangerouslySetInnerHTML feature, we're relying
    // on marked to be secure.
    var plainText = this.props.commentText !== '' ?
        this.props.commentText : this.props.placeHolder;

    var markedDownText = marked(plainText);
    var user = this.props.user;
    var authorName =
      (user !== undefined && user !== null) ? user.username : "Anonymous";

    return (
      <div className='comments'>
        <div className='comment-view-container'>
          <div className='comment-header'>
            <div className='author-name'>
              <b>{authorName}</b>
            </div>
            <div className='edit-buttons'>
              <a className='comment-edit' title='Edit Comment' href='#' onClick={this.props.handleEdit}></a>
              <a className='comment-delete' title='Delete Comment' href='#' onClick={this.props.handleDelete}></a>
            </div>
          </div>
          <div className='comment-text'
               dangerouslySetInnerHTML={{__html: markedDownText}} />
          <div className='time'>{this.props.createdString}</div>
        </div>
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
    commentText: React.PropTypes.string.isRequired,
    placeHolder: React.PropTypes.string.isRequired,
    setCommentTextState: React.PropTypes.func.isRequired,
    setEditState: React.PropTypes.func.isRequired,
    setStartingEditState: React.PropTypes.func.isRequired,
    handleSave: React.PropTypes.func.isRequired,
    cancelable: React.PropTypes.bool.isRequired
  },
  handleSaveText: function() {
    // If non-blank text is entered that differs from what was originally
    // in the editor, save it. A new comment can
    // never be blank, though.
    var newCommentText = this.state.newCommentText;
    if (newCommentText !== '') {
      if ((newCommentText !== this.props.commentText)) {
        this.props.handleSave(newCommentText);
        this.props.setCommentTextState(newCommentText);
        this.props.setEditState(false);

        // Reset the text of the textarea, so it can be used for creating
        // yet another comment.
        this.setState({newCommentText: ''});
        return;
      }
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
      this.props.setStartingEditState();
    }
  },
  getInitialState: function() {
    return {newCommentText: this.props.commentText};
  },
  handleTextChange: function(event) {
    this.setState({newCommentText: event.target.value});
  },
  render: function() {
    var buttons = [];
    if (this.props.cancelable) {
      buttons.push(
        <button className='comment-button comment-cancel'
                key='cancel'
                onClick={this.handleCancelConfirm}>
          Cancel
        </button>
      );
    }
    buttons.push(
      <button className='comment-button comment-save'
              key='save'
              onClick={this.handleSaveText}>
        Save
      </button>
    );
    return (
      <div className='comments'>
        <div className='comment-edit-container'>
          <textarea className='form-control comment-textarea'
                    value={this.state.newCommentText}
                    placeholder={this.props.placeHolder}
                    onChange={this.handleTextChange}
                    ref='textArea' />
          <div className='save-buttons'>
            {buttons}
          </div>
        </div>
      </div>
    );
  }
});

module.exports = CommentBox;
