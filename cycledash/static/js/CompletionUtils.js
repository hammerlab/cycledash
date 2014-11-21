/**
 * Utility functions to help with query completion.
 *
 * These are exported from a separate module to facilitate testing.
 *
 * @jsx React.DOM
 */
'use strict';

var _ = require('underscore');

function isChar(letter) {
  return !!letter.match(/[A-Za-z0-9.:-]/);
}

// Tokenizes the string. Returns an array:
// [{token,start,stop}, {token,start,stop}, ...]
// where start/stop are the indices corresponding to the token in str.
// Whitespace tokens are removed. For example,
// 'A B' --> [{token:'A',start:0,stop:1}, {token:'B',start:2,stop:3}]
function tokenize(str) {
  var tokens = [];

  // Helpers to add a new token and add to an existing token.
  var newToken = (position) => {
    tokens.push({token: '', start: position, stop: position});
  };
  var addToToken = (position, character) => {
    var t = tokens[tokens.length - 1];
    t.token += character;
    t.stop = position + 1;
  };
  
  var inQuote = false, inWhitespaceRun = true;
  for (var i = 0; i < str.length; i++) {
    var c = str.charAt(i);
    if (c == ' ' && inWhitespaceRun) {
      continue;  // drop extra space
    }
    if (c == '"') {
      inQuote = !inQuote;
      inWhitespaceRun = false;
      if (inQuote) {
        newToken(i);
        addToToken(i, c);
      } else {
        addToToken(i, c);
        newToken(i);
      }
    } else if (c == ' ' && !inQuote && !inWhitespaceRun) {
      newToken(i);
      inWhitespaceRun = true;
    } else if (c != ' ' && inWhitespaceRun) {
      inWhitespaceRun = false;
      newToken(i);
      addToToken(i, c);
    } else if (!inQuote && i > 0 && isChar(c) != isChar(str.charAt(i-1))) {
      newToken(i);
      addToToken(i, c);
    } else {
      addToToken(i, c);
    }
  }
  return tokens.filter(token => token.token);
}

// Returns true if each character in shortStr can be matched to a character in
// longStr in an increasing sequence, e.g.
// _fuzzyStringMatch('Lncln', 'Lincoln') = true
// Case insensitive.
function _fuzzyStringMatch(shortStr, longStr) {
  shortStr = shortStr.toLowerCase();
  longStr = longStr.toLowerCase();
  // Walk through the two strings simultaneously.
  var i = 0, j = 0;
  for (; i < shortStr.length; i++) {
    var c = shortStr.charAt(i);
    for (; j < longStr.length; j++) {
      if (c == longStr.charAt(j)) {
        break;
      }
    }
    if (j == longStr.length) return false;
  }
  return true;
}

// shortStr is a 'fuzzy match' for longStr if its last token is a fuzzy match
// and all other tokens are exact matches.
//
// This returns false if there is no match.
// It returns shortStr with the next token added in the case of a match, or
// replaced in the case of a fuzzy match.
//
// fuzzyMatch('Abe C',       'Abe C Lincoln') --> 'Abe C Lincoln'
// fuzzyMatch('Abe C Lncln', 'Abe C Lincoln') --> 'Abe C Lincoln'
// fuzzyMatch('b C Lincoln', 'Abe C Lincoln') --> false
function fuzzyMatch(shortStr, longStr) {
  var shortTokens = tokenize(shortStr);
  var longTokens = tokenize(longStr);

  if (longTokens.length < shortTokens.length) return false;
  if (shortTokens.length === 0) {
    return longTokens[0].token;
  }

  // only do fuzzy match on the last token if it's still being typed.
  var fuzzy = (shortStr.slice(-1) !== ' ');

  var exactMatch = (i) => (shortTokens[i].token.toLowerCase() ===
                           longTokens[i].token.toLowerCase());
  var fuzzyMatch = (i) => _fuzzyStringMatch(shortTokens[i].token, longTokens[i].token);

  var numExact = shortTokens.length - (fuzzy ? 1 : 0);
  for (var i = 0; i < numExact; i++) {
    if (!exactMatch(i)) return false;
  }
  if (fuzzy) {
    if (exactMatch(numExact)) {
      // if it's an exact match, go ahead and give the next token.
      numExact++;
    } else if (!fuzzyMatch(numExact)) {
      return false;
    }
  }

  // Offer the original string, plus the next token from the completion.
  // (Or replace the last token of the original string for a fuzzy match.)
  var base = '';
  if (numExact) {
    base = shortStr.slice(0, shortTokens[numExact - 1].stop) + ' ';
  }
  return base + longTokens[numExact].token;
}

// Filter down to queries which are "fuzzy matches".
// Returns {query, completion} objects for each fuzzy match.
// The "completion" value is the input query with the next token added.
function fuzzyFilter(list, query) {
  return _.compact(list.map(item => {
    var m = fuzzyMatch(query, item);
    if (m) {
      return {query: item, completion: m};
    } else {
      return null;
    }
  }));
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
}

// Pops off the last token of a string.
// Returns [rest of string, last token].
// This leaves trailing whitespace on the string.
// e.g. 'ORDER BY IN' --> ['ORDER BY ', 'IN']
//      'ORDER BY ' --> ['ORDER BY ', '']
function splitLastToken(str) {
  var m = str.match(/[^ ]+$/);
  if (m) {
    return [str.slice(0, m.index), str.slice(m.index)];
  } else {
    return [str, ''];
  }
}

module.exports = {
  cartesianProductOf,
  fuzzyMatch,
  fuzzyFilter,
  flatMap,
  splitLastToken,
  tokenize
};
