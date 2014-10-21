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
        path,
        order
      });
    },
    updateFilters: function({path, filterValue}) {
      dispatcher.dispatch({
        actionType: ACTION_TYPES.UPDATE_FILTER,
        path,
        filterValue
      });
    },
    updateRecordRange: function({chromosome, start, end}) {
      dispatcher.dispatch({
        actionType: ACTION_TYPES.SELECT_RECORD_RANGE,
        start,
        end,
        chromosome
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
    selectColumn: function({path, info, name}) {
      dispatcher.dispatch({
        actionType: ACTION_TYPES.SELECT_COLUMN,
        path,
        info,
        name
      });
    }
  };
}


module.exports = {ACTION_TYPES, RecordActions};
