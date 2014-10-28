/** @jsx React.DOM */
require('./testdom')('<html><body></body></html>');

var vcfTools = require('../../cycledash/static/js/examine/vcf.tools.js'),
    _ = require('underscore'),
    $ = require('jquery'),
    assert = require('assert'),
    Utils = require('./Utils.js'),
    React = require('react/addons'),
    VCFTable = require('../../cycledash/static/js/examine/components/VCFTable.js'),
    TestUtils = React.addons.TestUtils;

describe('VCFTable', function() {
  function makeTestVCFTable(vcfData) {
    var columns = vcfTools.deriveColumns(vcfData);

    var range = {start: null, end: null, chromosome: null};
    return TestUtils.renderIntoDocument(
                <VCFTable hasLoaded={true}
                          records={vcfData.records}
                          range={range}
                          header={vcfData.header}
                          columns={columns}
                          selectedColumns={[]}
                          selectedRecord={null}
                          chromosomes={['20']}
                          sortBy={{path: null, order: 'desc'}}
                          handleSortByChange={_.noop}
                          handleChartChange={_.noop}
                          handleFilterUpdate={_.noop}
                          handleChromosomeChange={_.noop}
                          handleRangeChange={_.noop}
                          handleSelectRecord={_.noop} />);
  }

  it('should display all the VCF data it is given', function() {
    var vcfData = Utils.loadVcfData('__tests__/js/data/snv.vcf');
    var table = makeTestVCFTable(vcfData);

    var ths = Utils.findInComponent('th.attr', table);
    var attributes = _.map(ths, th => $(th).attr('data-attribute'));
    assert.deepEqual(attributes,
      ['INFO::DP', 'INFO::SS', 'INFO::SSC', 'INFO::GPV', 'INFO::SPV',
       'NORMAL::GT', 'NORMAL::GQ', 'NORMAL::DP', 'NORMAL::RD', 'NORMAL::AD',
       'NORMAL::FREQ', 'NORMAL::DP4',
       'TUMOR::GT', 'TUMOR::GQ', 'TUMOR::DP', 'TUMOR::RD', 'TUMOR::AD',
       'TUMOR::FREQ', 'TUMOR::DP4'
    ]);

    var rows = Utils.findInComponent('tbody tr', table);
    assert.equal(rows.length, 10);

    var positions = _.map(Utils.findInComponent('td.pos', table),
                          td => td.textContent);
    assert.deepEqual(positions, [
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
    var vcfData = Utils.loadVcfData('__tests__/js/data/snv.vcf');
    var table = makeTestVCFTable(vcfData);
    assert.deepEqual(Utils.findInComponent('tr.selected', table), []);

    function selectedPos() {
      var selectedPos = Utils.findInComponent('tr.selected td.pos', table);
      assert.equal(selectedPos.length, 1);
      return selectedPos[0].textContent;
    }

    table.setProps({selectedRecord: vcfData.records[0]});
    assert.equal(selectedPos(), '20::61795');

    table.setProps({selectedRecord: vcfData.records[5]});
    assert.equal(selectedPos(), '20::66370');

    table.setProps({selectedRecord: null});
    assert.deepEqual(Utils.findInComponent('tr.selected', table), []);
  });

  it('should render selected columns', function() {
    var vcfData = Utils.loadVcfData('__tests__/js/data/snv.vcf');
    var table = makeTestVCFTable(vcfData),
        columns = vcfTools.deriveColumns(vcfData);

    function selectedColumns() {
      return _.map(Utils.findInComponent('th.selected', table),
                   td => $(td).attr('data-attribute'));
    }

    assert.deepEqual(selectedColumns(), []);

    table.setProps({selectedColumns: [columns.INFO.DP]});
    assert.deepEqual(selectedColumns(), ['INFO::DP']);

    table.setProps({selectedColumns: [columns.INFO.DP, columns.NORMAL.AD]});
    assert.deepEqual(selectedColumns(), ['INFO::DP', 'NORMAL::AD']);

    table.setProps({selectedColumns: []});
    assert.deepEqual(selectedColumns(), []);
  });
});
