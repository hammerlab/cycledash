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
 *
 * @jsx React.DOM
 */
'use strict';

var _ = require('underscore');
var {
  cartesianProductOf,
  filterPrefix,
  firstToken,
  flatMap,
  normalizeSpacing,
  withoutLastToken
} = require('./CompletionUtils.js');

// -- Utility methods --

// Wrap each item in {value: ...}. This is what typeahead.js expects.
function valueify(list) {
  return list.map(value => ({value}));
}

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

// Given a PEG.js expectation object, return possible strings which could
// fulfill that expectation, e.g. 'filter' -> 'A = 0'.
function completionsForExpectation(expectation, columnNames, rejectedText) {
  switch (expectation.description) {
    case 'filter':
      // Return columns x operators x {0}
      // TODO: normalize spacing
      return cartesianProductOf(columnNames, operators, ['0']).map(p => p.join(' '));

    case 'field':
      return columnNames;

    case '"ORDER BY"':
      return cartesianProductOf(["ORDER BY"], columnNames).map(p => p.join(' '));

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
      var start = query.substr(0, parsedQuery.original.offset);
      var rejectedText = query.substr(parsedQuery.original.offset);
      var newCompletions = flatMap(parsedQuery.original.expected, function(e) {
        return _.map(completionsForExpectation(e, columnNames, rejectedText), function(completion) {
          return start + completion;
        });
      });
      completions = completions.concat(newCompletions);
    } else {
      // Probably an invalid column name. Pop off the last token and try to get completions.
      var subquery = withoutLastToken(query);
      completions = getCompletions(subquery, parse, columnNames);
    }
  } else {
    // It's a valid query! Nothing to do...
  }

  // Filter down to completions which extend the query.
  completions = filterPrefix(completions, query);

  // Filter down to completions which are grammatically valid.
  completions = _.filter(completions, function(query) {
    var parsedQuery = parse(query, columnNames);
    return !parsedQuery.hasOwnProperty('error');
  });

  // Only offer one whitespace-delimited token at a time.
  completions = _.uniq(_.compact(_.map(completions, completion => {
    var token = firstToken(completion.substr(query.length));
    return token && query + token;  // nulls are dropped by _.compact
  })));

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
