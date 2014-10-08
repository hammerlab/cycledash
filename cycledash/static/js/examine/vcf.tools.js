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

function chromosomeComparator(a, b) {
  var aChr = Number(a) || a,
      bChr = Number(b) || b;
  if (aChr == bChr)
    return 0;
  else if (_.isString(aChr) && _.isString(bChr))
    return aChr < bChr ? -1 : 1; // we want alphabetical ordering
  else if (_.isNumber(aChr) && _.isNumber(bChr))
    return aChr > bChr ? 1 : -1;
  else if (_.isString(aChr))
    return 1
  else
    return -1;
}

function recordComparator(direction) {
  return function(a, b) {
    if (direction === 'desc' || !direction) {
      return chromosomeComparator(a.CHROM, b.CHROM) || (a.POS - b.POS);
    } else if (direction === 'asc') {
      return chromosomeComparator(b.CHROM, a.CHROM) || (b.POS - a.POS);
    }
  }
}

/**
 * Returns {truePositives, falsePositives, falseNegatives} for the given records
 * and truthRecords.
 *
 * NB: We don't ignore filtered out records in this calculation.
 */
function trueFalsePositiveNegative(records, truthRecords) {
  // We can quickly get t/f/p/n for SNVs and INDELs, so pull them out:
  var [svRecords, records] = _.partition(records, (record) => record.isSv()),
      [svTruths, truths] = _.partition(truthRecords, (record) => record.isSv()),
      {truePositives, falsePositives, falseNegatives} = trueFalsePositiveNegativeForSnvAndIndels(records, truths),
      svTFPN = trueFalsePositiveNegativeForSvs(svRecords, svTruths);

  truePositives += svTFPN.truePositives;
  falsePositives += svTFPN.falsePositives;
  falseNegatives += svTFPN.falseNegatives;

  return {truePositives, falsePositives, falseNegatives};
}

/**
 * Fast (O(n)) way to find true/false/pos/neg for SNVs and INDELs.  This is
 * largely a performance optimization. First sorts both arrays, so we get some
 * slowdown there, but this is negligible compared to the alternative.
 */
function trueFalsePositiveNegativeForSnvAndIndels(records, truthRecords) {
  var recordKey = (record) => record.__KEY__; // We sort on this lexicographic key.

  // In order to quickly find t/f/p/n we need to sort our records.
  var records = _.sortBy(records, '__KEY__'),
      truths = _.sortBy(truthRecords, '__KEY__');

  // Indexes into records, truth (respectively).
  var ri = 0,
      ti = 0;

  var truePositives = 0,
      falsePositives = 0,
      falseNegatives = 0;

  while (ri < records.length) {
    if (ti >= truths.length) {
      // Then we're done going through truths, so the remaining elements in
      // records are false.
      falsePositives += records.slice(ri).length;
      ri = records.length; // terminate loop
    } else if (recordKey(records[ri]) < recordKey(truths[ti])) {
      // Then the record at ri doesn't appear in truth, so it's false.
      falsePositives += 1;
      ri++;
    } else if (recordKey(records[ri]) > recordKey(truths[ti])) {
      // Then we need to move forward through truths to see if the record at ri
      // is there, later.
      ti++;
    } else {
      // Then they're equal, so it's a true positive.
      truePositives += 1;
      ri++; ti++;
    }
  }

  // The records in truth that we didn't call correctly are false negatives.
  falseNegatives = truths.length - truePositives;

  return {truePositives, falsePositives, falseNegatives};
}

/**
 * Return the true/false/pos/neg for SVs.
 *
 * NB: O(n*m), but generally the number of SVs is low, so this should be okay
 * for most cases.
 */
function trueFalsePositiveNegativeForSvs(records, truthRecords) {
  var truePositives = 0,
      falsePositives = 0,
      falseNegatives = 0;

  for (var i = 0; i < records.length; i++) {
    var record = records[i];
    if (svMatch(record, truthRecords)) {
      truePositives += 1;
    } else {
      falsePositives += 1;
    }
  }
  falseNegatives = truthRecords.length - truePositives;

  return {truePositives, falsePositives, falseNegatives};
}

/**
 * Returns true if the SV record "matches" with a truth record.
 *
 * Matching means "overlapping/within the confidence interval" for SVs.
 */
function svMatch(record, truthRecords) {
  var truthRecords = vcf.fetch(truthRecords, record.CHROM, record.POS, record.INFO.END),
      overlappingRecords = _.map(truthRecords, _.partial(doRecordsOverlap, record));
  return !!_.first(overlappingRecords);
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

/**
 * Derives groups of columns from the VCF data.
 * Columns to be displayed: {INFO: {attr1: {path: ['INFO', 'attr1'],
 *                                          name: 'attr1',
 *                                          info: <attr spec from header>} },
 *                           sampleName1: {attrA:  ..}, ..}
 *
 * NB: Rather than pulling this from the header's INFO and FORMAT fields,
 *     we pull the columns from the records themselves, as sometimes the
 *     header contains many more FORMAT and INFO fields than are actually
 *     used.
 *
 *     This would waste a ton of horizontal space in the VCF table.
 *
 *     It's worth noting, too, that in current JS implementations object
 *     key/vals stay ordered as inserted, unless a key is a number type.
 *     This is nice, becauce it keeps the columns displayed in the table in
 *     order.
 */
function deriveColumns(vcfData) {
  var header = vcfData.header,
      records = vcfData.records;
  var columns = _.reduce(header.sampleNames, (columns, name) => {
    columns[name] = {};
    return columns;
  }, {'INFO': {}});
  _.each(records, function(record) {
    _.each(_.keys(columns), function(topLevelAttr) {
      var subCols = record[topLevelAttr];
      for (var attr in subCols) {
        var info = topLevelAttr == 'INFO' ? _.findWhere(header.INFO, {ID: attr})
                                          : _.findWhere(header.FORMAT, {ID: attr});
        columns[topLevelAttr][attr] = {path: [topLevelAttr, attr], info: info, name: attr};
      }
    });
  });
  // If there are no minor columns in a major, remove the major.
  var emptyMajors = [];
  _.each(columns, function(minors, majorName) {
    if (_.keys(minors).length === 0) emptyMajors.push(majorName);
  });
  _.each(emptyMajors, function(majorName) {
    delete columns[majorName];
  });
  return columns;
}


module.exports = {
  trueFalsePositiveNegative: trueFalsePositiveNegative,
  trueFalsePositiveNegativeForSvs: trueFalsePositiveNegativeForSvs,
  trueFalsePositiveNegativeForSnvAndIndels: trueFalsePositiveNegativeForSnvAndIndels,
  chromosomeComparator: chromosomeComparator,
  recordComparator: recordComparator,
  deriveColumns: deriveColumns
};
