"use strict";


var ACTION_TYPES = {
  REQUEST_PAGE: 'REQUEST_PAGE',
  SELECT_RECORD: 'SELECT_RECORD',
  SET_QUERY: 'SET_QUERY',
  SORT_BY: 'SORT_BY'
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
    }
  };
}

module.exports = {ACTION_TYPES, getRecordActions};
