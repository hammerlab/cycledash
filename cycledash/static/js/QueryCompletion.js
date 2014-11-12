/** @jsx React.DOM */
var _ = require('underscore');

function isLiteral(expectation) {
  return expectation.type == 'literal';
}

// Filter the list down to strings which start with prefix.
function filterPrefix(list, prefix) {
  var len = prefix.length;
  return list.filter(function(item) {
    return item.substr(0, len) == prefix;
  });
}

// Wrap each item in {value: ...}
function valueify(list) {
  return list.map(function(item) { return {value: item}; });
}

function flatMap(list, fn) {
  return _.flatten(_.map(list, fn), true);
}

var operators = [
  '<=',
  '<',
  '>=',
  '>',
  '=',
  'LIKE',
  'RLIKE'
];

// See http://stackoverflow.com/a/12628791/388951
function cartesianProductOf() {
    return _.reduce(arguments, function(a, b) {
        return _.flatten(_.map(a, function(x) {
            return _.map(b, function(y) {
                return x.concat([y]);
            });
        }), true);
    }, [ [] ]);
};

// Given a PEG.js expectation object, return possible strings which could
// fulfill that expectation, e.g. 'filter' -> 'A = 0'.
function completionsForExpectation(expectation, columnNames, rejectedText) {
  switch (expectation.description) {
    case 'filter':
      // Return columns x operators x {0}
      // TODO: normalize spacing
      return cartesianProductOf(columnNames, operators, ['0']).map((p) => p.join(' '));

    case 'field':
      return columnNames;

    case '"ORDER BY"':
      return cartesianProductOf(["ORDER BY"], columnNames).map((p) => p.join(' '));

    case '"AND"':
      // Just need one valid completion.
      return ["AND " + columnNames[0] + " = 0"];

    case 'range':
      if (rejectedText == '') {
        return ['20:'];
      } else {
        return [rejectedText + '-'];
      }
      return [];

    default:
      if (expectation.type == 'literal') {
        return [expectation.value];  // give it a try, it might just work!
      }
      return [];
  }

  return [];
}

// Returns the first token in str,
// e.g. "foo bar" -> "foo", "  baz quux" -> "  baz".
function firstToken(str) {
  var m = str.match(/[ ]*[^ ]+/);
  if (m) {
    return m[0];
  } else {
    return null;
  }
}

function createTypeaheadSource(parse, columnNames) {

return function (query, callback) {
  var completions = [];

  if (query == '') {
    // Initial possibilities: filter, order, range
    completions = completions
        .concat(columnNames.map((c) => c + ' = 0'))
        .concat(['ORDER BY ' + columnNames[0]])
        .concat(['20:']);
  }

  var parsedQuery = parse(query, columnNames);
  if (parsedQuery.error) {
    if (parsedQuery.original && parsedQuery.original.expected) {
      // console.log(parsedQuery.original);
      // Possible completions are each literal.
      // A > "Foo" AN
      // 012345678901
      var start = query.substr(0, parsedQuery.original.offset);
      var rejectedText = query.substr(parsedQuery.original.offset);
      var newCompletions = flatMap(parsedQuery.original.expected, function(e) {
        return _.map(completionsForExpectation(e, columnNames, rejectedText), function(completion) {
          return start + completion;
        });
      });
      completions = completions.concat(newCompletions);
    } else {
      // Probably an invalid column name.
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
  completions = _.uniq(_.compact(_.map(completions, (completion) => {
    var token = firstToken(completion.substr(query.length));
    return token && query + token;  // nulls are dropped by _.compact
  })));

  // console.log(completions);
  callback(valueify(completions));
}

}

module.exports = {
  createTypeaheadSource
};
