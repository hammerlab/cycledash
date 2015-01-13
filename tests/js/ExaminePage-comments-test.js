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
    QueryBox = require('../../cycledash/static/js/examine/components/QueryBox'),
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

    var dispatcher = new Dispatcher();
    var recordActions = RecordActions.getRecordActions(dispatcher);
    var recordStore = createRecordStore(run, dispatcher, fakeServer);
    return TestUtils.renderIntoDocument(
      <ExaminePage recordStore={recordStore}
                   recordActions={recordActions}
                   igvHttpfsUrl=""
                   run={run} />);
  }

  function commentText() {
    var comments = Utils.findInComponent(
        '.vcf-table .variant-info div p', examine);
    assert.ok(comments.length <= 1);
    return comments.length === 1 ? comments[0].textContent : null;
  }

  function clickRow(n) {
    var rows = Utils.findInComponent('.vcf-table tbody tr', examine);
    assert.ok(rows.length >= n);
    TestUtils.Simulate.click(rows[n - 1]);
  }

  // Initially, to ensure that indexing into <tr> elements is valid, make
  // sure no comments are open.
  function resetAndClickRow(n) {
    examine.handleSelectRecord(null);
    clickRow(n);
  }

  function clickCommentButton(buttonText) {
    var buttons = Utils.findInComponent(
        '.vcf-table .variant-info button', examine);
    assert.ok(buttons.length > 0);
    var buttonsWithText = buttons.filter(function(button) {
      return button.textContent === buttonText;
    });
    assert.equal(1, buttonsWithText.length);
    TestUtils.Simulate.click(buttonsWithText[0]);
  }

  function changeCommentText(commentText) {
    var textAreas = Utils.findInComponent(
        '.vcf-table .variant-info div textarea', examine);
    assert.equal(1, textAreas.length);
    TestUtils.Simulate.change(textAreas[0], {target: {value: commentText}});
  }

  function getNumComments() {
    return _.keys(commentDatabase).length;
  }

  function stubDialogs() {
    // Stub out confirm dialogs.
    var stub = sinonSandbox.stub(window, 'confirm', _.constant(true));
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
    resetAndClickRow(1);
    assert.equal('First', commentText());
    resetAndClickRow(3);
    assert.equal('Second', commentText());
    resetAndClickRow(10);
    assert.equal('Third', commentText());

    // Click on a record without a comment.
    resetAndClickRow(2);
    assert.equal('No Comment', commentText());

    // Select and deselect a record.
    resetAndClickRow(1);
    assert.equal('First', commentText());
    clickRow(1);
    assert.equal(null, commentText());

    // Edit the second comment, save it, and check that the fake DB was updated.
    resetAndClickRow(3);
    assert.equal('Second', commentText());
    clickCommentButton('Edit');
    changeCommentText('Edited Comment');
    clickCommentButton('Save');
    assert.equal('Edited Comment', commentText());
    assert.equal('Edited Comment', commentDatabase['17'].comment_text);

    // Delete the second comment.
    clickCommentButton('Delete');
    assert.equal(2, getNumComments());
    assert(!_.has(commentDatabase, '17'));

    // Make a new comment in place of the second comment.
    clickCommentButton('Edit');
    changeCommentText('New Comment');
    clickCommentButton('Save');
    assert.equal(3, getNumComments());
    assert.equal('New Comment', commentText());
    assert.equal('New Comment', commentDatabase['43'].comment_text);

    // Delete the added comment.
    clickCommentButton('Delete');
    assert.equal(2, getNumComments());
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
    resetAndClickRow(3);
    assert.equal('Second', commentText());
    clickCommentButton('Edit');
    changeCommentText('Edited Comment');
    clickCommentButton('Save');
    assert.equal('Second', commentText());
    assert.equal('Second', commentDatabase['17'].comment_text);
    assert.equal(3, getNumComments());
    clickCommentButton('Delete');
    assert.equal('Second', commentText());
    assert.equal('Second', commentDatabase['17'].comment_text);
    assert.equal(3, getNumComments());

    // Make a new comment, save it, and check that the fake DB was *not*
    // updated. Then try to modify it and delete it.
    resetAndClickRow(4);
    assert.equal('No Comment', commentText());
    clickCommentButton('Edit');
    changeCommentText('New Comment');
    clickCommentButton('Save');
    assert.equal('No Comment', commentText());
    assert.equal(3, getNumComments());
    clickCommentButton('Edit');
    changeCommentText('Edited');
    clickCommentButton('Save');
    assert.equal('No Comment', commentText());
    assert.equal(3, getNumComments());
    clickCommentButton('Delete');
    assert.equal('No Comment', commentText());
    assert.equal(3, getNumComments());
  });
});
