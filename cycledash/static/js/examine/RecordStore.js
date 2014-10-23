/**
 * RecordStore contains all the state for the Examine Page.
 *
 * All actions are processed via the "receiver" closure, dispatched on the
 * ACTION_TYPE of the action by the switch statement therein. Most other code is
 * simply supporting functinality.
 *
 * Beware the mutable function-local state defined at the beginning of
 * RecordStore. This is what we want to hide from the outside world
 *
 * @jsx React.DOM */
"use strict";

var _ = require('underscore'),
    vcf = require('vcf.js'),
    vcfTools = require('./vcf.tools'),
    utils = require('./utils'),
    $ = require('jquery'),
    ACTION_TYPES = require('./RecordActions').ACTION_TYPES,
    types = require('./components/types');


function RecordStore(vcfPath, truthVcfPath, dispatcher) {
  // Initial state of the store. This is mutable. There be monsters.
  var hasLoadedVcfs = false,
      loadError = null,
      header = {},
      records = [],
      truthRecords = [],
      fullRecords = [],
      fullTruthRecords = [],
      trueFalsePositiveNegative = {},
      totalRecords = 0,
      selectedRecord = null,
      filters = [],
      selectedColumns = [],
      sortBy = {path: null, order: 'asc'},
      range = {start: null, end: null, chromosome: types.ALL_CHROMOSOMES},
      variantType = 'ALL',
      chromosomes = [],
      columns = {};

  // Callbacks registered by listening components, registered with #onChange().
  var listenerCallbacks = [];

  // Token identifying this store within the dispatcher.
  var dispatcherToken = null;

  // Record comparison function.
  var comparator = recordComparatorFor(sortBy.path, sortBy.order);

  function receiver(action) {
    switch(action.actionType) {
      case ACTION_TYPES.SORT_BY:
        comparator = recordComparatorFor(action.path, action.order);
        sortRecords(action.path, action.order);
        sortBy = _.pick(action, 'path', 'order');
        updateRecords({updateTruth: true});
        break;
      case ACTION_TYPES.UPDATE_FILTER:
        updateFilters(action.path, action.filterValue);
        updateRecords({updateTruth: false});
        break;
      case ACTION_TYPES.SELECT_RECORD_RANGE:
        range = _.pick(action, 'start', 'end', 'chromosome');
        updateRecords({updateTruth: true});
        break;
      case ACTION_TYPES.UPDATE_VARIANT_TYPE:
        variantType = action.variantType;
        updateRecords({updateTruth: true});
        break;
      case ACTION_TYPES.SELECT_COLUMN:
        var col = _.find(selectedColumns, c => _.isEqual(c.path, action.path));
        if (!col) {
          selectedColumns.push({path: action.path, info: action.info, name: action.name});
        } else {
          selectedColumns = _.without(selectedColumns, col);
        }
        break;
      case ACTION_TYPES.SELECT_RECORD:
        selectedRecord = action.record;
        break;
    }
    // Now that the state is updated, we notify listening components that it's
    // time to query the Store for new state.
    notifyChange();

    // Required: lets the dispatcher to know that the Store is done processing.
    return true;
  }
  if (dispatcher) dispatcherToken = dispatcher.register(receiver);

  /**
   * Updates the selected records (and, if updateTruth, truthRecords) by applying
   * filters, selected range, and variantType. Also updates true/false pos/neg
   * values.
   *
   * NB: mutates store state!
   */
  function updateRecords({updateTruth}) {
    records = displayableRecords(fullRecords, range, variantType, filters);
    if (updateTruth) {
      // We don't apply filters to truth records.
      truthRecords = recordsOfType(recordsInRange(fullTruthRecords, range), variantType);
    }
    trueFalsePositiveNegative = vcfTools.trueFalsePositiveNegative(records, truthRecords);
  }

  /**
   * Updates the sort order of fullRecords.
   *
   * Takes the new path and order instead of first setting the new SortBy path
   * and order so that we can run #reverse() on records if only order is being
   * changed. [Perf opt hack].
   *
   * NB: mutates store state!
   */
  function sortRecords(path, order) {
    // We only sort fullRecords, because they have to be filtered afterwards
    // anyway. We don't sort fullTruthRecords because it has to be sorted by
    // __KEY__, as we can't count on it having the attribute that fullRecords
    // has, e.g.  NORMAL::DP might exist in fullRecords only.
    if (_.isEqual(path, sortBy.path) && order !== sortBy.order) {
      fullRecords.reverse();
    } else {
      fullRecords.sort(comparator);
    }
  }

  /**
   * Updates the filters by path and filterValue.
   *
   * NB: mutates store state!
   */
  function updateFilters(path, filterValue) {
    var filter = _.findWhere(filters, {path: path});
    if (filter && filterValue.length === 0) {
      filters = _.without(filters, filter);
    } else if (filter) {
      filter.filterValue = filterValue;
    } else {
      filters.push({path, filterValue});
    }
  }

  // Load & parse VCF and, if required, the truth VCF.
  var deferreds = [deferredVcf(vcfPath)];
  if (truthVcfPath) deferreds.push(deferredVcf(truthVcfPath));
  $.when.apply(null, deferreds)
    .done((vcfData, truthVcfData) => {
      var vcfParser = vcf.parser();
      vcfData = vcfParser(vcfData[0]);
      truthVcfData = vcfParser(truthVcfData[0]);

      hasLoadedVcfs = true;

      header = vcfData.header;
      fullRecords = vcfData.records;
      fullTruthRecords = truthVcfPath ? truthVcfData.records : [];

      fullRecords.sort(comparator);
      fullTruthRecords.sort(comparator);

      records = fullRecords;
      truthRecords = fullTruthRecords;

      if (truthVcfPath) {
        trueFalsePositiveNegative = vcfTools.trueFalsePositiveNegative(records, truthRecords);
      }
      totalRecords = fullRecords.length;

      chromosomes = _.uniq(records.map(r => r.CHROM));
      chromosomes.sort(vcfTools.chromosomeComparator);
      columns = vcfTools.deriveColumns(vcfData);

      notifyChange();
    })
    .fail((jqXHR, errorName, errorMessage) => {
      loadError = {jqXHR, errorName, errorMessage};
      notifyChange();
    });
  // Calls all registered listening callbacks.
  function notifyChange() {
    _.each(listenerCallbacks, cb => { cb(); });
  }

  return {
    getState: function() {
      return {
        hasLoadedVcfs,
        loadError,
        header,
        records,
        truthRecords,
        trueFalsePositiveNegative,
        totalRecords,
        selectedRecord,
        filters,
        selectedColumns,
        sortBy,
        range,
        variantType,
        chromosomes,
        columns,
      };
    },

    getAllRecords: function() {
      return fullRecords;
    },
    getAllTruthRecords: function() {
      return fullTruthRecords;
    },

    onChange: function(callback) {
      // Calls callback when the store changes.
      listenerCallbacks.push(callback);
      notifyChange();
    },
    registerDispatcher: function(dispatcher) {
      dispatcherToken = dispatcher.register(receiver);
    },
    unregisterDispatcher: function() {
      dispatcher.unregister(dispatcherToken);
    },
    receiver: receiver
  };
}

// Returns true if the record is of given type.
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

// Returns true is the record is within range.
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

// Returns a list of predicate functions for a given list of filters.
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

// Return records which pass the given filters.
function recordsPassingFilters(records, filters) {
  var filterPreds = filtersToPredicates(filters),
      predicate = _.compose(_.every, utils.juxt(filterPreds));
  return _.filter(records, predicate);
}

// Return records within a given range.
function recordsInRange(records, range) {
  return _.filter(records, record => isRecordWithinRange(record, range));
}

// Return records of a given variant type.
function recordsOfType(records, variantType) {
  return _.filter(records, record => isRecordOfType(record, variantType));
}

// Return list of records adhering to givene range, filters, and variantType.
function displayableRecords(records, range, variantType, filters) {
  records = recordsInRange(records, range);
  records = recordsOfType(records, variantType);
  records = recordsPassingFilters(records, filters);
  return records;
}

// Return a comparator for a given order and path within a record.
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

// Return a promise getting the VCF text at vcfPath.
function deferredVcf(vcfPath) {
  var p = $.get("/vcf" + vcfPath);
  p.vcfPath = vcfPath;
  return p;
}

module.exports = RecordStore;
