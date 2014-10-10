/** @jsx React.DOM */
"use strict";

var types = require('./types'),
    vcf = require('vcf.js'),
    vcfTools = require('./vcf.tools.js'),
    utils = require('./utils.js'),
    _ = require('underscore')
    ;


// ---- Helper functions for filtering ---- \\

function isRecordCorrectVariantType(record, variantType) {
  switch (variantType) {
    case 'All':
      return true;
    case 'SNV':
      return record.isSnv();
    case 'INDEL':
      return record.isIndel();
    case 'SV':
      return record.isSv();
    default:
      throw "variantType must be one of All, SNV, SV, INDEL, is '" +
        variantType + "'";
  }
}

function isRecordWithinRange(record, position) {
  var {start, end, chromosome} = position;

  if (chromosome === idiogrammatik.ALL_CHROMOSOMES) {
    return true;
  } else if (record.CHROM !== chromosome) {
    return false;
  } else if (_.isNull(start) && _.isNull(end)) {
    return true;
  } else if (_.isNull(end)) {
    return record.POS >= start;
  } else if (_.isNull(start)) {
    return record.POS <= end;
  } else {
    return record.POS >= start && record.POS <= end;
  }
}

function doesRecordPassFilters(record, filters) {
  return _.reduce(filters, function(passes, filter) {
    var filterVal = filter.filter,
        valPath = filter.path,
        val = valPath ? utils.getIn(record, valPath) : null;
    if (!passes) return false;  // If one fails, they all fail.
    if (filterVal.length === 0) return true;

    if (_.contains(['<', '>'], filterVal[0])) {  // then do a numeric test
      val = Number(val);
      if (filterVal[0] === '>') {
        return val > Number(filterVal.slice(1));
      } else {
        return val < Number(filterVal.slice(1));
      }
    } else {  // treat it like a regexp, then...
      var re = new RegExp(filterVal);
      if (valPath[0] === types.REF_ALT_PATH[0]) {
        return re.test(record.REF + "/" + record.ALT);
      } else {  // this is a regular non-numeric column
        return re.test(String(val));
      }
    }
  }, true);
}

function filterRecords(records /*, predicates */) {
  var predicates = _.rest(_.toArray(arguments), 1)
  return _.filter(records, (record) => {
    return _.every(_.map(predicates, (pred) => pred(record)));
  });
}

function cloneDeep(state) {
  return JSON.parse(JSON.stringify(state));
}


/**
 * This is a data model for CycleDash's examine page.
 */
class DataModel {
  constructor(runVcfData, truthVcfData) {
    this.vcfData = runVcfData;
    this.truthVcfData = truthVcfData;

    // Last state for which filtered [truth] records were computed.
    // {variantType,filters,position,sortBy}
    this.lastState = null;

    this.filteredRecords = null;
    this.filteredTruthRecords = null;
  }

  getFilteredSortedRecords(state) {
    this._applyFiltersAndSorts(state);
    return this.filteredRecords;
  }

  getFilteredTruthRecords(state) {
    this._applyFiltersAndSorts(state);
    return this.filteredTruthRecords;
  }

  _getFilteredSortedRecords(state) {
    var {variantType,filters,position,sortBy} = state;
    var filteredRecords = filterRecords(
        this.vcfData.records,
        rec => isRecordWithinRange(rec, position),
        rec => doesRecordPassFilters(rec, filters),
        rec => isRecordCorrectVariantType(rec, variantType));
    var [sortByPath, direction] = sortBy;
    if (sortByPath === null) {
      filteredRecords.sort(vcfTools.recordComparator(direction));
    } else {
      filteredRecords.sort((a, b) => {
        var aVal = utils.getIn(a, sortByPath),
            bVal = utils.getIn(b, sortByPath);
        if (direction === 'desc') {
          return aVal - bVal
        } else {
          return bVal - aVal
        }
      });
    }
    return filteredRecords;
  }

  _applyFiltersAndSorts(state) {
    if (_.isEqual(state, this.lastState)) return;

    var {variantType,filters,position,sortBy} = state;
    this.filteredRecords = this._getFilteredSortedRecords(state);
    this.filteredTruthRecords = filterRecords(
        this.truthVcfData.records,
        rec => isRecordWithinRange(rec, position),
        rec => isRecordCorrectVariantType(rec, variantType));
    this.lastState = cloneDeep(state);
  }
}


module.exports = DataModel;
