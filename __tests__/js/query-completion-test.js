/** @jsx React.DOM */

var _ = require('underscore'),
    assert = require('assert'),
    QueryLanguage = require('../../cycledash/static/js/QueryLanguage.js'),
    QueryCompletion = require('../../cycledash/static/js/QueryCompletion.js');

describe('Query Completion', function() {
  var columns = ['A', 'B', 'INFO.DP'];
  var completer = QueryCompletion.createTypeaheadSource(QueryLanguage.parse, columns);

  // Returns a list of possible complete queries.
  function getCompletions(prefix) {
    var results = null;
    // In principle the callback could be async, but we know that it's not.
    completer(prefix, (v) => { results = v; });
    assert.ok(results);
    return results.map((v) => v.value);
  }

  function assertCompletions(prefix, expectedCompletions) {
    assert.deepEqual(getCompletions(prefix), expectedCompletions);
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
                     ['A', 'B', 'INFO.DP', 'ORDER', '20:']);
  });

  it('Should offer a sequence of ORDER BY completions', function() {
    assertCompletions('O', ['ORDER']);
    assertCompletions('ORDER', ['ORDER BY']);
    assertCompletions('ORDER BY ',
                     ['ORDER BY A', 'ORDER BY B', 'ORDER BY INFO.DP']);
    assertCompletions('ORDER BY A A', ['ORDER BY A ASC']);
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
                     ['A=0 AND A', 'A=0 AND B', 'A=0 AND INFO.DP', 'A=0 AND 20:']);
  });

  it('Should complete ORDER BY after filter', function() {
    assertCompletions('A=0 O', ['A=0 ORDER']);
    assertCompletions('A=0 ORDER', ['A=0 ORDER BY']);
  });

  it('Should complete compound ORDER BY columns', function() {
    assertCompletions('ORDER BY A, ', [
      'ORDER BY A, A',
      'ORDER BY A, B',
      'ORDER BY A, INFO.DP'
    ]);
  });
});


/*
To-do:
- "ORDER BY I" doesn't complete to "ORDER BY INFO.DP".
- Mandatory space: "ORDER BYA" and "A<10 ANDA>10" shouldn't be valid.
- Value completion that's aware of the current field
- Completion when the query is already valid.
- Normalized spacing: 'A>' should complete the same as 'A >'
~ Completion for range selections
*/
