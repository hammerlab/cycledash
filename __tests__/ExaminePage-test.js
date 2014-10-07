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
    if (!path.match(/^\/vcf/)) {
      throw "Surprising AJAX request! " + path;
    }

    // Return an already-resolved deferred with the data.
    var data = require('fs').readFileSync('__tests__/data/snv.vcf', 'utf8');

    var $ = require('jquery');
    return $.when(data);
  }

  it('Shows the expected number of rows', function() {
    var React = require('react/addons');
    var ExaminePage = require('../cycledash/static/js/examine/ExaminePage.js');
    var TestUtils = React.addons.TestUtils;
    var $ = require('jquery');

    spyOn($, 'get').andCallFake(fakeGet);

    var vcfPath = '/vcf/snv.vcf';
    this.examine = TestUtils.renderIntoDocument(
      <ExaminePage vcfPath={vcfPath} truthVcfPath={vcfPath}
                   normalBamPath="" tumorBamPath=""
                   igvHttpfsUrl="" karyogramData="" />);

    var VCFTable = require('../cycledash/static/js/examine/VCFTable');
    var vcfTable = TestUtils.findRenderedComponentWithType(this.examine, VCFTable);
    var tbody = TestUtils.findRenderedDOMComponentWithTag(vcfTable, 'tbody');
    var trs = TestUtils.scryRenderedDOMComponentsWithTag(tbody, 'tr');
    expect(trs.length).toBe(10);
  });

  it('indicates when a column has been clicked', function() {
    var React = require('react/addons');
    var ExaminePage = require('../cycledash/static/js/examine/ExaminePage.js');
    var TestUtils = React.addons.TestUtils;
    var $ = require('jquery');

    spyOn($, 'get').andCallFake(fakeGet);

    var vcfPath = '/vcf/snv.vcf';
    this.examine = TestUtils.renderIntoDocument(
      <ExaminePage vcfPath={vcfPath} truthVcfPath={vcfPath}
                   normalBamPath="" tumorBamPath=""
                   igvHttpfsUrl="" karyogramData="" />);

    expect(this.examine.state.selectedColumns.length).toBe(0);

    var VCFTable = require('../cycledash/static/js/examine/VCFTable');
    var vcfTable = TestUtils.findRenderedComponentWithType(this.examine, VCFTable);
    var chartableAttrs =
        TestUtils.scryRenderedDOMComponentsWithClass(vcfTable, 'chartable')
                 .filter(function(el) { return el.getDOMNode().textContent == 'DP' });

    expect(chartableAttrs.length).toBe(3);  // {INFO, NORMAL, TUMOR}.DP
    // chart all three
    chartableAttrs.forEach(function(el) { TestUtils.Simulate.click(el); });
    expect(this.examine.state.selectedColumns.length).toBe(3);

    var selectedAttrs =
        TestUtils.scryRenderedDOMComponentsWithClass(vcfTable, 'selected');
    expect(selectedAttrs.length).toBe(3);
  });
});
