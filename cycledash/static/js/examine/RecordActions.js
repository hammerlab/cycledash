"use strict";


var ACTION_TYPES = {
  DELETE_COMMENT: 'DELETE_COMMENT',
  REQUEST_PAGE: 'REQUEST_PAGE',
  SELECT_RECORD: 'SELECT_RECORD',
  SELECT_VALIDATION_VCF: 'SELECT_VALIDATION_VCF',
  SET_COMMENT: 'SET_COMMENT',
  SET_QUERY: 'SET_QUERY',
  SET_VIEWER_OPEN: 'SET_VIEWER_OPEN',
  SORT_BY: 'SORT_BY'
};

function getRecordActions(dispatcher) {
  return {
    updateSortBys: function(sortBys) {
      dispatcher.dispatch({
        actionType: ACTION_TYPES.SORT_BY,
        sortBys
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
    selectComparisonVcf: function(compareToVcfId) {
      dispatcher.dispatch({
        actionType: ACTION_TYPES.SELECT_VALIDATION_VCF,
        compareToVcfId
      });
    },
    setViewerOpen: function(isOpen) {
      dispatcher.dispatch({
        actionType: ACTION_TYPES.SET_VIEWER_OPEN,
        isOpen
      });
    },
    setComment: function(comment, record) {
      dispatcher.dispatch({
        actionType: ACTION_TYPES.SET_COMMENT,
        comment,
        record
      });
    },
    deleteComment: function(comment, record) {
      dispatcher.dispatch({
        actionType: ACTION_TYPES.DELETE_COMMENT,
        comment,
        record
      });
    }
  };
}

module.exports = {ACTION_TYPES, getRecordActions};
