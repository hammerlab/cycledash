"use strict";


var ACTION_TYPES = {
  DELETE_COMMENT: 'DELETE_COMMENT',
  REQUEST_PAGE: 'REQUEST_PAGE',
  SELECT_RECORD: 'SELECT_RECORD',
  SET_COMMENT: 'SET_COMMENT',
  SET_QUERY: 'SET_QUERY',
  SET_VIEWER_OPEN: 'SET_VIEWER_OPEN',
  SORT_BY: 'SORT_BY',
  UPDATE_FILTER: 'UPDATE_FILTER',
  UPDATE_RANGE: 'UPDATE_RANGE',
  UPDATE_VARIANT_TYPE: 'UPDATE_VARIANT_TYPE'
};

function getRecordActions(dispatcher) {
  return {
    updateSortBy: function({columnName, order}) {
      dispatcher.dispatch({
        actionType: ACTION_TYPES.SORT_BY,
        columnName,
        order
      });
    },
    setQuery: function(query) {
      dispatcher.dispatch({
        actionType: ACTION_TYPES.SET_QUERY,
        query
      });
    },
    requestPage: function() {
      dispatcher.dispatch({
        actionType: ACTION_TYPES.REQUEST_PAGE
      });
    },
    selectRecord: function(record) {
      dispatcher.dispatch({
        actionType: ACTION_TYPES.SELECT_RECORD,
        record
      });
    },
    setViewerOpen: function(isOpen) {
      dispatcher.dispatch({
        actionType: ACTION_TYPES.SET_VIEWER_OPEN,
        isOpen
      });
    },
    setComment: function(comment) {
      dispatcher.dispatch({
        actionType: ACTION_TYPES.SET_COMMENT,
        comment
      });
    },
    deleteComment: function(comment) {
      dispatcher.dispatch({
        actionType: ACTION_TYPES.DELETE_COMMENT,
        comment
      });
    }
  };
}

module.exports = {ACTION_TYPES, getRecordActions};
