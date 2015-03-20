/**
 * RecordStore contains all the state for the Examine Page.
 *
 * All actions are processed via the "receiver" closure, dispatched on the
 * ACTION_TYPE of the action by the switch statement therein. Most other code is
 * simply supporting functinality.
 *
 * Beware the mutable function-local state defined at the beginning of
 * RecordStore. This is what we want to hide from the outside world
 */
"use strict";

var _ = require('underscore'),
    utils = require('./utils'),
    QueryLanguage = require('../QueryLanguage'),
    $ = require('jquery'),
    ACTION_TYPES = require('./RecordActions').ACTION_TYPES,
    types = require('./components/types');


// Records to show on a page (max records fetched from CycleDash server).
var RECORD_LIMIT = 250;
var DEFAULT_SORT_BYS = [{columnName: 'contig', order: 'asc'},
                        {columnName: 'position', order: 'asc'}];

var ENTIRE_GENOME = {start: null, end: null, contig: types.ALL_CHROMOSOMES};


// opt_testDataSource is provided for testing.
// Its type is function(url, type, data, done_callback, err_callback).
function createRecordStore(run, igvHttpfsUrl, dispatcher, opt_testDataSource) {
  // Initial state of the store. This is mutable. There be monsters.
  var vcfId = run.id,
      hasPendingRequest = false,
      hasLoaded = false,
      loadError = null,

      records = [],

      stats = {totalRecords: 0, totalUnfilteredRecords: 0},
      selectedRecord = null,
      isViewerOpen = false,

      compareToVcfId = null,

      filters = [],
      sortBys = DEFAULT_SORT_BYS,
      range = ENTIRE_GENOME,

      contigs = run.contigs,
      columns = run.spec,

      igvLink = utils.makeIGVLink(run, igvHttpfsUrl);

  // Internal to RecordStore, this is a map from row key (contig +
  // position + ...) to the record's index in records.
  var keyToRecordIndex = {};

  // Internal to RecordStore, this is a map from row key (contig +
  // position + ...) to comment. It is *not* kept updated. Rather,
  // its information is loaded into record objects, which become
  // the source of truth.
  var commentMap = {};

  // State for paging the server for records. Page should be reset to 0 on most
  // operations.
  var page = 0,
      limit = RECORD_LIMIT;

  // Callbacks registered by listening components, registered with #onChange().
  var listenerCallbacks = [];

  // Token identifying this store within the dispatcher.
  var dispatcherToken = null;

  var dataSource = opt_testDataSource || networkDataSource;

  var currentPendingQuery = null;

  var cqlColumnList = utils.extractFlatColumnList(columns);

  function receiver(action) {
    switch(action.actionType) {
      case ACTION_TYPES.SORT_BY:
        updateSortBys(action.sortBys);
        ignorePendingRequests();
        updateGenotypes({append: false});
        break;
      case ACTION_TYPES.REQUEST_PAGE:
        updateGenotypes({append: true});
        break;
      case ACTION_TYPES.SELECT_RECORD:
        selectedRecord = action.record;
        notifyChange();
        break;
      case ACTION_TYPES.SELECT_VALIDATION_VCF:
        compareToVcfId = action.compareToVcfId;
        updateGenotypes({append: false});
        break;
      case ACTION_TYPES.SET_VIEWER_OPEN:
        isViewerOpen = action.isOpen;
        notifyChange();
        break;
      case ACTION_TYPES.SET_QUERY:
        setQuery(action.query);
        ignorePendingRequests();
        updateGenotypes({append: false});
        break;
      case ACTION_TYPES.SET_COMMENT:
        setComment(action.comment, action.record);
        break;
      case ACTION_TYPES.DELETE_COMMENT:
        deleteComment(action.comment, action.record);
        break;
    }
    // Required: lets the dispatcher know that the Store is done processing.
    return true;
  }
  if (dispatcher)  dispatcherToken = dispatcher.register(receiver);

  /**
   * Queries the backend for the set of genotypes matching the current
   * parameters.
   *
   * NB: mutates store state!
   */
  function updateGenotypes({append}) {
    // Example query:
    // {"range": {"contig": 1, "start": 800000, "end": 2000000},
    //  "sortBy": [{"columnName": "sample:DP", "order": "desc"},
    //             {"columnName": "position", "order": "desc"}],
    //  "filters": [{"columnName": "sample:DP", "filterValue": "60", type: ">"},
    //              {"columnName": "sample:DP", "filterValue": "50", type: "<"},
    //              {"columnName": "reference", "filterValue": "G", type: "="}]};
    //
    // If append == true, instead of replacing the records, append the new
    // records to our existing list.
    if (append) {
      page = page + 1;
    } else {
      page = 0;
    }

    var query = queryFrom(range, filters, sortBys, page, limit, compareToVcfId);
    setQueryStringToQuery(query);

    // If we're not just appending records, reset the selected records (as the
    // table is now invalidated).
    if (!append) {
      selectedRecord = null;
      isViewerOpen = false;
    }

    currentPendingQuery = query;
    hasPendingRequest = true;
    notifyChange();  // notify of pending request
    deferredGenotypes(vcfId, query)
      .done(response => {
        if (append) {
          _.extend(keyToRecordIndex,
                   generateKeyToRecordIndex(response.records, records.length));
          records = records.concat(response.records);
        } else {
          stats = response.stats;
          keyToRecordIndex = generateKeyToRecordIndex(response.records, 0);
          records = response.records;
        }
        hasLoaded = true;
        hasPendingRequest = false;
        updateCommentsInParentRecords(records);
        notifyChange();
      })
      .fail(function([jqXHR, errorMessage, errorDetails]) {
        if (!_.isEqual(currentPendingQuery, query)) {
          return;  // A subsequent request has superceded this one.
        }
        loadError = errorDetails;
        hasPendingRequest = false;
        notifyChange();
      });
  }

  // Ignore all currently pending requests (presumably because there's a newer one).
  function ignorePendingRequests() {
    hasPendingRequest = false;
    currentPendingQuery = null;
    loadError = null;
  }

  // Given a list of records, return a map from record key to record index, where
  // the index is added to increment.
  function generateKeyToRecordIndex(records, increment) {
    return _.reduce(records, (keyMap, record, idx) => {
      keyMap[utils.getRowKey(record)] = idx + increment;
      return keyMap;
    }, {});
  }

  // Update all records with their associated comments from commentMap.
  function updateCommentsInParentRecords(records) {
    _.each(commentMap, (comments, rowKey) => {
      // Not all comments map to record indices. Namely, comments that
      // correspond to records that have not yet loaded.
      if (_.has(keyToRecordIndex, rowKey)) {
        var idx = keyToRecordIndex[rowKey];
        _.each(comments, comment => {
          updateCommentInParentRecord(comment, records[idx], false);
        });
      }
    });
  }

  // Given a comment, put the comment into the right record (or delete
  // it from that record). If a comment was replaced, return the
  // original.
  function updateCommentInParentRecord(comment, record, isDelete) {
    if (isDelete) {
      var comments = record.comments;
      var indexToRemove = _.indexOf(comments, comment);
      if (indexToRemove !== -1) {
        comments.splice(indexToRemove, 1);
      }

      // If there are no comments left, we don't need a comments list.
      if (_.isEmpty(comments)) {
        delete record.comments;
      }
    } else {
      if (!_.has(record, 'comments')) {
        record.comments = [];
      }

      // Replace an existing comment.
      var indexToReplace = -1;
      _.each(record.comments, (eachComment, index) => {
        if (_.has(comment, 'id')) {
          // If a comment is already stored in the DB, distinguishing it
          // is is (use the ID).
          if (comment.id === eachComment.id) {
            indexToReplace = index;
          }
        } else if (comment.created_date === eachComment.created_date) {
          // Otherwise, use the created date (which exists client side,
          // even before its stored in the DB).
          indexToReplace = index;
        }
      });

      // If there's no existing comment, add it to the list.
      if (indexToReplace !== -1) {
        var oldComment = record.comments[indexToReplace];
        record.comments[indexToReplace] = comment;
        return oldComment;
      } else {
        record.comments.push(comment);
      }
    }
  }

  // Given a comment, update its parent record and notify callers.
  // Returns the old comment being changed.
  function updateCommentAndNotify(comment, record, isDelete) {
    var isDelete = !_.isUndefined(isDelete) ? isDelete : false;

    var oldComment = updateCommentInParentRecord(comment, record,
                                                 isDelete);
    notifyChange();

    return oldComment;
  }

  function deferredComments(vcfId) {
    return callbackToPromise(
      dataSource,
      '/runs/' + vcfId + '/comments',
      'GET'
    );
  }

  function getComments() {
    $.when(deferredComments(vcfId))
      .done(response => {
        commentMap = response.comments;

        updateCommentsInParentRecords(records);
        notifyChange();
      });
  }

  function deferredCommentDelete(vcfId, comment) {
    return callbackToPromise(
      dataSource,
      '/runs/' + vcfId + '/comments/' + comment.id,
      'DELETE',
      {'last_modified_timestamp': comment.last_modified_timestamp}
    );
  }

  function deleteComment(comment, record) {
    // If a comment has no ID (e.g. it was created optimistically, and has not
    // yet been granted an ID from an HTTP response), deleting it from the server
    // has no meaning. To prevent the weird condition of a comment POSTing
    // after it gets deleted locally (and then re-appearing locally), simply
    // do nothing in this circumstance.
    if (!_.has(comment, 'id')) {
      return;
    }

    var oldComment = updateCommentAndNotify(comment, record, true);
    $.when(deferredCommentDelete(vcfId, comment))
      .fail(() => {
        // Undo the delete if it was a failure.
        updateCommentAndNotify(oldComment, record);
      });
  }

  function deferredCommentUpdate(vcfId, comment) {
    return callbackToPromise(
      dataSource,
      '/runs/' + vcfId + '/comments/' + comment.id,
      'PUT',
      {'comment_text': comment.comment_text,
       'author_name': comment.author_name,
       'last_modified_timestamp': comment.last_modified_timestamp}
    );
  }

  function deferredCommentCreate(vcfId, comment) {
    return callbackToPromise(
      dataSource,
      '/runs/' + vcfId + '/comments',
      'POST',
      comment
    );
  }

  function setComment(comment, record) {
    // Update a comment.
    // TODO(tavi) Notify on saving vs. saved, and don't simply undo the user's
    // changes without any warning.
    if (_.has(comment, 'id')) {
      var oldComment = updateCommentAndNotify(comment, record);
      $.when(deferredCommentUpdate(vcfId, comment))
        .done(response => {
          // Set this comment's last_modified_timestamp timestamp after the update.
          comment.last_modified_timestamp = response.last_modified_timestamp;
          updateCommentAndNotify(comment, record);
        })
        .fail(() => {
          // Undo the update if it was a failure.
          updateCommentAndNotify(oldComment, record);

          // TODO(tavi) If it was a failure due to clobbering, get the latest
          // comment data and inform the user (rather than a simple local undo).
        });
    } else {
      // Otherwise, create an optimistic comment.
      updateCommentAndNotify(comment, record, false);
      $.when(deferredCommentCreate(vcfId, comment))
        .done(response => {
          // Give this comment an ID, based on what was inserted.
          comment.id = response.id;
          comment.last_modified_timestamp = response.last_modified_timestamp;
          updateCommentAndNotify(comment, record);
        })
        .fail(() => {
          // Undo (delete) the optimistic comment if the create was a failure.
          updateCommentAndNotify(comment, record, true);
        });
    }
  }

  // Returns a JS object query for sending to the backend.
  function queryFrom(range, filters, sortBy, page, limit, compareToVcfId) {
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
      limit,
      compareToVcfId
    };
  }

  // Like encodeURIComponent, but uses + instead of %20 to escape spaces.
  function encodeURIPlus(str) {
    return encodeURIComponent(str).replace(/%20/g, '+');
  }

  // Like decodeURIComponent, but uses + instead of %20 to escape spaces.
  function decodeURIPlus(q) {
    return decodeURIComponent(q.replace(/\+/g, '%20'));
  }

  function setQueryStringToQuery(query) {
    var queryString = encodeURIPlus(QueryLanguage.toString(query));
    window.history.replaceState(null, null, '?query=' + queryString);
  }

  // Returns the value with the given name in the URL search string.
  function getQueryStringValue(name) {
    var search = window.location.search.substring(1),
        vars = search.split('&');
    var val = _.first(_.filter(vars, v => {
      var key = v.split('=')[0];
      return decodeURIPlus(key) == name;
    }));
    if (val) {
      return decodeURIPlus(val.split('=')[1]);
    }
    return null;
  }

  /**
   * Updates the sortBys.
   *
   * NB: mutates store state!
   */
  function updateSortBys(newSortBys) {
    sortBys = newSortBys;
  }

  /**
   * Sets sortBy, range and filters all in one go.
   * Unlike the update* methods, this clobbers whatever was there before.
   *
   * NB: mutates store state!
   */
  function setQuery(query) {
    filters = query.filters || [];
    sortBys = query.sortBy || DEFAULT_SORT_BYS;
    range = query.range || ENTIRE_GENOME;
  }

  var existingQuery = getQueryStringValue('query');
  if (existingQuery) {
    try {
      var jsonQuery = QueryLanguage.parse(existingQuery, cqlColumnList);
      setQuery(jsonQuery);
    } catch (e) {
      // query is invalid
    }
  }

  updateGenotypes({append: false});
  getComments();

  function notifyChange() {
    _.each(listenerCallbacks, cb => { cb(); });
  }

  // Return a deferred GET returning genotypes and stats.
  function deferredGenotypes(vcfId, query) {
    var queryString = encodeURIComponent(JSON.stringify(query));
    return callbackToPromise(
      dataSource,
      '/runs/' + vcfId + '/genotypes?q=' + queryString,
      'GET'
    );
  }

  return {
    getState: function() {
      var query = queryFrom(range, filters, sortBys, page, limit, compareToVcfId);
      return {
        columns,
        contigs,
        filters,
        hasLoaded,
        hasPendingRequest,
        igvLink,
        isViewerOpen,
        loadError,
        query,
        range,
        records,
        selectedRecord,
        compareToVcfId,
        sortBys,
        stats
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

function networkDataSource(url, type, data, doneCallback, errCallback) {
  var params = {url: url, type: type};
  if (_.isObject(data)) {
    params.data = data;
  }

  return $.ajax(params).done(doneCallback).fail(errCallback);
}

// Convert a data source callback to a jQuery-style promise
function callbackToPromise(fn, url, type, data) {
  var data = !_.isUndefined(data) ? data : null;
  var d = $.Deferred();
  fn(url, type, data, function(response) {
    d.resolve(response);
  }, function() {
    d.reject.call(null, arguments);
  });
  return d;
}

module.exports = createRecordStore;
