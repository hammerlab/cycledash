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
req_ws "required whitespace" = [ \t\n\r]+
and = "AND"i
doublequote = '"'
singlequote = "'"

filters_and_ranges
  = (
      first:filter_or_range
      rest:(req_ws and req_ws v:filter_or_range { return v; })*
      { return [first].concat(rest); }
    )?

filter_or_range
  = filter
  / range

filter "filter"
  = k:field ws op:op ws v:value { return {type: 'filter', field: k, op: op, filterValue: v} }
  / k:field req_ws op:nullcheck { return {type: 'filter', field: k, op: op} }

field "field"
  = chars:[0-9a-z.:_-]i+ { return chars.join(''); }

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
  / "!="
  / "LIKE"i { return "LIKE"; }
  / "RLIKE"i { return "RLIKE"; }

nullcheck "nullcheck"
  = "IS"i req_ws "NULL"i { return "NULL"; }
  / "IS"i req_ws "NOT"i req_ws "NULL"i { return "NOT NULL"; }

range "range"
  = contig:contig ":" range:range_range?
    { return { type: 'range', contig: contig, range: range } }

contig
  = chr:"chr"i? chars:[0-9]+  { return (chr || '') + chars.join('') }
  / "X"
  / "Y"

range_range
  = start:(comma_num)? "-" end:(comma_num)?
    { return {start: start, end: end} }

comma_num "number with commas"
  = chars:[0-9,]+ { return parseInt(chars.join(',').replace(/,/g, ''), 10) }

order_by
  = "ORDER BY"i req_ws field_list:order_field_list
    { return { type: 'sort', fields: field_list } }

order_field
  = field:field order:(req_ws ("ASC"i / "DESC"i))?
    { return {field: field, order: order && order[1]} }

order_field_list
  = first:order_field rest:(ws "," ws v:order_field { return v; })*
    { return [first].concat(rest); }
