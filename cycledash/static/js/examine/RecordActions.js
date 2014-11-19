/** @jsx React.DOM */
"use strict";


var ACTION_TYPES = {
  SORT_BY: 'SORT_BY',
  UPDATE_FILTER: 'UPDATE_FILTER',
  SELECT_RECORD_RANGE: 'SELECT_RECORD_RANGE',
  REQUEST_PAGE: 'REQUEST_PAGE',
  SELECT_RECORD: 'SELECT_RECORD',
  UPDATE_VARIANT_TYPE: 'UPDATE_VARIANT_TYPE',
  SELECT_COLUMN: 'SELECT_COLUMN'
};

function getRecordActions(dispatcher) {
  return {
    updateSorter: function({columnName, order}) {
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
    updateRecordRange: function({contig, start, end}) {
      dispatcher.dispatch({
        actionType: ACTION_TYPES.SELECT_RECORD_RANGE,
        start,
        end,
        contig
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
    updateVariantType: function(variantType) {
      dispatcher.dispatch({
        actionType: ACTION_TYPES.UPDATE_VARIANT_TYPE,
        variantType
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
