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


describe('ExaminePage', function() {
  // Fake for jQuery's $.get() which returns a test VCF.
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
    var examine = TestUtils.renderIntoDocument(
      <ExaminePage vcfPath={vcfPath} truthVcfPath={vcfPath}
                   normalBamPath="" tumorBamPath=""
                   igvHttpfsUrl="" karyogramData="" />);

    var VCFTable = require('../cycledash/static/js/examine/VCFTable');
    var vcfTable = TestUtils.findRenderedComponentWithType(examine, VCFTable);
    var tbody = TestUtils.findRenderedDOMComponentWithTag(vcfTable, 'tbody');
    var trs = TestUtils.scryRenderedDOMComponentsWithTag(tbody, 'tr');
    expect(trs.length).toBe(10);
  });

  it('Indicates when a column has been clicked', function() {
    var React = require('react/addons');
    var ExaminePage = require('../cycledash/static/js/examine/ExaminePage.js');
    var TestUtils = React.addons.TestUtils;
    var $ = require('jquery');

    spyOn($, 'get').andCallFake(fakeGet);

    var vcfPath = '/vcf/snv.vcf';
    var examine = TestUtils.renderIntoDocument(
      <ExaminePage vcfPath={vcfPath} truthVcfPath={vcfPath}
                   normalBamPath="" tumorBamPath=""
                   igvHttpfsUrl="" karyogramData="" />);

    expect(examine.state.selectedColumns.length).toBe(0);

    var VCFTable = require('../cycledash/static/js/examine/VCFTable');
    var vcfTable = TestUtils.findRenderedComponentWithType(examine, VCFTable);
    var chartableAttrs =
        TestUtils.scryRenderedDOMComponentsWithClass(vcfTable, 'chartable')
                 .filter(el => (el.getDOMNode().textContent == 'DP') );

    expect(chartableAttrs.length).toBe(3);  // {INFO, NORMAL, TUMOR}.DP
    chartableAttrs.forEach(el => TestUtils.Simulate.click(el));  // chart all 3
    expect(examine.state.selectedColumns.length).toBe(3);

    var selectedAttrs =
        TestUtils.scryRenderedDOMComponentsWithClass(vcfTable, 'selected');
    expect(selectedAttrs.length).toBe(3);
  });
});
