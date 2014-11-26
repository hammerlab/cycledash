// TODO: do some sorting and filtering.

require('./testdom')('<html><body></body></html>');
var React = require('react/addons'),
    assert = require('assert'),
    _ = require('underscore'),
    sinon = require('sinon');

global.reactModulesToStub = [
  'components/BioDalliance.js'
];

var ExaminePage = require('../../cycledash/static/js/examine/components/ExaminePage');
    RecordStore = require('../../cycledash/static/js/examine/RecordStore'),
    RecordActions = require('../../cycledash/static/js/examine/RecordActions'),
    Dispatcher = require('../../cycledash/static/js/examine/Dispatcher'),
    TestUtils = React.addons.TestUtils,
    Utils = require('./Utils'),
    dataUtils = require('./data-utils'),
    vcf = require('vcf.js'),
    fs = require('fs'),
    $ = require('jquery');


describe('ExaminePage', function() {
  var fakeServer, records;

  before(function() {
    fakeServer = dataUtils.makeFakeServer('tests/js/data/snv.vcf');
    records = fakeServer.records;
    // TODO(danvk): look into using sinon's XHR mocking tools.
    sinon.stub($, 'get', fakeServer);
  });

  after(function() {
    $.get.restore();
  });

  it('should display and select records', function() {
    var dispatcher = new Dispatcher();
    var recordActions = RecordActions.getRecordActions(dispatcher);
    var recordStore = RecordStore(1, dispatcher);
    var run = {
      id: 1,
      caller_name: 'test',
      dataset_name: 'test',
      created_at: '',
      uri: '/tests/js/data/snv.vcf'
    };
    var examine = TestUtils.renderIntoDocument(
      <ExaminePage recordStore={recordStore}
                   recordActions={recordActions}
                   igvHttpfsUrl="" 
                   run={run} />);

    // One row for each record x sample
    assert.equal(20, Utils.findInComponent('.vcf-table tbody tr', examine).length);

    function selectedPos() {
      var selectedPos =
          Utils.findInComponent('.vcf-table tr.selected td.pos', examine);
      assert.ok(selectedPos.length <= 1);
      return selectedPos.length == 1 ? selectedPos[0].textContent : null;
    }
    assert.equal(null, selectedPos());

    examine.handleSelectRecord(records[0]);
    assert.equal('20::61795', selectedPos());

    examine.handleSelectRecord(records[19]);
    assert.equal('20::75254', selectedPos());

    examine.handleSelectRecord(null);
    assert.equal(null, selectedPos());
  });
});
