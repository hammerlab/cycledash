/** @jsx React.DOM */
jest
    .dontMock('../cycledash/static/js/examine/DataStore.js')
    .dontMock('../cycledash/static/js/examine/ExaminePage.js')
    .dontMock('../cycledash/static/js/examine/VCFTable.js')
    .dontMock('../cycledash/static/js/examine/vcf.tools.js')
    .dontMock('../cycledash/static/js/examine/utils.js')
    .dontMock('./Utils.js')
    .dontMock('idiogrammatik.js')
    .dontMock('jquery')
    .dontMock('fs')
    .dontMock('vcf.js')
    .dontMock('underscore')
    ;

var Utils = require('./Utils')
    _ = require('underscore')
    ;


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

  function positions(examine) {
    return _.map(Utils.findInComponent('td.pos', examine),
                                       td => td.textContent);
  }

  it('Should sort by position by default', function() {
    var examine = makeTestExaminePage();

    expect(positions(examine)).toEqual([
      '20::61795',
      '20::62731',
      '20::63799',
      '20::65288',
      '20::65900',
      '20::66370',
      '20::68749',
      '20::69094',
      '20::69408',
      '20::75254'
    ]);

    examine.setState({sortBy: [null, 'asc']});
    expect(positions(examine)).toEqual([
      '20::75254',
      '20::69408',
      '20::69094',
      '20::68749',
      '20::66370',
      '20::65900',
      '20::65288',
      '20::63799',
      '20::62731',
      '20::61795'
    ]);
  });

  it('Should filter by position', function() {
    var examine = makeTestExaminePage();
    examine.setState({position: {start: null, end: null, chromosome: '20'}});
    expect(positions(examine).length).toEqual(10);  // all on chr20
    examine.setState({position: {start: null, end: null, chromosome: '19'}});
    expect(positions(examine).length).toEqual(0);
    examine.setState({position: {start: 69000, end: null, chromosome: '20'}});
    expect(positions(examine)).toEqual(['20::69094', '20::69408', '20::75254']);
    examine.setState({position: {start: null, end: 65000, chromosome: '20'}});
    expect(positions(examine)).toEqual(['20::61795', '20::62731', '20::63799']);
  });

  it('Should filter by numbers', function() {
    var examine = makeTestExaminePage();

    expect(positions(examine).length).toEqual(10);
    examine.setState({filters: [{path: ['INFO', 'DP'], filter: '>70'}]});
    expect(positions(examine)).toEqual([
      '20::61795',  // DP=81
      '20::63799',  // DP=72
      '20::75254'   // DP=74
    ]);

    examine.setState({filters: [{path: ['INFO', 'DP'], filter: '<50'}]});
    expect(positions(examine)).toEqual([
      '20::65288',  // DP=35
      '20::69094'   // DP=25
    ]);

    // Combined filter
    examine.setState({filters: [
      {path: ['INFO', 'DP'], filter: '>70'},
      {path: ['INFO', 'SSC'], filter: '>5'},
    ]});
    expect(positions(examine)).toEqual([
      '20::63799',  // DP=72,SSC=7
      '20::75254'   // DP=74,SSC=9
    ]);
  });

  // TODO: filter by regex

  // TODO: filter by type
});
