/** @jsx React.DOM */
jest
    .dontMock('../cycledash/static/js/examine/ExaminePage.js')
    .dontMock('../cycledash/static/js/examine/VCFTable.js')
    .dontMock('../cycledash/static/js/examine/vcf.tools.js')
    .dontMock('idiogrammatik.js')
    .dontMock('jquery')
    .dontMock('fs')
    .dontMock('vcf.js')
    .dontMock('underscore')
    ;


function log(msg) {
  require('fs').appendFileSync('/tmp/jest.log.txt', msg + '\n', {'encoding': 'utf8'});
}


describe('ExaminePage', function() {
  // Fake for jQuery's $.get()
  function fakeGet(path) {
    log('fakeGet: ' + path);
    if (!path.match(/^\/vcf/)) {
      throw "Surprising AJAX request! " + path;
    }

    // Return an already-resolved deferred with the data.
    log('Attempting to read data from $.get fake');
    var data = require('fs').readFileSync('__tests__/data/snv.vcf', 'utf8');
    log('... read ' + data.length + ' bytes from snv.vcf');

    var $ = require('jquery');
    return $.when(data);
  }

  it('Indicates which column has been clicked', function() {
    console.error('starting test');
    log('\n-----------\ntest start');
    var React = require('react/addons');
    var ExaminePage = require('../cycledash/static/js/examine/ExaminePage.js');
    var TestUtils = React.addons.TestUtils;
    var $ = require('jquery');

    spyOn($, 'get').andCallFake(fakeGet);

    log('Creating ExaminePage');
    var vcfPath = '/vcf/snv.vcf';
    this.examine = TestUtils.renderIntoDocument(
      <ExaminePage vcfPath={vcfPath} truthVcfPath={vcfPath}
                   normalBamPath="" tumorBamPath=""
                   igvHttpfsUrl="" karyogramData="" />);

    log('Done creating ExaminePage');
    var VCFTable = require('../cycledash/static/js/examine/VCFTable');
    var vcfTable = TestUtils.findRenderedComponentWithType(this.examine, VCFTable);
    var tbody = TestUtils.findRenderedDOMComponentWithTag(vcfTable, 'tbody');
    var trs = TestUtils.scryRenderedDOMComponentsWithTag(tbody, 'tr');
    expect(trs.length).toBe(10);
  });
});
