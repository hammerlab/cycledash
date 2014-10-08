/** @jsx React.DOM */
jest
    .dontMock('../cycledash/static/js/examine/ExaminePage.js')
    .dontMock('../cycledash/static/js/examine/VCFTable.js')
    .dontMock('../cycledash/static/js/examine/vcf.tools.js')
    .dontMock('./Utils.js')
    .dontMock('idiogrammatik.js')
    .dontMock('jquery')
    .dontMock('fs')
    .dontMock('vcf.js')
    .dontMock('underscore')
    ;

var Utils = require('./Utils');


describe('ExaminePage', function() {
  // modules -- must be require'd in beforeEach() or it().
  var React, TestUtils, VCFTable, ExaminePage, $;

  beforeEach(function() {
    React = require('react/addons');
    ExaminePage = require('../cycledash/static/js/examine/ExaminePage.js');
    VCFTable = require('../cycledash/static/js/examine/VCFTable');
    TestUtils = React.addons.TestUtils;
    $ = require('jquery');
  });

  // Fake for jQuery's $.get() which returns a test VCF.
  function fakeGet(path) {
    if (!path.match(/^\/vcf/)) {
      throw "Surprising AJAX request! " + path;
    }

    // Return an already-resolved deferred with the data.
    var data = require('fs').readFileSync('__tests__/data/snv.vcf', 'utf8');

    return $.when(data);
  }

  // Returns a rendered ExaminePage with fake data.
  function makeTestExaminePage() {
    spyOn($, 'get').andCallFake(fakeGet);
    var vcfPath = '/vcf/snv.vcf';
    return TestUtils.renderIntoDocument(
      <ExaminePage vcfPath={vcfPath} truthVcfPath={vcfPath}
                   normalBamPath="" tumorBamPath=""
                   igvHttpfsUrl="" karyogramData="" />);
  }

  function findVCFTable(tree) {
    return TestUtils.findRenderedComponentWithType(tree, VCFTable);
  }

  it('Shows the expected number of rows', function() {
    var examine = makeTestExaminePage();

    var rows = Utils.findInComponent('.vcf-table tbody tr', examine);
    expect(rows.length).toEqual(10);
  });

  it('Indicates when a column has been clicked', function() {
    var examine = makeTestExaminePage();

    expect(examine.state.selectedColumns.length).toBe(0);

    var vcfTable = findVCFTable(examine);
    expect(Utils.findInComponent('.selected', vcfTable).length).toEqual(0);

    var chartableAttrs = Utils.findInComponent('.chartable', vcfTable)
         .filter(el => (el.textContent == 'DP') );

    expect(chartableAttrs.length).toBe(3);  // {INFO, NORMAL, TUMOR}.DP
    chartableAttrs.forEach(el => TestUtils.Simulate.click(el));  // click all 3
    expect(examine.state.selectedColumns.length).toBe(3);

    expect(Utils.findInComponent('.selected', vcfTable).length).toEqual(3);
  });
});
