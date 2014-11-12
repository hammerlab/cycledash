/** @jsx React.DOM */

var _ = require('underscore'),
    assert = require('assert'),
    QueryLanguage = require('../../cycledash/static/js/QueryLanguage.js');


describe('Query Langauge', function() {
  var columns = ['A', 'B', 'INFO.DP'];

  function expectParse(query, expectedResult) {
    var result = QueryLanguage.parse(query, columns);
    if ('error' in result) {
      result = {error: result.error};  // no need to match the full details.
    }
    assert.deepEqual(result, expectedResult);
  }

  it('should parse simple filters', function() {
    expectParse('A < 10', {filters:[{value:'<10', column_name:['A']}]});
    expectParse('B = ABC', {filters:[{value:'=ABC', column_name:['B']}]});
  });

  it('should parse ranges', function() {
    expectParse('20', {range: {contig: '20'}});
    expectParse('20:1234-', {range: {contig: '20', start: '1234'}});
    expectParse('20:-4,567', {range: {contig: '20', end: '4567'}});
    expectParse('X:345-4,567', {range: {contig: 'X', start: '345', end: '4567'}});
  });

  it('should parse simple order bys', function() {
    expectParse('ORDER BY A', {sortBy:[{order:'asc', column_name: ['A']}]});
    expectParse('ORDER BY B DESC', {sortBy:[{order:'desc', column_name: ['B']}]});
    expectParse('ORDER BY INFO.DP ASC', {sortBy:[{order:'asc', column_name: ['INFO', 'DP']}]});
  });

  it('should parse compound filters', function() {
    expectParse('A < 10 AND B >= ABC', {
      filters: [
        {value:'<10', column_name:['A']},
        {value:'>=ABC', column_name:['B']}
      ]
    });
  });

  it('should parse compound filters with ranges', function() {
    expectParse('20:1234- AND A < 10', {
      range: {contig:'20', start: '1234'},
      filters: [{value: '<10', column_name: ['A']}]
    });
  });

  it('should parse everything together', function() {
    expectParse('A <= 10 AND X:345-4,567 AND B = ABC ORDER BY INFO.DP ASC',
                {
                  range: {contig: 'X', start: '345', end: '4567'},
                  filters: [
                    {value: '<=10', column_name: ['A']},
                    {value: '=ABC', column_name: ['B']}
                  ],
                  sortBy:[{order:'asc', column_name: ['INFO', 'DP']}]
                });
  });

  it('should reject invalid column names', function() {
    expectParse('C = 10', {error: 'Unknown field C'});
    expectParse('ORDER BY D ASC', {error: 'Unknown field D'});
    // multiple unknown fields only complain about the first
    expectParse('C = 10 ORDER BY D ASC', {error: 'Unknown field C'});
  });

  it('should reject syntax errors', function() {
    expectParse('ORDER', {error: 'SyntaxError'});
    expectParse('A >', {error: 'SyntaxError'});
  });
});
