/**
 * This tests that the IGV links point to the correct place both before & after
 * a click.
 */
'use strict';

require('./testdom')('<html><body></body></html>');
var React = require('react'),
    TestUtils = require('react-addons-test-utils'),
    assert = require('assert'),
    _ = require('underscore');

var CommentBox = require('../../cycledash/static/js/examine/components/CommentBox'),
    Utils = require('./Utils'),
    DataUtils = require('./DataUtils');


// <CommentBox> corresponds to a <tr>, which can't be instantiated directly.
// This wraps it in a valid table.
var CommentTable = React.createClass({
  propTypes: {
    selectedRow: React.PropTypes.number
  },
  render: function() {
    // This is conceptually similar to how VCFTable creates a CommentBox.
    var rows = _.range(0, 2).map(idx => {
      var r = [<tr key={'row' + idx}><td>Row {idx}</td></tr>];
      if (idx === this.props.selectedRow) {
        r.push(<CommentBox key={'c' + idx} {...this.props} />);
      }
      return r;
    });

    return <table><tbody>{rows}</tbody></table>;
  }
});


describe('IGV Links', function() {
  var records = DataUtils.getRecords(DataUtils.loadVCF('tests/data/snv.vcf'));

  var renderCommentBox = function(props) {
    var componentProps = _.extend({
      record: records[0],
      igvLink: 'http://localhost:1234/load?file=foo&genome=hg38',
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
      currentUser: Utils.fakeCurrentUser(),
      selectedRow: 0,
      hasOpenedIGV: false
    });

    var links = getIGVLinks(commentBox);
    assert.equal(1, getIGVLinks(commentBox).length);
    assertContains('Load', links[0].textContent);
    assertContains('/load', links[0].href);
  });
});
