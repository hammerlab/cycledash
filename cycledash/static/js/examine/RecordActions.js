/** @jsx React.DOM */
"use strict";


var ACTION_TYPES = {
  SORT_BY: 'SORT_BY',
  UPDATE_FILTER: 'UPDATE_FILTER',
  SELECT_RECORD_RANGE: 'SELECT_RECORD_RANGE',
  SELECT_RECORD: 'SELECT_RECORD',
  UPDATE_VARIANT_TYPE: 'UPDATE_VARIANT_TYPE',
  SELECT_COLUMN: 'SELECT_COLUMN'
};

function RecordActions (dispatcher) {
  return {
    updateSorter: function({path, order}) {
      dispatcher.dispatch({
        actionType: ACTION_TYPES.SORT_BY,
        path: path,
        order: order
      });
    },
    updateFilters: function({path, filterValue}) {
      dispatcher.dispatch({
        actionType: ACTION_TYPES.UPDATE_FILTER,
        path: path,
        filterValue: filterValue
      });
    },
    updateRecordRange: function({chromosome, start, end}) {
      dispatcher.dispatch({
        actionType: ACTION_TYPES.SELECT_RECORD_RANGE,
        start: start,
        end: end,
        chromosome: chromosome
      });
    },
    selectRecord: function(record) {
      dispatcher.dispatch({
        actionType: ACTION_TYPES.SELECT_RECORD,
        record: record
      });
    },
    updateVariantType: function(variantType) {
      dispatcher.dispatch({
        actionType: ACTION_TYPES.UPDATE_VARIANT_TYPE,
        variantType: variantType
      });
    },
    selectColumn: function({path, info, name}) {
      dispatcher.dispatch({
        actionType: ACTION_TYPES.SELECT_COLUMN,
        path: path,
        info: info,
        name: name
      });
    }
  };
}


module.exports = {
  ACTION_TYPES: ACTION_TYPES,
  RecordActions: RecordActions
};
