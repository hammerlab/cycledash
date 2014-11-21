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
// whitespace tokens are removed. For example,
// 'A B' --> [{token:'A',start:0,stop:1}, {token:'B',start:2,stop:3}]
function tokenize(str) {
  var tokens = [];
  var inQuote = false, inWhitespaceRun = true;

  var i, c;
  var newToken = () => {
    tokens.push({token: '', start: i, stop: i});
  };
  var addToToken = () => {
    var t = tokens[tokens.length - 1];
    t.token += c;
    t.stop = i + 1;
  };
  
  for (i = 0; i < str.length; i++) {
    c = str.charAt(i);
    if (c == ' ' && inWhitespaceRun) {
      continue;  // drop extra space
    }
    if (c == '"') {
      inQuote = !inQuote;
      inWhitespaceRun = false;
      if (inQuote) {
        newToken();
        addToToken();
      } else {
        addToToken();
        newToken();
      }
    } else if (c == ' ' && !inQuote && !inWhitespaceRun) {
      newToken();
      inWhitespaceRun = true;
    } else if (c != ' ' && inWhitespaceRun) {
      inWhitespaceRun = false;
      newToken();
      addToToken();
    } else if (!inQuote && i > 0 && isChar(c) != isChar(str.charAt(i-1))) {
      newToken();
      addToToken();
    } else {
      addToToken();
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
  var j = 0;
  for (var i = 0; i < shortStr.length; i++) {
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
// It returns shortStr with the next token added in the case of a match.
//
// fuzzyMatch('Abe C Lncln', Abe C Lincoln') --> 'Abe C Lincoln'
// fuzzyMatch('b C Lincoln', Abe C Lincoln') --> false
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
    if (exactMatch(i)) {
      // if it's an exact match, go ahead and give the next token.
      numExact++;
      fuzzy = false;
    } else if (!fuzzyMatch(i)) {
      return false;
    }
  }

  // Offer the original string, plus the next token from the completion.
  var base = '';
  if (numExact) {
    base = shortStr.slice(0, shortTokens[numExact - 1].stop) + ' ';
  }
  return base + longTokens[numExact].token;
}

// Filter down to queries which are "fuzzy matches".
// Returns {query, oneToken} objects for each fuzzy match.
// The "oneToken" value is the input query with the next token added.
function fuzzyFilter(list, query) {
  var o = [];
  return _.compact(list.map(item => {
    var m = fuzzyMatch(query, item);
    if (m) {
      return {query: item, oneToken: m};
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
