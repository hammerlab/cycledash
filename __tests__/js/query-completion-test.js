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

  it('Should offer initial field completions', function() {
    assert.deepEqual(getCompletions('IN'), ['INFO.DP']);
  });

  it('Should offer ops', function() {
    assert.deepEqual(getCompletions('A '),
                     ['A <=', 'A <', 'A >=', 'A >', 'A =', 'A LIKE', 'A RLIKE']);
  });

  it('Should offer initial suggestions', function() {
    assert.deepEqual(getCompletions(''),
                     ['A', 'B', 'INFO.DP', 'ORDER', '20:']);
  });

  it('Should offer a sequence of ORDER BY completions', function() {
    assert.deepEqual(getCompletions('O'), ['ORDER']);
    assert.deepEqual(getCompletions('ORDER'), ['ORDER BY']);
    assert.deepEqual(getCompletions('ORDER BY '),
                     ['ORDER BY A', 'ORDER BY B', 'ORDER BY INFO.DP']);
    assert.deepEqual(getCompletions('ORDER BY A A'), ['ORDER BY A ASC']);
  });

  /*
  // This is difficult to implement for now because of the errors that peg.js returns.
  it('Should offer range suggestions', function() {
    assert.deepEqual(getCompletions('12', ['12:1,234-', '12:-4,567', '12:1,234-4,567']));
  });
  */

  it('Should complete AND', function() {
    assert.deepEqual(getCompletions('A > 10 A'), ['A > 10 AND']);
  });

  it('Should complete fields after AND', function() {
    assert.deepEqual(getCompletions('A=0 AND '),
                     ['A=0 AND A', 'A=0 AND B', 'A=0 AND INFO.DP', 'A=0 AND 20:']);
  });

  it('Should complete ORDER BY after filter', function() {
    assert.deepEqual(getCompletions('A=0 O'), ['A=0 ORDER']);
    assert.deepEqual(getCompletions('A=0 ORDER'), ['A=0 ORDER BY']);
  });

  it('Should complete compound ORDER BY columns', function() {
    assert.deepEqual(getCompletions('ORDER BY A, '), [
      'ORDER BY A, A',
      'ORDER BY A, B',
      'ORDER BY A, INFO.DP'
    ]);
  });
});


/*
To-do:
- Mandatory space: "ORDER BYA" and "A<10 ANDA>10" shouldn't be valid.
- Value completion that's aware of the current field
- Completion when the query is already valid.
- Normalized spacing: 'A>' should complete the same as 'A >'
~ Completion for range selections
*/
