/** @jsx React.DOM */
jest
    .dontMock('../cycledash/static/js/examine/VCFTable.js')
    .dontMock('../cycledash/static/js/examine/vcf.tools.js')
    .dontMock('./Utils.js')
    .dontMock('jquery')
    .dontMock('fs')
    .dontMock('vcf.js')
    .dontMock('underscore')
    ;

var vcfTools = require('../cycledash/static/js/examine/vcf.tools.js'),
    _ = require('underscore'),
    $ = require('jquery'),
    assert = require('assert'),
    Utils = require('./Utils.js')
    ;

describe('VCFTable', function() {
  // modules -- must be require'd in beforeEach() or it().
  var React, TestUtils, VCFTable;

  beforeEach(function() {
    React = require('react/addons');
    VCFTable = require('../cycledash/static/js/examine/VCFTable.js');
    TestUtils = React.addons.TestUtils;
  });

  function loadVcfData(path) {
    var vcfParser = require('vcf.js').parser();
    var data = require('fs').readFileSync(path, {encoding: 'utf8'});
    return vcfParser(data);
  }

  function makeTestVCFTable(vcfData) {
    var columns = vcfTools.deriveColumns(vcfData);

    var pos = {start: null, end: null, chromosome: null};
    return TestUtils.renderIntoDocument(
                <VCFTable hasLoaded={true}
                          records={vcfData.records}
                          position={pos}
                          header={vcfData.header}
                          columns={columns}
                          selectedColumns={null}
                          selectedRecord={null}
                          chromosomes={['20']}
                          sortBy={[null, 'desc']}
                          handleSortByChange={_.noop}
                          handleChartChange={_.noop}
                          handleFilterUpdate={_.noop}
                          handleChromosomeChange={_.noop}
                          handleRangeChange={_.noop}
                          handleSelectRecord={_.noop} />);
  }

  it('should display all the VCF data it is given', function() {
    var vcfData = loadVcfData('__tests__/data/snv.vcf');
    var table = makeTestVCFTable(vcfData);

    var ths = Utils.findInComponent('th.attr', table);
    var attributes = _.map(ths, th => $(th).attr('data-attribute'));
    expect(attributes).toEqual(
      ['INFO::DP', 'INFO::SS', 'INFO::SSC', 'INFO::GPV', 'INFO::SPV',
       'NORMAL::GT', 'NORMAL::GQ', 'NORMAL::DP', 'NORMAL::RD', 'NORMAL::AD',
       'NORMAL::FREQ', 'NORMAL::DP4',
       'TUMOR::GT', 'TUMOR::GQ', 'TUMOR::DP', 'TUMOR::RD', 'TUMOR::AD',
       'TUMOR::FREQ', 'TUMOR::DP4'
    ]);

    var rows = Utils.findInComponent('tbody tr', table);
    expect(rows.length).toEqual(10);

    var positions = _.map(Utils.findInComponent('td.pos', table),
                          td => td.textContent);
    expect(positions).toEqual([
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
  });

  it('should render selected rows', function() {
    var vcfData = loadVcfData('__tests__/data/snv.vcf');
    var table = makeTestVCFTable(vcfData);
    expect(Utils.findInComponent('tr.selected', table)).toEqual([]);

    function selectedPos() {
      var selectedPos = Utils.findInComponent('tr.selected td.pos', table);
      assert.equal(selectedPos.length, 1);
      return selectedPos[0].textContent;
    }

    table.setProps({selectedRecord: vcfData.records[0]});
    expect(selectedPos()).toEqual('20::61795');

    table.setProps({selectedRecord: vcfData.records[5]});
    expect(selectedPos()).toEqual('20::66370');

    table.setProps({selectedRecord: null});
    expect(Utils.findInComponent('tr.selected', table)).toEqual([]);
  });

  it('should render selected columns', function() {
    var vcfData = loadVcfData('__tests__/data/snv.vcf');
    var table = makeTestVCFTable(vcfData),
        columns = vcfTools.deriveColumns(vcfData);

    function selectedColumns() {
      return _.map(Utils.findInComponent('th.selected', table),
                   td => $(td).attr('data-attribute'));
    }

    expect(selectedColumns()).toEqual([]);

    table.setProps({selectedColumns: [columns.INFO.DP]});
    expect(selectedColumns()).toEqual(['INFO::DP']);

    table.setProps({selectedColumns: [columns.INFO.DP, columns.NORMAL.AD]});
    expect(selectedColumns()).toEqual(['INFO::DP', 'NORMAL::AD']);

    table.setProps({selectedColumns: []});
    expect(selectedColumns()).toEqual([]);
  });
});
