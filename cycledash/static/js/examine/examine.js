"use strict";

var React = require('react'),
    ReactDOM = require('react-dom'),
    ExaminePage = require('./components/ExaminePage'),
    Dispatcher = require('./Dispatcher'),
    createRecordStore = require('./RecordStore'),
    getRecordActions = require('./RecordActions').getRecordActions;


window.renderExaminePage = function(el, vcf, comparableVcfs,
                                    igvHttpfsUrl, currentUser) {
  var dispatcher = new Dispatcher();
  var recordActions = getRecordActions(dispatcher);
  var recordStore = createRecordStore(vcf, igvHttpfsUrl, dispatcher);
  ReactDOM.render(<ExaminePage recordStore={recordStore}
                               recordActions={recordActions}
                               comparableVcfs={comparableVcfs}
                               vcf={vcf}
                               currentUser={currentUser}
                               igvHttpfsUrl={igvHttpfsUrl} />, el);
};
