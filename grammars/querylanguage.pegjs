/**
 * peg.js grammar for Cycledash Query Language (CQL)
 *
 * Sample queries that it can parse:
 *   A < 10
 *   B = ABC
 *   20:
 *   20:1234-
 *   20:-4,567
 *   X:345-4,567
 *   ORDER BY A
 *   ORDER BY B DESC
 *   ORDER BY A, INFO.DP ASC
 *   A < 10 AND B >= ABC
 *   20:1234- AND A < 10
 *   A <= 10 and X:345-4,567 and B = ABC ORDER BY INFO.DP ASC
 */

start
  = frs:filters_and_ranges ws obs:order_by*
    { return [].concat(frs || []).concat(obs || []) }

ws "whitespace" = [ \t\n\r]*
and = ws "AND"i ws
doublequote = '"'
singlequote = "'"

filters_and_ranges
  = (
      first:filter_or_range
      rest:(and v:filter_or_range { return v; })*
      { return [first].concat(rest); }
    )?

filter_or_range
  = filter
  / range

filter "filter"
  = k:field ws op:op ws v:value { return {type: 'filter', field: k, op: op, value: v} }

field "field"
  = chars:[0-9a-z.]i+ { return chars.join(''); }

value "value"
  = chars:[0-9a-z.]i+ { return chars.join(''); }
  / doublequote chars:[^"]* doublequote { return chars.join(''); }
  / singlequote chars:[^']* singlequote { return chars.join(''); }

op "op"
  = "<="
  / "<"
  / ">="
  / ">"
  / "="
  / "LIKE"i { return "LIKE"; }
  / "RLIKE"i { return "RLIKE"; }

range "range"
  = contig:contig ":" range:range_range?
    { return { type: 'range', contig: contig, range: range } }

contig
  = chars:[0-9]+  { return chars.join('') }
  / "X"
  / "Y"

range_range
  = start:(comma_num)? "-" end:(comma_num)?
    { return {start: start, end: end} }

comma_num "number with commas"
  = chars:[0-9,]+ { return parseInt(chars.join(',').replace(/,/g, ''), 10) }

order_by
  = "ORDER BY"i ws field_list:order_field_list
    { return { type: 'sort', fields: field_list } }

order_field
  = field:field ws order:("ASC"i / "DESC"i)?
    { return {field: field, order: order} }

order_field_list
  = first:order_field rest:(ws "," ws v:order_field { return v; })*
    { return [first].concat(rest); }
