/** @jsx */
"use strict";

var _ = require('underscore'),
    vcf = require('vcf.js');


/**
* Returns a string which uniquely identifies a record in a VCF.
*
* Used to test for record equality.
*/
function recordKey(record) {
  return record.__KEY__;
}

/**
 * Returns {truePositives, falsePositives, falseNegatives} for the given records
 * and truthRecords.
 */
function trueFalsePositiveNegative(records, truthRecords) {
  var truePositives = 0,
      falsePositives = 0,
      falseNegatives = 0;

  for (var i = 0; i < records.length; i++) {
    // NB: we don't ignore filtered out records
    var record = records[i];
    if (match(record, truthRecords)) {
      truePositives += 1;
    } else {
      falsePositives += 1;
    }
  }
  falseNegatives = truthRecords.length - truePositives;

  return {truePositives, falsePositives, falseNegatives};
}

/**
 * Returns true if the record "matches" with a truth record.
 *
 * Matching means being equal to (in terms of the records' __KEY__) when looking
 * at SNV or INDEL, or overlapping when looking at SVs.
 */
function match(record, truthRecords) {
  if (record.isSv()) {
    var truthRecords = vcf.fetch(truthRecords, record.CHROM, record.POS, record.INFO.END),
        truthRecords = _.filter(truthRecords, (record) => record.isSv()),
        overlappingRecords = _.map(truthRecords, _.partial(doRecordsOverlap, record));
    return !!_.first(overlappingRecords);
  } else { // Then this is a SNV or INDEL, and we look for identity
    return !!_.findWhere(truthRecords, {__KEY__: record.__KEY__});
  }
}

/**
 * Returns {start, end} where start and end are the CIPOS-adjusted start and end
 * positions of the SV.
 */
function svEnds(record) {
  var start = record.POS,
      end = record.INFO.END,
      cipos = record.INFO.CIPOS,
      ciend = record.INFO.CIEND;

  if (cipos && cipos[0] < 0) start += cipos[0];
  if (ciend && ciend[0] > 0) end += ciend[0];

  return {start, end};
}

/**
 * Returns true if aRecord overlaps bRecord.
 *
 * Takes into account CIPOS and CIEND in the records, if they exist.
 *
 * NB: CI{POS,END} refers to a "confidence interval" around the record.
 */
function doRecordsOverlap(aRecord, bRecord) {
  var aEnds = svEnds(aRecord),
      bEnds = svEnds(bRecord);

  var startsBetween = aEnds.start >= bEnds.start && aEnds.start < bEnds.end,
      endsBetween = aEnds.end > bEnds.start && aEnds.end <= bEnds.end,
      encompasses = aEnds.start <= bEnds.start && aEnds.end >= bEnds.end;

  return startsBetween || endsBetween || encompasses;
}


module.exports = {
  trueFalsePositiveNegative: trueFalsePositiveNegative
};
