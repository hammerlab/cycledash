/** @jsx React.DOM */
"use strict";

var _ = require('underscore'),
    vcf = require('vcf.js'),
    vcfTools = require('./vcf.tools'),
    utils = require('./utils'),
    $ = require('jquery'),
    ACTION_TYPES = require('./RecordActions').ACTION_TYPES,
    types = require('./components/types');


function RecordStore(vcfPath, truthVcfPath, dispatcher) {
  var listenerCallbacks = [],
      dispatcherToken = null;

  var hasLoadedVcfs = false,
      header = {},
      records = [],
      truthRecords = [],
      trueFalsePositiveNegative = {truePositives:  0,
                                   falsePositives: 0,
                                   falseNegatives: 0},
      totalRecords = 0,
      selectedRecord = null,
      filters = [],
      selectedColumns = [],
      sortBy = {path: null, order: 'asc'},
      range = {start: null,
               end: null,
               chromosome: types.ALL_CHROMOSOMES},
      variantType = 'ALL',
      chromosomes = [],
      columns = {};

  var fullRecords = [],
      fullTruthRecords = [];

  // Cached comparison function.
  var comparator = vcfTools.recordComparator(sortBy.order);

  // Callback function to be registered with the Dispatcher to recieve (and act
  // on) actions.
  function reciever(action) {
    switch(action.actionType) {
      case ACTION_TYPES.SORT_BY:
        comparator = recordComparatorFor(action.path, action.order);
        sortRecords(action.path, action.order);
        sortBy = _.pick(action, 'path', 'order');
        records = displayableRecords(fullRecords, range, variantType, filters);
        truthRecords = recordsOfType(recordsInRange(fullTruthRecords, range), variantType);
        trueFalsePositiveNegative = vcfTools.trueFalsePositiveNegative(records, truthRecords);
        break;
      case ACTION_TYPES.UPDATE_FILTER:
        // We don't apply filters to truth records
        updateFilters(action.path, action.filterValue);
        records = displayableRecords(fullRecords, range, variantType, filters);
        trueFalsePositiveNegative = vcfTools.trueFalsePositiveNegative(records, truthRecords);
        break;
      case ACTION_TYPES.SELECT_RECORD_RANGE:
        range = _.pick(action, 'start', 'end', 'chromosome');
        records = displayableRecords(fullRecords, range, variantType, filters);
        truthRecords = recordsOfType(recordsInRange(fullTruthRecords, range), variantType);
        trueFalsePositiveNegative = vcfTools.trueFalsePositiveNegative(records, truthRecords);
        break;
      case ACTION_TYPES.UPDATE_VARIANT_TYPE:
        variantType = action.variantType;
        records = displayableRecords(fullRecords, range, variantType, filters);
        truthRecords = recordsOfType(recordsInRange(fullTruthRecords, range), variantType);
        trueFalsePositiveNegative = vcfTools.trueFalsePositiveNegative(records, truthRecords);
        break;
      case ACTION_TYPES.SELECT_COLUMN:
        var col = _.find(selectedColumns, c => _.isEqual(c.path, action.path));
        if (!col) selectedColumns.push({path: action.path,
                                        info: action.info,
                                        name: action.name});
        else selectedColumns = _.without(selectedColumns, col);
        break;
      case ACTION_TYPES.SELECT_RECORD:
        selectedRecord = action.record;
        break;
    }
    notifyChange();
    return true;
  }
  if (dispatcher) dispatcherToken = dispatcher.register(reciever);

  function sortRecords(path, order) {
    // We only sort fullRecords, because they have to be filtered afterwards
    // anyway. We don't sort fullTruthRecords because it has to be sorted by
    // __KEY__, as we can't count on it having the attribute that fullRecords
    // has, e.g.  NORMAL::DP might exist in fullRecords only.
    if (_.isEqual(path, sortBy.path) && order !== sortBy.order) {
      // If the sort column is the same but the sort order is different, we can
      // just reverse the lists instead of resorting them.
      fullRecords.reverse();
    } else {
      fullRecords.sort(comparator);
    }
  }

  function updateFilters(path, filterValue) {
    var filter = _.findWhere(filters, {path: path});
    if (filter && filterValue.length === 0) {
      filters = _.without(filters, filter);
    } else if (filter) {
      filter.filterValue = filterValue;
    } else {
      filters.push({path: path, filterValue: filterValue});
    }
  }

  var vcfParser = vcf.parser();
  function deferredVcf(vcfPath) {
    return $.get('/vcf' + vcfPath).then(function(data) {
      return vcfParser(data);
    });
  }
  var deferreds = [deferredVcf(vcfPath)];
  if (truthVcfPath) deferreds.push(deferredVcf(truthVcfPath));
  $.when.apply(null, deferreds)
    .done((vcfData, truthVcfData) => {
      hasLoadedVcfs = true;

      header = vcfData.header;
      fullRecords = vcfData.records;
      fullTruthRecords = truthVcfPath ? truthVcfData.records : [];

      fullRecords.sort(comparator);
      fullTruthRecords.sort(comparator);

      records = fullRecords;
      truthRecords = fullTruthRecords;

      if (truthVcfPath) {
        trueFalsePositiveNegative = vcfTools.trueFalsePositiveNegative(
          records, truthRecords, comparator);
      }
      totalRecords = fullRecords.length;


      chromosomes = _.uniq(records.map(r => r.CHROM));
      chromosomes.sort(vcfTools.chromosomeComparator);
      columns = vcfTools.deriveColumns(vcfData);

      notifyChange();
    });
  // Calls all registered listening callbacks.
  function notifyChange() {
    _.each(listenerCallbacks, cb => { cb(); });
  }

  return {
      ////////////////////
     // State queries. //
    ////////////////////
    hasLoadedVcfs: function() {
      return hasLoadedVcfs;
    },
    getRecords: function() {
      return records;
    },
    getTruthRecords: function() {
      return truthRecords;
    },
    getTrueFalsePositiveNegative: function() {
      return trueFalsePositiveNegative;
    },
    getTotalRecords: function() {
      return fullRecords.length;
    },
    getSelectedRecord: function() {
      return selectedRecord;
    },
    getFilters: function() {
      return filters;
    },
    getSelectedColumns: function() {
      return selectedColumns;
    },
    getSortBy: function() {
      return sortBy;
    },
    getRange: function() {
      return range;
    },
    getVariantType: function() {
      return variantType;
    },
    getChromosomes: function() {
      return chromosomes;
    },
    getColumns: function() {
      return columns;
    },
    getState: function() {
      // Returns all the above state in an object.
      return {
        hasLoadedVcfs: hasLoadedVcfs,
        header: header,
        records: records,
        truthRecords: truthRecords,
        trueFalsePositiveNegative: trueFalsePositiveNegative,
        totalRecords: totalRecords,
        selectedRecord: selectedRecord,
        filters: filters,
        selectedColumns: selectedColumns,
        sortBy: sortBy,
        range: range,
        variantType: variantType,
        chromosomes: chromosomes,
        columns: columns
      };
    },

    // Additional queries, likely unneeded.
    getAllRecords: function() {
      // Return all records (sorted).
      return fullRecords;
    },
    getAllTruthRecords: function() {
      // Return all truth records (sorted).
      return fullTruthRecords;
    },

    // Notification and dispatch functions.
    onChange: function(callback) {
      // Calls callback when the store changes.
      listenerCallbacks.push(callback);
      notifyChange();
    },
    registerDispatcher: function(dispatcher) {
      dispatcherToken = dispatcher.register(reciever);
    },
    unregisterDispatcher: function() {
      dispatcher.unregister(dispatcherToken);
    },
    reciever: reciever
  };
}


// ---- Helper functions for filtering ---- \\

function isRecordOfType(record, variantType) {
  switch (variantType) {
    case 'ALL':
      return true;
    case 'SNV':
      return record.isSnv();
    case 'INDEL':
      return record.isIndel();
    case 'SV':
      return record.isSv();
    default:
      throw new TypeError("variantType must be one of ALL, SNV, SV, INDEL, is '" +
                          variantType + "'");
  }
}

function isRecordWithinRange(record, range) {
  var {start, end, chromosome} = range;

  if (chromosome === types.ALL_CHROMOSOMES) {
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

function filtersToPredicates(filters) {
  return _.map(filters, filter => {
    var filterVal = filter.filterValue,
        path = filter.path;
    return record => {
      var val = utils.getIn(record, path);
      if (_.contains(['<', '>'], filterVal[0])) {  // then do a numeric test
        val = Number(val);
        if (filterVal[0] === '>') return val > Number(filterVal.slice(1));
        else return val < Number(filterVal.slice(1));
      } else {  // treat it like a regexp
        var re = new RegExp(filterVal);
        if (_.isEqual(path, types.REF_ALT_PATH)) {
          return re.test(record.REF + "/" + record.ALT);
        } else {
          return re.test(String(val));
        }
      }
    };
  });
}

function recordsPassingFilters(records, filters) {
  var filterPreds = filtersToPredicates(filters),
      predicate = _.compose(_.every, utils.juxt(filterPreds));
  return _.filter(records, predicate);
}

function recordsInRange(records, range) {
  return _.filter(records, record => isRecordWithinRange(record, range));
}

function recordsOfType(records, variantType) {
  return _.filter(records, record => isRecordOfType(record, variantType));
}

// Applies all column filters, range selections, variant type selection to
// records, returning a new list of records to be displayed.
function displayableRecords(records, range, variantType, filters) {
  records = recordsInRange(records, range);
  records = recordsOfType(records, variantType);
  records = recordsPassingFilters(records, filters);
  return records;
}

function recordComparatorFor(path, order) {
  if (path === null) {
    return vcfTools.recordComparator(order);
  } else {
    return (a, b) => {
      var aVal = utils.getIn(a, path),
          bVal = utils.getIn(b, path);
      return order === 'asc' ? aVal - bVal : bVal - aVal;
    };
  }
}


module.exports = RecordStore;
