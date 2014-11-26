"use strict";


var ACTION_TYPES = {
  REQUEST_PAGE: 'REQUEST_PAGE',
  SELECT_COLUMN: 'SELECT_COLUMN',
  SELECT_RECORD: 'SELECT_RECORD',
  SET_QUERY: 'SET_QUERY',
  SORT_BY: 'SORT_BY',
  UPDATE_FILTER: 'UPDATE_FILTER',
  UPDATE_RANGE: 'UPDATE_RANGE',
  UPDATE_VARIANT_TYPE: 'UPDATE_VARIANT_TYPE',
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
    updateFilters: function({columnName, type, filterValue}) {
      dispatcher.dispatch({
        actionType: ACTION_TYPES.UPDATE_FILTER,
        columnName,
        type,
        filterValue
      });
    },
    updateRange: function({contig, start, end}) {
      dispatcher.dispatch({
        actionType: ACTION_TYPES.UPDATE_RANGE,
        start,
        end,
        contig
      });
    },
    updateVariantType: function(variantType) {
      dispatcher.dispatch({
        actionType: ACTION_TYPES.UPDATE_VARIANT_TYPE,
        variantType
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
    selectColumn: function({columnName, info, name}) {
      dispatcher.dispatch({
        actionType: ACTION_TYPES.SELECT_COLUMN,
        columnName,
        info,
        name
      });
    }
  };
}

module.exports = {ACTION_TYPES, getRecordActions};
