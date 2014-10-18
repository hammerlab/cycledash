/** @jsx React.DOM */
"use strict";

var React = require('react'),
    GSTAINED_CHROMOSOMES = require('../../data/gstained-chromosomes'),
    ExaminePage = require('./components/ExaminePage'),
    Dispatcher = require('./Dispatcher'),
    RecordStore = require('./RecordStore'),
    RecordActions = require('./RecordActions').RecordActions;


window.renderExaminePage = function(el, vcfPath, truthVcfPath,
                                    normalBamPath, tumorBamPath, igvHttpfsUrl) {
  var dispatcher = new Dispatcher();
  var recordActions = RecordActions(dispatcher);
  var recordStore = RecordStore(vcfPath, truthVcfPath, dispatcher);

  React.renderComponent(<ExaminePage recordStore={recordStore}
                                     recordActions={recordActions}
                                     vcfPath={vcfPath}
                                     truthVcfPath={truthVcfPath}
                                     normalBamPath={normalBamPath}
                                     tumorBamPath={tumorBamPath}
                                     igvHttpfsUrl={igvHttpfsUrl}
                                     karyogramData={GSTAINED_CHROMOSOMES} />, el);
};
