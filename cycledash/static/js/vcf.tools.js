(function() {
"use strict";

function passes(record) {
  if (!record.FILTER || _.contains(record.FILTER, 'PASS')) return true;
  return false;
}

function recordKey(record) {
  // Returns a string that uniquely identifies a record in a VCF.
  //
  // Used to test for record equality.
  return String(record.CHROM) + '-' + String(record.POS) + ':' + String(record.REF) + ':' + String(record.ALT);
}

function recordsIn(records, range) {
  return _.filter(records, _.partial(within, range));
}

function within(range, record) {
  // Returns true if the record is within the range.
  //
  // Range is object with either a stand and end
  // a chromosome number or M, or an empty object signifying that the range is
  // the entire sequence. (NB: exclusive start, inclusive end)
  var start = range.start,
      end = range.end,
      chromosome = range.chromosome;
  if (start && end) {
    return recorde.POS > start && record.POS <= end;
  } else if (chromosome) {
      throw {message: "not implemented"};
  } else { // then "All" is in range
    return true;
  }
}

function truePositives(passing_truth, passing_submission, range) {
  var truths = recordsIn(passing_truth, range),
      subs = recordsIn(passing_submission, range);
  return intersection(truths, subs);
}

function falsePositives(passing_truth, passing_submission, range) {
  var truths = recordsIn(passing_truth, range),
      subs = recordsIn(passing_submission, range);
  return difference(subs, truths);
}

function falseNegatives(passing_truth, passing_submission, range) {
  var truths = recordsIn(passing_truth, range),
      subs = recordsIn(passing_submission, range);
  return difference(truths, subs);
}

function precision(passing_truth, passing_submission, range) {
  var truths = recordsIn(passing_truth, range),
      subs = recordsIn(passing_submission, range),
      truePos = truePositives(passing_truth, passing_submission, range),
      falsePos = falsePositives(passing_truth, passing_submission, range);
  return  len(truePos) / (len(truePos) + len(falsePos));
}

function recall(passing_truth, passing_submission, range) {
  var truths = recordsIn(passing_truth, range),
      subs = recordsIn(passing_submission, range),
      truePos = truePositives(passing_truth, passing_submission, range);
  return len(truePos) / len(truths);
}

function f1score(passing_truth, passing_submission, range) {
  var recall = recall(passing_truth, passing_submission, range),
      precision = precision(passing_truth, passing_submission, range);
  return 2 * (recall * precision) / (recall + precision);
}

function difference(a, b) {
  // NB: expects a, b to have unique records.
  return _.reject(a, function(el_a) {
    return _.find(b, function(el_b) {
      return recordKey(el_a) === recordKey(el_b);
    });
  });
}

function intersection(a, b) {
  // NB: expects a, b to have unique records.
  return _.filter(a, function(el_a) {
    return _.find(b, function(el_b) {
      return recordKey(el_a) === recordKey(el_b);
    });
  });
}


})()
