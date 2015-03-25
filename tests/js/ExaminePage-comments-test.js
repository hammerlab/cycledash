'use strict';

require('./testdom')('<html><body></body></html>');
var React = require('react/addons'),
    assert = require('assert'),
    _ = require('underscore'),
    sinon = require('sinon');

global.reactModulesToStub = [
  'components/BioDalliance.js'
];

var ExaminePage = require('../../cycledash/static/js/examine/components/ExaminePage'),
    createRecordStore = require('../../cycledash/static/js/examine/RecordStore'),
    RecordActions = require('../../cycledash/static/js/examine/RecordActions'),
    Dispatcher = require('../../cycledash/static/js/examine/Dispatcher'),
    TestUtils = React.addons.TestUtils,
    Utils = require('./Utils'),
    CommentUtils = require('./CommentUtils');

describe('ExaminePage Comments', function() {
  var sinonSandbox, fakeServer, commentDatabase, examine;

  before(function() {
    global.XMLHttpRequest = function() {};
  });

  beforeEach(function() {
    sinonSandbox = sinon.sandbox.create();
  });

  afterEach(function() {
    sinonSandbox.restore();
  });

  function renderExamine(failingPaths) {
    fakeServer = CommentUtils.makeFakeCommentServer(
      'tests/data/snv.vcf', 'tests/data/comment-db.json', failingPaths);
    commentDatabase = fakeServer.commentDatabase;

    var run = {
      id: 1,
      spec: fakeServer.spec,
      contigs: fakeServer.contigs,
      caller_name: 'test',
      dataset_name: 'test',
      created_at: '',
      uri: '/tests/js/data/snv.vcf'
    };
    var igvHttpfsUrl = 'http://example.com/';

    var dispatcher = new Dispatcher();
    var recordActions = RecordActions.getRecordActions(dispatcher);
    var recordStore = createRecordStore(run, igvHttpfsUrl, dispatcher, fakeServer);
    return TestUtils.renderIntoDocument(
      <ExaminePage recordStore={recordStore}
                   recordActions={recordActions}
                   igvHttpfsUrl={igvHttpfsUrl}
                   vcf={run} comparableVcfs={[]} />);
  }

  // Get text for the nth comment (0-indexed) in the row
  function commentText(n) {
    if (_.isUndefined(n)) {
      n = 0;
    }

    var comments = Utils.findInComponent(
      '.vcf-table .variant-info div p', examine);
    assert.ok(comments.length > n || comments.length === 0);
    return comments.length > n ? comments[n].textContent : null;
  }

  // Click the nth row (0-indexed)
  function clickRow(n) {
    var rows = Utils.findInComponent('.vcf-table tbody tr', examine);
    assert.ok(rows.length > n);
    TestUtils.Simulate.click(rows[n]);
  }

  // Initially, to ensure that indexing into <tr> elements is valid, make
  // sure no comments are open.
  function resetAndClickRow(n) {
    examine.handleSelectRecord(null);
    clickRow(n);
  }

  // Click the button with buttonText for the nth comment (0-indexed)
  // in the row
  function clickCommentButton(buttonText, n) {
    if (_.isUndefined(n)) {
      n = 0;
    }

    var buttons = Utils.findInComponent(
        '.vcf-table .variant-info button', examine);
    assert.ok(buttons.length > 0);
    var buttonsWithText = buttons.filter(function(button) {
      return button.textContent === buttonText;
    });
    assert.ok(buttonsWithText.length > n);
    TestUtils.Simulate.click(buttonsWithText[n]);
  }

  // Change the comment text for the nth comment (0-indexed) in the row
  function changeCommentText(commentText, n) {
    if (_.isUndefined(n)) {
      n = 0;
    }

    var textAreas = Utils.findInComponent(
        '.vcf-table .variant-info div textarea', examine);
    assert.ok(textAreas.length > n);
    TestUtils.Simulate.change(textAreas[n], {target: {value: commentText}});
  }

  function getNumComments() {
    return _.keys(commentDatabase).length;
  }

  function stubDialogs() {
    // Stub out confirm dialogs.
    sinonSandbox.stub(window, 'confirm', _.constant(true));
  }

  it('should get, modify, create and delete', function() {
    // This test often exceeds the default of 2000ms, as each Simulate call takes
    // approximately 50ms.
    // TODO(tavi) Look into why this is.
    this.timeout(10000);

    examine = renderExamine({});
    stubDialogs();

    assert.ok(examine.state.hasLoaded);

    // No comment clicked.
    assert.equal(null, commentText());

    // Click on the records with comments.
    resetAndClickRow(0);
    assert.equal('First', commentText());
    assert.equal('Another First', commentText(1));
    resetAndClickRow(2);
    assert.equal('Second', commentText());
    resetAndClickRow(9);
    assert.equal('Third', commentText());

    // Click on a record without a comment.
    resetAndClickRow(1);
    assert.equal(null, commentText());

    // Select and deselect a record.
    resetAndClickRow(0);
    assert.equal('First', commentText());
    clickRow(0);
    assert.equal(null, commentText());

    // Edit the second comment, save it, and check that the fake DB was updated.
    resetAndClickRow(2);
    assert.equal('Second', commentText());
    clickCommentButton('Edit');
    changeCommentText('Edited Comment');
    clickCommentButton('Save');
    assert.equal('Edited Comment', commentText());
    assert.equal('Edited Comment', commentDatabase['17'].comment_text);

    // Delete the second comment.
    clickCommentButton('Delete');
    assert.equal(3, getNumComments());
    assert(!_.has(commentDatabase, '17'));

    // Make a new comment in place of the second comment.
    changeCommentText('New Comment');
    clickCommentButton('Save');
    assert.equal(4, getNumComments());
    assert.equal('New Comment', commentText());
    assert.equal('New Comment', commentDatabase['43'].comment_text);

    // Delete the added comment.
    clickCommentButton('Delete');
    assert.equal(3, getNumComments());
    assert(!_.has(commentDatabase, '43'));
  });

  it('should undo actions when server fails', function() {
    examine = renderExamine({
      'PUT': ['/runs/1/comments/17'],
      'POST': ['/runs/1/comments'],
      'DELETE': ['/runs/1/comments/17']
    });
    stubDialogs();

    assert.ok(examine.state.hasLoaded);

    // Edit the second comment, save it, and check that the fake DB was *not*
    // updated. Then try to delete it.
    resetAndClickRow(2);
    assert.equal('Second', commentText());
    clickCommentButton('Edit');
    changeCommentText('Edited Comment');
    clickCommentButton('Save');
    assert.equal('Second', commentText());
    assert.equal('Second', commentDatabase['17'].comment_text);
    assert.equal(4, getNumComments());
    clickCommentButton('Delete');
    assert.equal('Second', commentText());
    assert.equal('Second', commentDatabase['17'].comment_text);
    assert.equal(4, getNumComments());

    // Make a new comment, save it, and check that the fake DB was *not*
    // updated. (We can't delete it, because the comment will revert
    // to edit mode, which doesn't have "Delete".)
    resetAndClickRow(3);
    assert.equal(null, commentText());
    changeCommentText('New Comment');
    clickCommentButton('Save');
    assert.equal(null, commentText());
    assert.equal(4, getNumComments());
  });
});
