/**
 * This tests that the IGV links point to the correct place both before & after
 * a click.
 */
'use strict';

require('./testdom')('<html><body></body></html>');
var React = require('react/addons'),
    assert = require('assert'),
    _ = require('underscore'),
    $ = require('jquery'),
    fs = require('fs');

var CommentBox = require('../../cycledash/static/js/examine/components/CommentBox'),
    TestUtils = React.addons.TestUtils,
    Utils = require('./Utils'),
    DataUtils = require('./DataUtils');


// <CommentBox> corresponds to a <tr>, which can't be instantiated directly.
// This wraps it in a valid table.
var CommentTable = React.createClass({
  render: function() {
    return <table><tbody><CommentBox {...this.props} /></tbody></table>;
  }
});


describe('IGV Links', function() {
  var records = DataUtils.getRecords(DataUtils.loadVCF('tests/data/snv.vcf'));

  var renderCommentBox = function(props) {
    var componentProps = _.extend({
      record: records[0],
      igvLink: 'http://localhost:1234/load?file=foo&genome=hg38',
      hasOpenedIGV: false,
      didClickIGVLink: _.noop,
      handleOpenViewer: _.noop,
      handleSetComment: _.noop,
      handleDeleteComment: _.noop
    }, props);
    return TestUtils.renderIntoDocument(<CommentTable {...componentProps} />);
  };

  var getIGVLinks = function(commentBox) {
    return Utils.findInComponent('a', commentBox)
        .filter(a => a.href.indexOf('localhost') >= 0);
  };

  var assertContains = function(needle, haystack) {
    assert.notEqual(-1, haystack.indexOf(needle),
          `Expected to find '${needle}' in '${haystack}'`);
  };

  it('should display load/jump initially', function() {
    var commentBox = renderCommentBox({
      hasOpenedIGV: false
    });

    var links = getIGVLinks(commentBox);
    assert.equal(2, getIGVLinks(commentBox).length);
    assertContains('Load', links[0].textContent);
    assertContains('/load', links[0].href);
    assertContains('Jump', links[1].textContent);
    assert.equal('http://localhost:1234/goto?locus=20:61795', links[1].href);
  });

  it('should swap to jump/reload after a click', function() {
    var commentBox = renderCommentBox({
      hasOpenedIGV: false
    });

    // The links don't change initially.
    commentBox.setProps({
      hasOpenedIGV: true
    });
    var links = getIGVLinks(commentBox);
    assert.equal(2, getIGVLinks(commentBox).length);
    assertContains('Load', links[0].textContent);
    assertContains('/load', links[0].href);
    assertContains('Jump', links[1].textContent);
    assertContains('/goto', links[1].href);

    // But after changing a record, they do.
    commentBox.setProps({
      record: records[1]
    });
    links = getIGVLinks(commentBox);
    assert.equal(2, getIGVLinks(commentBox).length);
    assertContains('Jump', links[0].textContent);
    assertContains('/goto', links[0].href);
    assertContains('reload', links[1].textContent);
    assertContains('/load', links[1].href);
  });
});
