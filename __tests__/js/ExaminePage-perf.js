/** @jsx React.DOM */
/**
 * Performance test for ExaminePage.
 *
 * You probably want to run this via the scripts/perf-test.sh script.
 *
 * This loads two VCF files (specified in environment variables), renders an
 * ExaminePage and then selects two records, one after the other.
 *
 * TODO: do some sorting and filtering.
 */

jest.dontMock('../../cycledash/static/js/examine/RecordStore.js')
    .dontMock('../../cycledash/static/js/examine/RecordActions.js')
    .dontMock('../../cycledash/static/js/examine/Dispatcher.js')
    .dontMock('../../cycledash/static/js/examine/components/ExaminePage.js')
    .dontMock('../../cycledash/static/js/examine/vcf.tools.js')
    .dontMock('../../cycledash/static/js/examine/utils.js')
    .dontMock('./Utils.js')
    .dontMock('idiogrammatik.js')
    .dontMock('jquery')
    .dontMock('fs')
    .dontMock('vcf.js')
    .dontMock('underscore')
    .dontMock('process');

var Utils = require('./Utils'),
    fs = require('fs'),
    _ = require('underscore');


class Timer {
  constructor() {
    console.log('Starting timer...');
    this.startMs = Date.now();
    this.lastTickMs = this.startMs;
  }

  tick(msg) {
    var tickMs = Date.now();
    console.log((tickMs - this.startMs) + 'ms, ' + (tickMs - this.lastTickMs) + 'ms lap: ' + msg);
    this.lastTickMs = tickMs;
  }
}


describe('ExaminePage', function() {
  // modules -- must be require'd in beforeEach() or it().
  var React, TestUtils, ExaminePage, $, RecordStore, RecordActions, Dispatcher;

  beforeEach(function() {
    React = require('react/addons');
    ExaminePage = require('../../cycledash/static/js/examine/components/ExaminePage.js');
    RecordStore = require('../../cycledash/static/js/examine/RecordStore.js');
    RecordActions = require('../../cycledash/static/js/examine/RecordActions.js').RecordActions;
    Dispatcher = require('../../cycledash/static/js/examine/Dispatcher.js');
    TestUtils = React.addons.TestUtils;
    $ = require('jquery');
  });


  it('should perform reasonably', function() {
     // We prefer to parse the VCFs ourselves to get more fine-grained timing
     // data. To make this work, we intercept both the ExaminePage XHR and the
     // VCF parser.
     var vcf = require('vcf.js');
     var runVcf, truthVcf;
     var parseVcf = vcf.parser();  // Note: the real deal, not a fake!
     spyOn($, 'get').andCallFake(path => $.when(path));
     spyOn(vcf, 'parser').andCallFake(() => function(path) {
     if (path == '/vcf/run') {
     return runVcf;
     } else if (path == '/vcf/truth') {
     return truthVcf;
     }
     throw 'Unexpected VCF path: ' + path;
     });
     var env = require('process').env;
     if (!env.RUN_VCF || !env.TRUTH_VCF) {
     throw new Error("ENV must have RUN_VCF and TRUTH_VCF. See scripts/perf-test.sh");
     }

     var timer = new Timer();
     runVcf = parseVcf(fs.readFileSync(env.RUN_VCF, {encoding:'utf8'}));
     timer.tick('Parsed run VCF');
     truthVcf = parseVcf(fs.readFileSync(env.TRUTH_VCF, {encoding:'utf8'}));
     timer.tick('Parsed truth VCF');

     var vcfPath = "/run";
     var truthVcfPath = "/truth";

     var dispatcher = new Dispatcher();
     var recordActions = RecordActions(dispatcher);
     var recordStore = RecordStore(vcfPath, truthVcfPath, dispatcher);
     var examine = TestUtils.renderIntoDocument(
     <ExaminePage recordStore={recordStore}
     recordActions={recordActions}
     vcfPath={vcfPath}
     truthVcfPath={truthVcfPath}
     normalBamPath="" tumorBamPath=""
     igvHttpfsUrl="" karyogramData="" />);
     timer.tick('Constructed <ExaminePage/>');

     examine.setState({selectedRecord: examine.state.records[0]});
     timer.tick('Selected first record');

     examine.setState({selectedRecord: examine.state.records[99]});
     timer.tick('Selected 99th record');
     });
});
