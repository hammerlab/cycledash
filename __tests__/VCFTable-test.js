/** @jsx React.DOM */
jest
    .dontMock('../cycledash/static/js/examine/VCFTable.js')
    .dontMock('../cycledash/static/js/examine/vcf.tools.js')
    .dontMock('jquery')
    .dontMock('fs')
    .dontMock('vcf.js')
    .dontMock('underscore')
    ;

var vcfTools = require('../cycledash/static/js/examine/vcf.tools.js'),
    _ = require('underscore'),
    $ = require('jquery')
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

  it('should display all the VCF data it is given', function() {
    var vcfData = loadVcfData('__tests__/data/snv.vcf');
    var columns = vcfTools.deriveColumns(vcfData);

    expect(VCFTable).not.toBe(undefined);

    var pos = {start: null, end: null, chromosome: null};
    var table = TestUtils.renderIntoDocument(
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

    var ths = $(table.getDOMNode()).find('th.attr').toArray();
    var attributes = _.map(ths, th => $(th).attr('data-attribute'));
    expect(attributes).toEqual(
      ['INFO::DP', 'INFO::SS', 'INFO::SSC', 'INFO::GPV', 'INFO::SPV',
       'NORMAL::GT', 'NORMAL::GQ', 'NORMAL::DP', 'NORMAL::RD', 'NORMAL::AD',
       'NORMAL::FREQ', 'NORMAL::DP4',
       'TUMOR::GT', 'TUMOR::GQ', 'TUMOR::DP', 'TUMOR::RD', 'TUMOR::AD',
       'TUMOR::FREQ', 'TUMOR::DP4'
    ]);
  });
});
