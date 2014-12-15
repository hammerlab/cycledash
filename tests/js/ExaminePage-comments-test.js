'use strict';

require('./testdom')('<html><body></body></html>');
var React = require('react/addons'),
    assert = require('assert'),
    _ = require('underscore'),
    sinon = require('sinon');

global.reactModulesToStub = [
  'components/BioDalliance.js'
];

var ExaminePage = require(
      '../../cycledash/static/js/examine/components/ExaminePage'),
    QueryBox = require('../../cycledash/static/js/examine/components/QueryBox'),
    createRecordStore = require(
      '../../cycledash/static/js/examine/RecordStore'),
    RecordActions = require('../../cycledash/static/js/examine/RecordActions'),
    Dispatcher = require('../../cycledash/static/js/examine/Dispatcher'),
    TestUtils = React.addons.TestUtils,
    Utils = require('./Utils'),
    commentUtils = require('./CommentUtils');

describe('ExaminePage Comments', function() {
  var sinonSandbox, fakeServer, commentDatabase;

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
    fakeServer = commentUtils.makeFakeCommentServer(
      'tests/js/data/snv.vcf', 'tests/js/data/comment-db.json', failingPaths);
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

  function helpers(examine) {
    function commentText() {
      var comments = Utils.findInComponent(
        '.vcf-table .variant-info div p', examine);
      assert.ok(comments.length <= 1);
      return comments.length === 1 ? comments[0].textContent : null;
    }

    function clickRow(n) {
      var rows = Utils.findInComponent(
        '.vcf-table tbody tr:nth-child(' + n + ')', examine);
      assert.equal(1, rows.length);
      TestUtils.Simulate.click(rows[0]);
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
      var stub = sinonSandbox.stub(window, 'confirm', function(message) {
        return true;
      });
    }

    return {commentText, clickRow, resetAndClickRow, clickCommentButton,
            changeCommentText, getNumComments, stubDialogs};
  }

  it('should get, modify, create and delete', function() {
    var examine = renderExamine({});
    var h = helpers(examine);
    h.stubDialogs();

    assert.ok(examine.state.hasLoaded);

    // No comment clicked.
    assert.equal(null, h.commentText());

    // Click on the records with comments.
    h.resetAndClickRow(1);
    assert.equal('First', h.commentText());
    h.resetAndClickRow(3);
    assert.equal('Second', h.commentText());
    h.resetAndClickRow(10);
    assert.equal('Third', h.commentText());

    // Click on a record without a comment.
    h.resetAndClickRow(2);
    assert.equal('No Comment', h.commentText());

    // Select and deselect a record.
    h.resetAndClickRow(1);
    assert.equal('First', h.commentText());
    h.clickRow(1);
    assert.equal(null, h.commentText());

    // Edit the second comment, save it, and check that the fake DB was updated.
    h.resetAndClickRow(3);
    assert.equal('Second', h.commentText());
    h.clickCommentButton('Edit');
    h.changeCommentText('PUT');
    h.clickCommentButton('Save');
    assert.equal('PUT', commentDatabase['17'].comment_text);

    // Delete the second comment.
    h.clickCommentButton('Delete');
    assert.equal(2, h.getNumComments());
    assert(!_.has(commentDatabase, '17'));

    // Make a new comment in place of the second comment.
    h.clickCommentButton('Edit');
    h.changeCommentText('POST');
    h.clickCommentButton('Save');
    assert.equal(3, h.getNumComments());
    assert.equal('POST', commentDatabase['43'].comment_text);

    // Delete the added comment.
    h.clickCommentButton('Delete');
    assert.equal(2, h.getNumComments());
    assert(!_.has(commentDatabase, '43'));
  });

  it('should undo actions when server fails', function() {
    var examine = renderExamine({
      'PUT': ['/runs/1/comments/17'],
      'POST': ['/runs/1/comments'],
      'DELETE': ['/runs/1/comments/17']
    });
    var h = helpers(examine);
    h.stubDialogs();

    assert.ok(examine.state.hasLoaded);

    // Edit the second comment, save it, and check that the fake DB was *not*
    // updated. Then try to delete it.
    h.resetAndClickRow(3);
    assert.equal('Second', h.commentText());
    h.clickCommentButton('Edit');
    h.changeCommentText('PUT');
    h.clickCommentButton('Save');
    assert.equal('Second', h.commentText());
    assert.equal('Second', commentDatabase['17'].comment_text);
    assert.equal(3, h.getNumComments());
    h.clickCommentButton('Delete');
    assert.equal('Second', h.commentText());
    assert.equal('Second', commentDatabase['17'].comment_text);
    assert.equal(3, h.getNumComments());

    // Make a new comment, save it, and check that the fake DB was *not*
    // updated. Then try to modify it and delete it.
    h.resetAndClickRow(4);
    assert.equal('No Comment', h.commentText());
    h.clickCommentButton('Edit');
    h.changeCommentText('POST');
    h.clickCommentButton('Save');
    assert.equal('No Comment', h.commentText());
    assert.equal(3, h.getNumComments());
    h.clickCommentButton('Edit');
    h.changeCommentText('Edited');
    h.clickCommentButton('Save');
    assert.equal('No Comment', h.commentText());
    assert.equal(3, h.getNumComments());
    h.clickCommentButton('Delete');
    assert.equal('No Comment', h.commentText());
    assert.equal(3, h.getNumComments());
  });
});
