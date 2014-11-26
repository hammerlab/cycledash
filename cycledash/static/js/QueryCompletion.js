/**
 * This module provides query completion (typeahead) for the CQL language.
 * For example, when given "ORD" it will return ["ORDER"] as a possible
 * completion.
 *
 * This works by interpreting the detailed SyntaxError structure that the
 * PEG.js parser returns on invalid inputs. This structure indicates where the
 * syntax error began and which types of expressions it was expecting.
 *
 * This completion engine fills in all possible values of each expression type
 * to build a set of possible completions. It then culls this set down to those
 * which parse correctly and are extensions of what the user has typed.
 */
'use strict';

var _ = require('underscore');
var {
  cartesianProductOf,
  flatMap,
  fuzzyFilter,
  splitLastToken
} = require('./CompletionUtils.js');

// -- Utility methods --

// Legal operators in the CQL language.
var operators = [
  '<=',
  '<',
  '>=',
  '>',
  '=',
  'LIKE',
  'RLIKE'
];

// Takes the cartesian product of its args (all lists) and joins them on ' '.
function concatProductOf() {
  return cartesianProductOf.apply(null, arguments).map(p => p.join(' '));
}

// Given a PEG.js expectation object, return possible strings which could
// fulfill that expectation, e.g. 'filter' -> 'A = 0'.
function completionsForExpectation(expectation, columnNames, rejectedText) {
  switch (expectation.description) {
    case 'filter':
      // Return columns x operators x {0}
      return concatProductOf(columnNames, operators, ['0']);

    case 'field':
      return columnNames;

    case '"ORDER BY"':
      return concatProductOf(["ORDER BY"], columnNames);

    case '"AND"':
      // Just need one valid completion.
      return ["AND " + columnNames[0] + " = 0"];

    case 'range':
      if (rejectedText === '') {
        return ['20:'];
      }
      return [rejectedText + '-'];

    default:
      if (expectation.type == 'literal') {
        return [expectation.value];  // give it a try, it might just work!
      }
      return [];
  }

  throw "Shouldn't get here.";
}

// Workhorse function: given a query prefix, return a list of completions
function getCompletions(query, parse, columnNames) {
  var completions = [];

  if (query === '') {
    // Initial possibilities: filter, order, range
    // Only the first token matters for completion, but these need to be valid
    // queries in order to not be filtered out later.
    completions = completions
        .concat(columnNames.map(c => c + ' = 0'))
        .concat(['ORDER BY ' + columnNames[0]])
        .concat(['20:']);
  }

  var parsedQuery = parse(query, columnNames);
  if (parsedQuery.error) {
    if (parsedQuery.original && parsedQuery.original.expected) {
      var expected = parsedQuery.original.expected;
      // If it expected whitespace, add it on and try again.
      if (expected.length == 1 && expected[0].description == 'required whitespace') {
        return getCompletions(query + ' ', parse, columnNames);
      }

      // Build out completions for each possibility
      var start = query.substr(0, parsedQuery.original.offset);
      var rejectedText = query.substr(parsedQuery.original.offset);
      var newCompletions = flatMap(expected, function(e) {
        return _.map(completionsForExpectation(e, columnNames, rejectedText),
                     completion => start + completion);
      });
      completions = completions.concat(newCompletions);
    } else {
      // Probably an invalid column name. Pop off the last token and try
      // completing column names. Fuzzy matching happens below.
      var [subquery, lastToken] = splitLastToken(query);
      completions = completions.concat(concatProductOf([subquery], columnNames));
    }
  } else {
    // It's a valid query! Nothing to do...
  }

  // Filter down to completions which extend the query.
  completions = fuzzyFilter(completions, query);

  // Filter down to completions which parse.
  completions = _.filter(completions, function({query, oneToken}) {
    var parsedQuery = parse(query, columnNames);
    return !parsedQuery.hasOwnProperty('error');
  });

  // Only offer one token at a time.
  completions = _.uniq(_.compact(_.pluck(completions, 'completion')));

  return completions;
}

/**
 * Returns a typeahead.js-compatible completion source for a CQL grammar.
 * - parse is the PEG.js parse function
 * - columnNames is a list of column names which may be used in the grammar.
 *
 * The returned function takes a query prefix and calls a callback with
 * possible completions.
 *
 * For example, if columnNames=['A', 'B'], then:
 * 'ORDER BY ' -> callback([{value: 'ORDER BY A'}, {value: 'ORDER BY B'}])
 */
function createTypeaheadSource(parse, columnNames) {
  return function(query, callback) {
    callback(getCompletions(query, parse, columnNames).map(v => ({value:v})));
  };
}

module.exports = {
  createTypeaheadSource,
  getCompletions
};
