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

require('./testdom')('<html><body></body></html>');
var React = require('react/addons'),
    assert = require('assert'),
    fs = require('fs'),
    _ = require('underscore'),
    sinon = require('sinon');

global.reactModulesToStub = [
  'components/BioDalliance.js',
  'components/AttributeCharts.js'
];

var ExaminePage = require('../../cycledash/static/js/examine/components/ExaminePage');
    RecordStore = require('../../cycledash/static/js/examine/RecordStore'),
    RecordActions = require('../../cycledash/static/js/examine/RecordActions').RecordActions,
    Dispatcher = require('../../cycledash/static/js/examine/Dispatcher'),
    TestUtils = React.addons.TestUtils,
    Utils = require('./Utils'),
    $ = require('jquery'),
    vcf = require('vcf.js');


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
  after(function() {
    $.get.restore();
    vcf.parser.restore();
  });

  it('should perform reasonably', function() {
    // We prefer to parse the VCFs ourselves to get more fine-grained timing
    // data. To make this work, we intercept both the ExaminePage XHR and the
    // VCF parser.
    var runVcf, truthVcf;
    var parseVcf = vcf.parser();  // Note: the real deal, not a fake!
    sinon.stub($, 'get', path => $.when([path]));
    sinon.stub(vcf, 'parser', () => function(path) {
      if (path == '/vcf/run') {
        return runVcf;
      } else if (path == '/vcf/truth') {
        return truthVcf;
      }
      throw 'Unexpected VCF path: ' + path;
    });

    // This script can either be run via scripts/perf-test.sh (in which case
    // it's a performance test) or via Mocha (in which case it's a unit test).
    var env = require('process').env;
    var testDataFile = '__tests__/js/data/snv.vcf'
    var runVcfPath = env.RUN_VCF || testDataFile;
    var truthVcfPath = env.TRUTH_VCF || testDataFile;
    var isUnitTest = runVcfPath == testDataFile && truthVcfPath == testDataFile;

    var timer = new Timer();
    runVcf = parseVcf(fs.readFileSync(runVcfPath, {encoding:'utf8'}));
    timer.tick('Parsed run VCF');
    truthVcf = parseVcf(fs.readFileSync(truthVcfPath, {encoding:'utf8'}));
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

    function selectedPos() {
      var selectedPos =
          Utils.findInComponent('.vcf-table tr.selected td.pos', examine);
      assert.ok(selectedPos.length <= 1);
      return selectedPos.length == 1 ? selectedPos[0].textContent : null;
    }
    if (isUnitTest) assert.equal(null, selectedPos());

    examine.setState({selectedRecord: examine.state.records[0]});
    timer.tick('Selected first record');
    if (isUnitTest) assert.equal('20::61795', selectedPos());

    examine.setState({selectedRecord: examine.state.records[9]});
    timer.tick('Selected 9th record');
    if (isUnitTest) assert.equal('20::75254', selectedPos());
  });
});
