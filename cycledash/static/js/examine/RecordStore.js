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
    utils = require('./utils'),
    $ = require('jquery'),
    ACTION_TYPES = require('./RecordActions').ACTION_TYPES,
    types = require('./components/types');


// Records to show on a page (max records fetched from CycleDash server).
var RECORD_LIMIT = 250;
var DEFAULT_SORT_BYS = [{columnName: 'contig', order: 'asc'},
                        {columnName: 'position', order: 'asc'}];


function createRecordStore(vcfId, dispatcher) {
  // Initial state of the store. This is mutable. There be monsters.
  var hasLoaded = false,
      loadError = null,

      records = [],

      stats = {totalRecords: 0, totalUnfilteredRecords: 0},
      selectedRecord = null,
      selectedColumns = [],

      filters = [],
      sortBys = [{columnName: 'position', order: 'asc'}],
      range = {start: null, end: null, chromosome: types.ALL_CHROMOSOMES},
      variantType = 'ALL', // TODO(ihodes): implement

      contigs = [],
      columns = {};

  // State for paging the server for records. Page should be reset to 0 on most
  // operations.
  var page = 0,
      limit = RECORD_LIMIT;

  // Callbacks registered by listening components, registered with #onChange().
  var listenerCallbacks = [];

  // Token identifying this store within the dispatcher.
  var dispatcherToken = null;

  function receiver(action) {
    switch(action.actionType) {
      case ACTION_TYPES.SORT_BY:
        updateSortBys(action.columnName, action.order);
        updateGenotypes({append: false});
        break;
      case ACTION_TYPES.UPDATE_FILTER:
        updateFilters(action.columnName, action.filterValue, action.type);
        updateGenotypes({append: false});
        break;
      case ACTION_TYPES.SELECT_RECORD_RANGE:
        updateRange(action.contig, action.start, action.end);
        updateGenotypes({append: false});
        break;
      case ACTION_TYPES.REQUEST_PAGE:
        updateGenotypes({append: true});
        break;
      case ACTION_TYPES.UPDATE_VARIANT_TYPE:
        // TODO(ihodes): implement: variantType = action.variantType;
        break;
      case ACTION_TYPES.SELECT_COLUMN:
        // TODO(ihodes): implement/todo (this is broken)
        // var col = _.find(selectedColumns, c => _.isEqual(c.path, action.path));
        // if (!col) {
        //   selectedColumns.push({path: action.path,
        //                         info: action.info,
        //                         name: action.name});
        // } else {
        //   selectedColumns = _.without(selectedColumns, col);
        // }
        break;
      case ACTION_TYPES.SELECT_RECORD:
        selectedRecord = action.record;
        break;
    }
    // Required: lets the dispatcher to know that the Store is done processing.
    return true;
  }
  if (dispatcher) dispatcherToken = dispatcher.register(receiver);

  /**
   * Queries the backend for the set of genotypes matching the current
   * parameters.
   *
   * NB: mutates store state!
   */
  function _updateGenotypes({append}) {
    // Example query:
    // var query = {"range": {"contig": 1, "start": 800000, "end": 2000000},
    //              "sortBy": [{"columnName": "sample:DP", "order": "desc"},
    //                         {"columnName": "position", "order": "desc"}],
    //              "filters": [{"columnName": "sample:DP", "value": "<60"},
    //                          {"columnName": "sample:DP", "value": ">50"},
    //                          {"columnName": "reference", "value": "=G"}]};
    //
    // If append == true, instead of replacing the records, append the new
    // records to our existing list.
    if (append) {
      page = page + 1;
    } else {
      page = 0;
    }

    var query = queryFrom(range, filters, sortBys, page, limit);

    $.when(deferredGenotypes(vcfId, query))
      .done(response => {
        if (append) {
          // TODO: BUG: This can result in a out-of-order records, if a later
          //            XHR returns before an earlier XHR.
          records = records.concat(response.records);
        } else {
          stats = response.stats;
          records = response.records;
        }
        notifyChange();
      });
  }
  var updateGenotypes =
      _.debounce(_.throttle(_updateGenotypes, 500 /* ms */), 500 /* ms */);

  // Returns a JS object query for sending to the backend.
  function queryFrom(range, filters, sortBy, page, limit) {
    if (sortBy[0].columnName == 'position') {
      sortBy = DEFAULT_SORT_BYS.map(sb => {
        sb.order = sortBys[0].order;
        return sb;
      });
    }
    return {
      range,
      filters,
      sortBy,
      page,
      limit
    };
  }

  /**
   * Updates the filters by columnName and filterValue. Removes previous any
   * previous filter which applies to the columnName, and then appends the new
   * filter.
   *
   * NB: mutates store state!
   */
  function updateFilters(columnName, filterValue, type) {
    // TODO(ihodes): be careful with how we remove filters: we could have two+
    //               filters applied to a given columnName, e.g. selection a
    //               range of interesting sample:DP
    var filter = _.find(filters, f => _.isEqual(columnName, f.columnName));
    if (filter) {
      filters = _.without(filters, filter);
    }
    if (filterValue.length > 0) {
      filters.push({columnName, filterValue, type});
    }
  }

  /**
   * Updates the sortBys by columnName and order.
   *
   * NB: mutates store state!
   */
  function updateSortBys(columnName, order) {
    // Right now, we just sort by one column (this will change on CQL
    // integration).
    sortBys = [{columnName, order}];
  }

  /**
   * Updates the range.
   *
   * NB: mutates store state!
   */
  function updateRange(contig, start, end) {
    range = {contig, start, end};
  }

  // Initialize the RecordStore with basic information (columns, the contigs
  // in the VCF), and request first records to display.
  $.when(deferredSpec(vcfId), deferredContigs(vcfId))
    .done((columnsResponse, contigsResponse) => {
      hasLoaded = true;
      columns = columnsResponse[0].spec;
      contigs = contigsResponse[0].contigs;
      updateGenotypes({append: false});
    });

  function notifyChange() {
    _.each(listenerCallbacks, cb => { cb(); });
  }

  function handleVcfParseError(vcfPath, e) {
    console.error('Error while parsing VCFs: ', e);
    loadError = 'Error while parsing VCF ' + vcfPath + ': ' + e;
    notifyChange();
  }

  return {
    getState: function() {
      return {
        hasLoaded,
        loadError,
        records,
        stats,
        selectedRecord,
        filters,
        selectedColumns,
        sortBys,
        range,
        variantType,
        contigs,
        columns,
      };
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
      if (_.contains(['<', '>', '='], filterVal[0])) {  // then do a numeric test
        val = Number(val);
        if (filterVal[0] === '>') {
          return val > Number(filterVal.slice(1));
        } else if (filterVal[0] === '>') {
          return val < Number(filterVal.slice(1));
        } else if (filterVal[0] === '=') {
          return val == Number(filterVal.slice(1));
        }
      } else {  // treat it like a regexp
        var re = new RegExp(filterVal);
        return re.test(String(val));
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

// Return deferred GET for the column spec for a given VCF.
function deferredSpec(vcfId) {
  return $.get('/runs/' + vcfId + '/spec');
}

// Return deferred GET for the contigs in a given VCF.
function deferredContigs(vcfId) {
  return $.get('/runs/' + vcfId + '/contigs');
}

// Return a deferred GET returning genotypes and stats.
function deferredGenotypes(vcfId, query) {
  var queryString = encodeURIComponent(JSON.stringify(query));
  return $.get('/runs/' + vcfId + '/genotypes?q=' + queryString);
}

module.exports = createRecordStore;
