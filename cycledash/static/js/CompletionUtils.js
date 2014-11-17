/**
 * Utility functions to help with query completion.
 *
 * These are exported from a separate module to facilitate testing.
 *
 * @jsx React.DOM
 */

var _ = require('underscore');

function isChar(letter) {
  return !!letter.match(/[A-Za-z0-9.:-]/);
}

// Normalize whitespace outside of quoted strings. Examples:
// "a  b    c" -> "a b c"
// "a>10" -> "a > 10"
function normalizeSpacing(str) {
  var normalized = '';
  var inQuote = false, inWhitespaceRun = true;
  for (var i = 0; i < str.length; i++) {
    var c = str.charAt(i);
    if (c == ' ' && inWhitespaceRun) {
      continue;  // drop extra space
    }
    if (c == '"') {
      inQuote = !inQuote;
      inWhitespaceRun = false;
      if (inQuote && normalized[normalized.length - 1] != ' ') {
        normalized += ' ';
      }
    } else if (c == ' ' && !inQuote && !inWhitespaceRun) {
      inWhitespaceRun = true;
    } else if (c != ' ' && inWhitespaceRun) {
      inWhitespaceRun = false;
    } else if (!inQuote && i > 0 && isChar(c) != isChar(str.charAt(i-1))) {
      normalized += ' ';  // add spaces around word boundaries.
    }
    normalized += c;
  }
  return normalized;
}

// Filter the list down to strings which start with prefix.
// This is case-insensitive. If a list item matches in everything but case, it
// will be "fixed", e.g. filterPrefix(['ABC'], 'a') -> ['aBC'].
function filterPrefix(list, prefix) {
  var normPrefix = normalizeSpacing(prefix).toLowerCase(),
      len = normPrefix.length;
  return list.filter(function(item) {
    return normalizeSpacing(item).slice(0, len).toLowerCase() == normPrefix;
  }).map(function(matchingItem) {
    return prefix + normalizeSpacing(matchingItem).slice(len);
  });
}

// Builds a new list by applying a function to all elements of the list and
// concatenating the resulting lists.
function flatMap(list, fn) {
  return _.flatten(_.map(list, fn), true /* shallow flatten */);
}

// Returns the cartesian product of its input lists, e.g.
// cartesianProductOf([1,2], [3,4]) -> [[1,3], [1,4], [2,3], [2,4]]
// Based on http://stackoverflow.com/a/12628791/388951
function cartesianProductOf() {
  return _.reduce(arguments, function(a, b) {
    return flatMap(a, function(x) {
      return _.map(b, y => x.concat([y]));
    });
  }, [[]]);
};

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

// Returns the string w/o the last token.
// e.g. "ORDER BY IN" --> "ORDER BY "
function withoutLastToken(str) {
  var m = str.match(/[^ ]+$/);
  if (m) {
    return str.slice(0, m.index);
  } else {
    return str;
  }
}

module.exports = {
  cartesianProductOf,
  filterPrefix,
  firstToken,
  flatMap,
  normalizeSpacing,
  withoutLastToken
};
