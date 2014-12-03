'use strict';

var _ = require('underscore'),
    assert = require('assert'),
    QueryLanguage = require('../../cycledash/static/js/QueryLanguage.js');


describe('Query Language', function() {
  describe('parse', function() {
    var columns = ['A', 'B', 'INFO.DP', 'INFO:AF'];

    function expectParse(query, expectedResult) {
      var result = QueryLanguage.parse(query, columns);
      if ('error' in result) {
        result = {error: result.error};  // no need to match the full details.
      }
      assert.deepEqual(result, expectedResult);
    }

    it('should parse simple filters', function() {
      expectParse('A < 10', {filters:[{type: '<', filterValue:'10', columnName:'A'}]});
      expectParse('B = ABC', {filters:[{type: '=', filterValue:'ABC', columnName:'B'}]});
      expectParse('INFO.DP like "ABC"', {
        filters:[{type: 'LIKE', filterValue:'ABC', columnName:'INFO.DP'}]
      });
      expectParse('INFO:AF rlike "^.*$"', {
        filters:[{type: 'RLIKE', filterValue:'^.*$', columnName:'INFO:AF'}]
      });
    });

    it('should parse ranges', function() {
      expectParse('20:', {range: {contig: '20'}});
      expectParse('20:1234-', {range: {contig: '20', start: '1234'}});
      expectParse('20:-4,567', {range: {contig: '20', end: '4567'}});
      expectParse('X:345-4,567', {range: {contig: 'X', start: '345', end: '4567'}});
    });

    it('should parse simple order bys', function() {
      expectParse('ORDER BY A', {sortBy:[{order:'asc', columnName: 'A'}]});
      expectParse('ORDER BY B DESC', {sortBy:[{order:'desc', columnName: 'B'}]});
      expectParse('ORDER BY INFO.DP ASC', {sortBy:[{order:'asc', columnName: 'INFO.DP'}]});
    });

    it('should parse quoted filters with spaces', function() {
      expectParse('A like \'A"" C\'', {filters:[{type: 'LIKE', filterValue:'A"" C', columnName:'A'}]});
    });

    it('should parse compound filters', function() {
      expectParse('A < 10 AND B >= ABC', {
        filters: [
          {type: '<', filterValue:'10', columnName:'A'},
          {type: '>=', filterValue:'ABC', columnName:'B'}
        ]
      });
    });

    it('should parse compound filters with ranges', function() {
      expectParse('20:1234- AND A < 10', {
        range: {contig:'20', start: '1234'},
        filters: [{type: '<', filterValue: '10', columnName: 'A'}]
      });
    });

    it('should parse compound order bys', function() {
      expectParse('ORDER BY A, B', {
        sortBy:[{order:'asc', columnName: 'A'},
                {order:'asc', columnName: 'B'}]
      });

      expectParse('ORDER BY A DESC, B', {
        sortBy:[{order:'desc', columnName: 'A'},
                {order:'asc', columnName: 'B'}]
      });

      expectParse('ORDER BY A ASC, B ASC', {
        sortBy:[{order:'asc', columnName: 'A'},
                {order:'asc', columnName: 'B'}]
      });

      expectParse('ORDER BY A ASC, B, INFO.DP DESC', {
        sortBy:[{order:'asc', columnName: 'A'},
                {order:'asc', columnName: 'B'},
                {order:'desc', columnName: 'INFO.DP'}]
      });
    });

    it('should parse everything together', function() {
      expectParse('A <= 10 AND X:345-4,567 AND B = ABC ORDER BY INFO.DP ASC',
                  {
                    range: {contig: 'X', start: '345', end: '4567'},
                    filters: [
                      {type: '<=', filterValue: '10', columnName: 'A'},
                      {type: '=', filterValue: 'ABC', columnName: 'B'}
                    ],
                    sortBy:[{order:'asc', columnName: 'INFO.DP'}]
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
      expectParse('A > 0 ANDB < 0', {error: 'SyntaxError'});
      expectParse('ORDER BYB', {error: 'SyntaxError'});
    });

  });

  describe('toString', function() {
    var toString = QueryLanguage.toString;

    it('should serialize range queries', function() {
      assert.equal(toString({range: {contig: '20'}}), '20:');
      assert.equal(toString({range: {contig: '20', start: 1234}}), '20:1234-');
      assert.equal(toString({range: {contig: '20', end: 1234}}), '20:-1234');
      assert.equal(toString({range: {contig: '20', start: 1234, end:4567}}),
                   '20:1234-4567');
      assert.equal(toString({range: {contig: null, start: null, end:null}}), '');
    });

    it('should serialize filters', function() {
      assert.equal(
          toString({filters: [{columnName: 'A', type: '>', filterValue: '10'}]}),
          'A > 10');
      assert.equal(toString({filters: [
              {columnName: 'A', type: '>', filterValue: '10'},
              {columnName: 'B', type: '<=', filterValue: 'CDE'}]}),
          'A > 10 AND B <= CDE');
    });

    it('should serialize order bys', function() {
      assert.equal(toString({sortBy: [{columnName: 'A', order: 'asc'}]}),
                   'ORDER BY A');
      assert.equal(toString({sortBy: [{columnName: 'A', order: 'desc'}]}),
                   'ORDER BY A DESC');
      assert.equal(toString({sortBy: [{columnName: 'A', order: 'desc'},
                                      {columnName: 'B', order: 'asc'}]}),
                   'ORDER BY A DESC, B');
    });

    it('should quote literals', function() {
      var makeFilter = filterValue => ({filters:[{columnName: 'A', type: '>', filterValue}]});
      assert.equal(toString(makeFilter(`ABC`)), 'A > ABC');
      assert.equal(toString(makeFilter(`A B C`)), `A > 'A B C'`);
      assert.equal(toString(makeFilter(`A,B,C`)), `A > 'A,B,C'`);
      assert.equal(toString(makeFilter(`A"B"C`)), `A > 'A"B"C'`);
      assert.equal(toString(makeFilter(`A'B'C`)), `A > "A'B'C"`);
      assert.equal(toString(makeFilter(`A'B'C`)), `A > "A'B'C"`);
      assert.equal(toString(makeFilter(`A"'B'"C`)), `A > 'A"\\'B\\'"C'`);
      assert.equal(toString(makeFilter(`A\\"'B\\'"C`)), `A > 'A\\\\"\\'B\\\\\\'"C'`);
    });

    it('should be the inverse of parse()', function() {
      var columns = ['A', 'B', 'INFO.DP', 'annotations:gene_name'];
      var assertInverse = function(str) {
        assert.equal(toString(QueryLanguage.parse(str, columns)), str);
      };

      assertInverse('A > 0');
      assertInverse('A > 0 AND B < 123');
      assertInverse(`A > 0 AND B LIKE '^...A$'`);
      assertInverse(`A = 0 AND annotations:gene_name RLIKE '^...A$'`);
      assertInverse(`A >= 0 ORDER BY B`);
      assertInverse(`A >= 0 ORDER BY B DESC`);
      assertInverse(`A >= 0 ORDER BY B DESC, INFO.DP`);
      assertInverse(`20: AND A <= 0 ORDER BY B DESC, INFO.DP`);
      assertInverse(`20:-123 AND A <= 0 ORDER BY B DESC, INFO.DP`);
      assertInverse(`20:123- AND A <= 0 ORDER BY B DESC, INFO.DP`);
      assertInverse(`X:123-456 AND A <= 0 ORDER BY B DESC, INFO.DP`);
    });
  });

  it('should have a working isEquivalent', function() {
    var columns = ['A', 'B', 'INFO.DP', 'annotations:gene_name'];
    var parse = str => QueryLanguage.parse(str, columns);
    var eq = QueryLanguage.isEquivalent;

    assert.ok( eq({filters: [{columnName: 'A', type: '<', filterValue: '0'}]},
                  {filters: [{columnName: 'A', type: '<', filterValue: '0'}]}));
    assert.ok(!eq({filters: [{columnName: 'A', type: '>', filterValue: '0'}]},
                  {filters: [{columnName: 'A', type: '<', filterValue: '0'}]}));

    assert.ok( eq(parse('A > 0 AND B < 0'),
                  parse('B < 0 AND A > 0')));
    assert.ok( eq(parse('20: AND A > 0 AND B < 0'),
                  parse('B < 0 AND A > 0 AND 20:')));
    assert.ok(!eq(parse('A > 0 AND B < 0'),
                  parse('B < 0 AND A > 1')));
    assert.ok( eq(parse('ORDER BY A, B'),
                  parse('order by A asc, B asc')));
    assert.ok(!eq(parse('ORDER BY A, B'),
                  parse('ORDER BY B, A')));
    assert.ok(!eq(parse('ORDER BY A, B'),
                  parse('ORDER BY A DESC, B')));
  });
});
