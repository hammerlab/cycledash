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
    moment = require('moment'),
    store = require('store');

// Currently used to write comment author names to local storage.

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
  LOCAL_STORAGE_AUTHOR_KEY: 'CYCLEDASH_AUTHORNAME',
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
    return function(commentText, authorName) {
      var newComment = _.clone(comment);
      newComment.comment_text = commentText;
      newComment.author_name = authorName;

      handleSetComment(newComment, record);
    };
  },
  getHandleSaveForCreate: function() {
    var handleSetComment = this.props.handleSetComment;
    var record = this.props.record;
    var timezoneOffset = this.getTimezoneOffsetMillis();
    return function(commentText, authorName) {
      // Subtract the offset to get GMT (to match what's in the DB)
      var createdDate = new Date(new Date().getTime() -
                                 timezoneOffset);
      var newComment = _.extend(
        _.pick(
          record,
          'contig',
          'position',
          'reference',
          'alternates',
          'sample_name'),
        {'comment_text': commentText,
         'author_name': authorName,
         // Note: this is a temporary date that does not get persisted
         // to the DB. Instead, the DB creates its own date, but this
         // date is used for distinguishing between comments in the
         // meantime.
         'created_date': createdDate});
      handleSetComment(newComment, record);
    };
  },
  getLocalAuthorName: function() {
    return store.enabled ? store.get(this.LOCAL_STORAGE_AUTHOR_KEY, '') : '';
  },
  saveLocalAuthorName: function(authorName) {
    if (store.enabled &&
        store.get(this.LOCAL_STORAGE_AUTHOR_KEY, '') !== authorName) {
      store.set(this.LOCAL_STORAGE_AUTHOR_KEY, authorName);
    }
  },
  getTimezoneOffsetMillis: function() {
    var timezoneOffset = new Date().getTimezoneOffset();
    return timezoneOffset * 60 * 1000;
  },
  render: function() {
    var comments = this.props.record.comments;
    var timezoneOffset = this.getTimezoneOffsetMillis();
    var commentNodes = _.sortBy(comments, comment => {
      new Date(comment.created_date).getTime();
    }).map(comment => {
      // Add the offset to get local time
      var createdTimestampMillis = new Date(comment.created_date).
          getTime() + timezoneOffset;
      var rowKey = utils.getRowKey(this.props.record);
      // Prevent react key collisions
      var reactKey = _.has(comment, 'id') ?
          rowKey + comment.id : rowKey + String(createdTimestampMillis);
      return <VCFComment record={this.props.record}
                      commentText={comment.comment_text}
                      key={reactKey}
                      handleSave={this.getHandleSaveForUpdate(comment)}
                      startInEditState={false}
                      cancelable={true}
                      saveLocalAuthorName={this.saveLocalAuthorName}
                      authorName={comment.author_name}
                      createdString={moment(createdTimestampMillis).fromNow()}
                      handleDelete={this.getHandleDelete(comment)} />;
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
                      handleSave={this.getHandleSaveForCreate()}
                      startInEditState={true}
                      cancelable={false}
                      saveLocalAuthorName={this.saveLocalAuthorName}
                      authorName={this.getLocalAuthorName()}/>
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
    saveLocalAuthorName:React.PropTypes.func.isRequired,

    // Optional arguments.
    authorName: React.PropTypes.string,
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
    // Only use "Anonymous" in the viewer; the editor should just be
    // blank in that case.
    var authorNameOrAnonymous = this.props.authorName || 'Anonymous';
    var authorNameOrBlank = this.props.authorName || '';

    // handleDelete is optional, but not providing it requires the
    // edit view.
    var commentElement = (this.state.isEditing || !this.props.handleDelete) ?
      <VCFCommentEditor commentText={this.props.commentText}
                        authorName={authorNameOrBlank}
                        saveLocalAuthorName={this.props.saveLocalAuthorName}
                        placeHolder={placeHolder}
                        setCommentTextState={this.setCommentTextState}
                        setEditState={this.setEditState}
                        setStartingEditState={this.setStartingEditState}
                        handleSave={this.props.handleSave}
                        cancelable={this.props.cancelable} /> :
      <VCFCommentViewer commentText={this.props.commentText}
                        authorName={authorNameOrAnonymous}
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
               <a href="https://github.com/hammerlab/cycledash/wiki/IGV-Integration" className="igv-help" title="IGV Help"></a>
        </span>
      </div>
    );
  }
});

var VCFCommentViewer = React.createClass({
  propTypes: {
    commentText: React.PropTypes.string.isRequired,
    authorName: React.PropTypes.string.isRequired,
    createdString: React.PropTypes.string.isRequired,
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
      <div className='comment-view-container'>
        <div className='comment-header'>
          <span className='comment-by'>
            Comment by <b>{this.props.authorName}</b>, {this.props.createdString}
          </span>
          <span className='edit-buttons'>
            <a className='comment-edit' title='Edit Comment' href='#' onClick={this.props.handleEdit}></a>
            <a className='comment-delete' title='Delete Comment' href='#' onClick={this.props.handleDelete}></a>
          </span>
        </div>
        <div className='comment-text'
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
    commentText: React.PropTypes.string.isRequired,
    authorName: React.PropTypes.string.isRequired,
    saveLocalAuthorName: React.PropTypes.func.isRequired,
    placeHolder: React.PropTypes.string.isRequired,
    setCommentTextState: React.PropTypes.func.isRequired,
    setEditState: React.PropTypes.func.isRequired,
    setStartingEditState: React.PropTypes.func.isRequired,
    handleSave: React.PropTypes.func.isRequired,
    cancelable: React.PropTypes.bool.isRequired
  },
  handleSaveText: function() {
    // If non-blank text is entered that differs from what was originally
    // in the editor (either text or author), save it. A new comment can
    // never be blank, though.
    var newCommentText = this.state.newCommentText;
    var newAuthorName = this.state.newAuthorName;
    if (newCommentText !== '') {
      if ((newCommentText !== this.props.commentText) ||
          (newAuthorName !== '' &&
           newAuthorName !== this.props.authorName)) {
        // Store the author name in local storage.
        this.props.saveLocalAuthorName(newAuthorName);

        this.props.handleSave(newCommentText, newAuthorName);
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
    return {newCommentText: this.props.commentText,
            newAuthorName: this.props.authorName};
  },
  handleAuthorChange: function(event) {
    this.setState({newAuthorName: event.target.value});
  },
  handleTextChange: function(event) {
    this.setState({newCommentText: event.target.value});
  },
  render: function() {
    var buttons = [];
    if (this.props.cancelable) {
      buttons.push(
        <button className='btn btn-xs comment-button btn-default comment-cancel'
                key='cancel'
                onClick={this.handleCancelConfirm}>
          Cancel
        </button>
      );
    }
    buttons.push(
      <button className='btn btn-xs comment-button btn-success comment-save'
              key='save'
              onClick={this.handleSaveText}>
        Save
      </button>
    );
    return (
      <div className='comment-edit-container'>
        <input className='form-control comment-author'
               type='text'
               value={this.state.newAuthorName}
               placeholder='Enter your name here'
               onChange={this.handleAuthorChange} />
        <textarea className='form-control comment-textarea'
                  value={this.state.newCommentText}
                  placeholder={this.props.placeHolder}
                  onChange={this.handleTextChange}
                  ref='textArea' />
        <div className='save-buttons'>
          {buttons}
        </div>
      </div>
    );
  }
});

module.exports = CommentBox;
