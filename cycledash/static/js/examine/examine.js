"use strict";

var React = require('react'),
    ExaminePage = require('./components/ExaminePage'),
    Dispatcher = require('./Dispatcher'),
    createRecordStore = require('./RecordStore'),
    getRecordActions = require('./RecordActions').getRecordActions;


window.renderExaminePage = function(el, run, igvHttpfsUrl) {
  var dispatcher = new Dispatcher();
  var recordActions = getRecordActions(dispatcher);
  var recordStore = createRecordStore(run, igvHttpfsUrl, dispatcher);
  React.render(<ExaminePage recordStore={recordStore}
                            recordActions={recordActions}
                            run={run}
                            igvHttpfsUrl={igvHttpfsUrl} />, el);
};
