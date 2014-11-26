/**
 * A CQL query box with autocomplete.
 * See grammars/querylanguage.pegjs for examples of queries this supports.
 */
'use strict';

var _ = require('underscore'),
    React = require('react'),
    QueryLanguage = require('../../QueryLanguage'),
    QueryCompletion = require('../../QueryCompletion'),
    $ = require('jquery');

// Hack to make typeahead.js use the correct jQuery.
// This should be improved when typeahead v0.11 is released, see
// https://github.com/twitter/typeahead.js/issues/743#issuecomment-52817924
(function() {
  var oldJQuery = window.jQuery;
  window.jQuery = $;
  require('typeahead.js');
  window.jQuery = oldJQuery;
})();

// Extracts a flat list of column names from the uber-columns object
function extractFlatColumnList(columns) {
  // columns looks something like {SAMPLE: {DP: {columnName: ...}}}
  var samples = _.values(columns);
  var columnInfos = _.flatten(samples.map(_.values));
  var columnNames = _.pluck(columnInfos, 'columnName');
  return ['reference', 'alternates'].concat(columnNames);
}

var QueryBox = React.createClass({
  propTypes: {
    handleQueryChange: React.PropTypes.func.isRequired,
    columns: React.PropTypes.object.isRequired,
    query: React.PropTypes.object  // parsed query
  },
  getInitialState: () => ({
    errorMessage: null  // null = no error
  }),
  parseQuery: function(queryStr) {
    var columnNames = extractFlatColumnList(this.props.columns);
    var parsedQuery = QueryLanguage.parse(queryStr, columnNames);
    if (parsedQuery.error) {
      this.setState({errorMessage: parsedQuery.error});
    } else {
      this.setState({errorMessage: null});
      this.props.handleQueryChange(parsedQuery);
    }
  },
  componentDidUpdate: function(prevProps, prevState) {
    // Watch for the first update with a populated set of columns.
    if (_.isEmpty(prevProps.columns) && !_.isEmpty(this.props.columns)) {
      this.initQueryBox();
    }
  },
  // Called when column names become available.
  initQueryBox: function() {
    var $input = $(this.refs.input.getDOMNode());
    var handleChange = (e) => {
      this.parseQuery($input.val());
    };
    var completionSource = QueryCompletion.createTypeaheadSource(
        QueryLanguage.parse, extractFlatColumnList(this.props.columns));

    $input
      .typeahead({
        highlight: true,
        minLength: 0
      }, {
        name: 'my-dataset',
        source: completionSource
      })
      .on('input typeahead:autocompleted', handleChange)
      .on('keydown', (e) => {
        if (e.which == 13 /* enter */) {
          handleChange(e);
        }
      });
      // Would be nice to show a default set of suggestions, but there's no
      // typeahead.js support for this until v0.11.
      // See https://github.com/twitter/typeahead.js/pull/719

    // Focus the CQL box when the user hits forward slash.
    $(document).on('keydown.cqlbox', function(e) {
      if (e.which == 191 &&  // forward slash
          !e.shiftKey && !e.ctrlKey && !e.metaKey &&
          document.activeElement == document.body) {
        e.preventDefault();
        $input.focus();
      }
    });
  },
  componentWillUnmount: function() {
    $(document).off('keydown.cqlbox');
  },
  render: function() {
    var statusClasses = React.addons.classSet({
      'query-status': true,
      'good': this.state.errorMessage === null,
      'bad': this.state.errorMessage !== null
    });
    var value = this.props.query;
    // TODO: don't change the text box if its contents parse to the same thing.

    return (
      <div className='query-container'>
        <div ref='error' className='error-message'>{this.state.errorMessage}</div>
        <div className='typeahead-input'>
          <span ref='status' className={statusClasses}></span>
          <input ref='input' className='query-input' type='text' />
        </div>
      </div>
    );
  },
});

module.exports = QueryBox;
