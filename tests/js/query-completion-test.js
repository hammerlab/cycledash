var _ = require('underscore'),
    assert = require('assert'),
    QueryLanguage = require('../../cycledash/static/js/QueryLanguage.js'),
    QueryCompletion = require('../../cycledash/static/js/QueryCompletion.js');

describe('Query Completion', function() {
  var defaultColumns = ['A', 'B', 'INFO.DP', 'sample:GQ'];
  var filterPrefix = QueryCompletion.filterPrefix;

  // Returns a list of possible complete queries.
  function getCompletions(prefix, columns) {
    return QueryCompletion.getCompletions(prefix, QueryLanguage.parse, columns);
  }

  // Call either as:
  // assertCompletions(prefix, expected completions)
  // assertCompletions(prefix, columns, expected completions)
  function assertCompletions(prefix, columns, expectedCompletions) {
    if (arguments.length == 2) {
      return assertCompletions(prefix, defaultColumns, columns);
    }
    assert.deepEqual(getCompletions(prefix, columns), expectedCompletions);
  }

  it('Should offer initial field completions', function() {
    assertCompletions('IN', ['INFO.DP']);
  });

  it('Should offer ops', function() {
    assertCompletions('A ',
                     ['A <=', 'A <', 'A >=', 'A >', 'A =', 'A LIKE', 'A RLIKE']);
  });

  it('Should offer initial suggestions', function() {
    assertCompletions('',
                     ['A', 'B', 'INFO.DP', 'sample:GQ', 'ORDER', '20:']);
  });

  it('Should offer a sequence of ORDER BY completions', function() {
    assertCompletions('O', ['ORDER', 'INFO.DP']);
    assertCompletions('ORDER', ['ORDER BY']);

    assertCompletions('ORDER BY',
                     ['ORDER BY A',
                      'ORDER BY B',
                      'ORDER BY INFO.DP',
                      'ORDER BY sample:GQ']);

    assertCompletions('ORDER BY ',
                     ['ORDER BY A',
                      'ORDER BY B',
                      'ORDER BY INFO.DP',
                      'ORDER BY sample:GQ']);

    assertCompletions('ORDER BY A A',
                     ['ORDER BY A ASC']);
  });

  it('Should auto-complete field names in ORDER BY', function() {
    assertCompletions('ORDER BY I', ['ORDER BY INFO.DP']);
    assertCompletions('ORDER BY IN', ['ORDER BY INFO.DP']);
    assertCompletions('ORDER BY INF', ['ORDER BY INFO.DP']);
    assertCompletions('ORDER BY INFO', ['ORDER BY INFO.DP']);
    assertCompletions('ORDER BY INFO.D', ['ORDER BY INFO.DP']);
    assertCompletions('ORDER BY INFO.DP', []);  // valid query
  });

  /*
  // This is difficult to implement for now because of the errors that peg.js returns.
  it('Should offer range suggestions', function() {
    assertCompletions('12', ['12:1,234-', '12:-4,567', '12:1,234-4,567']));
  });
  */

  it('Should complete AND', function() {
    assertCompletions('A > 10 A', ['A > 10 AND']);
  });

  it('Should complete fields after AND', function() {
    assertCompletions('A=0 AND ',
                     ['A=0 AND A',
                      'A=0 AND B',
                      'A=0 AND INFO.DP',
                      'A=0 AND sample:GQ',
                      'A=0 AND 20:']);
  });

  it('Should complete ORDER BY after filter', function() {
    assertCompletions('A=0 O', ['A=0 ORDER']);
    assertCompletions('A=0 ORDER', ['A=0 ORDER BY']);
  });

  it('Should complete compound ORDER BY columns', function() {
    assertCompletions('ORDER BY A, ', [
      'ORDER BY A, A',
      'ORDER BY A, B',
      'ORDER BY A, INFO.DP',
      'ORDER BY A, sample:GQ'
    ]);
  });

  it('Should work with lowercase keywords', function() {
    assertCompletions('A > 10 a', ['A > 10 AND']);
    assertCompletions('o', ['ORDER', 'INFO.DP']);  // fuzzy match
    assertCompletions('order', ['order BY']);
  });

  it('Should ignore extra/elided spaces', function() {
    assertCompletions('ORDER BY      I',
                     ['ORDER BY INFO.DP']);
    assertCompletions('order by      in',
                     ['order by INFO.DP']);

    assertCompletions('   ORDER BY      I',
                     ['   ORDER BY INFO.DP']);

    assertCompletions('A   ', [
                      'A <=',
                      'A <',
                      'A >=',
                      'A >',
                      'A =',
                      'A LIKE',
                      'A RLIKE'
                     ]);

    // Note: spacing a little odd here
    assertCompletions('A<', ['A <=', 'A< 0']);
  });

  it('Should ignore case in field names', function() {
    assertCompletions('in', ['INFO.DP']);
  });

  it('Should do fuzzy matching in field names', function() {
    assertCompletions('order by q', ['order by sample:GQ']);
    assertCompletions('order by DP', ['order by INFO.DP']);
    assertCompletions('q', ['sample:GQ']);
  });

  // Regression test for https://github.com/hammerlab/cycledash/issues/297
  it('Should complete names with underscores', function() {
    assertCompletions('annotations:gen',
                      ['annotations:gene_names'],  // columns
                      ['annotations:gene_names']);  // completions

    assertCompletions('annotations:gene_',
                      ['annotations:gene_names'],  // columns
                      ['annotations:gene_names']);  // completions
  });
});


/*
To-do:
- Value completion that's aware of the current field
- Completion when the query is already valid.
~ Completion for range selections
*/
