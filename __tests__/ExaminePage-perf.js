/** @jsx React.DOM */
jest
    .dontMock('../cycledash/static/js/examine/DataStore.js')
    .dontMock('../cycledash/static/js/examine/ExaminePage.js')
    .dontMock('../cycledash/static/js/examine/vcf.tools.js')
    .dontMock('../cycledash/static/js/examine/utils.js')
    .dontMock('./Utils.js')
    .dontMock('idiogrammatik.js')
    .dontMock('jquery')
    .dontMock('fs')
    .dontMock('vcf.js')
    .dontMock('underscore')
    .dontMock('process')
    ;

var Utils = require('./Utils'),
    fs = require('fs'),
    _ = require('underscore')
    ;


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
  var React, TestUtils, ExaminePage, $;

  beforeEach(function() {
    React = require('react/addons');
    ExaminePage = require('../cycledash/static/js/examine/ExaminePage.js');
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
      throw "ENV must have RUN_VCF and TRUTH_VCF. See scripts/perf-test.sh";
    }

    var timer = new Timer();
    runVcf = parseVcf(fs.readFileSync(env.RUN_VCF, {encoding:'utf8'}));
    timer.tick('Parsed run VCF');
    truthVcf = parseVcf(fs.readFileSync(env.TRUTH_VCF, {encoding:'utf8'}));
    timer.tick('Parsed truth VCF');

    var examine = TestUtils.renderIntoDocument(
      <ExaminePage vcfPath="/run"
                   truthVcfPath="/truth"
                   normalBamPath="" tumorBamPath=""
                   igvHttpfsUrl="" karyogramData="" />);
    timer.tick('Constructed <ExaminePage/>');

    examine.setState({selectedRecord: examine.props.records[0]});
    timer.tick('Selected first record');

    examine.setState({selectedRecord: examine.props.records[99]});
    timer.tick('Selected 99th record');
  });
});
