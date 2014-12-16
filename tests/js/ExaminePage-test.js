// TODO: do some sorting and filtering.
'use strict';

require('./testdom')('<html><body></body></html>');
var React = require('react/addons'),
    assert = require('assert'),
    _ = require('underscore'),
    sinon = require('sinon');

global.reactModulesToStub = [
  'components/BioDalliance.js'
];

var ExaminePage = require('../../cycledash/static/js/examine/components/ExaminePage'),
    QueryBox = require('../../cycledash/static/js/examine/components/QueryBox'),
    createRecordStore = require('../../cycledash/static/js/examine/RecordStore'),
    RecordActions = require('../../cycledash/static/js/examine/RecordActions'),
    Dispatcher = require('../../cycledash/static/js/examine/Dispatcher'),
    TestUtils = React.addons.TestUtils,
    Utils = require('./Utils'),
    DataUtils = require('./DataUtils');


function renderExamine(fakeServer) {
  var run = {
    id: 1,
    spec: fakeServer.spec,
    contigs: fakeServer.contigs,
    caller_name: 'test',
    dataset_name: 'test',
    created_at: '',
    uri: '/tests/data/snv.vcf'
  };

  var dispatcher = new Dispatcher(),
      recordActions = RecordActions.getRecordActions(dispatcher),
      recordStore = createRecordStore(run, dispatcher, fakeServer);

  return TestUtils.renderIntoDocument(
      <ExaminePage recordStore={recordStore}
                   recordActions={recordActions}
                   igvHttpfsUrl=""
                   run={run} />);
}


describe('ExaminePage', function() {
  // This is a rather slow suite, so give it a heftier 5s timeout.
  this.timeout(5000);

  var fakeServer, records, displayedQuery, stub, examine;

  before(function() {
    global.XMLHttpRequest = function() {};
    fakeServer = DataUtils.makeFakeServer('tests/data/snv.vcf', _.noop);
    records = fakeServer.records;
    stub = Utils.stubReactMethod(QueryBox, 'setDisplayedQuery', function(str) {
      displayedQuery = str;
    });
  });

  beforeEach(function() {
    examine = renderExamine(fakeServer);
  });

  after(function() {
    stub.restore();
  });

  it('should display and select records', function() {
    assert.ok(examine.state.hasLoaded);

    // The default query should be filled into CQL box.
    assert.equal('ORDER BY contig, position', displayedQuery);

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
    assert.equal('20:61795', selectedPos());

    examine.handleSelectRecord(records[19]);
    assert.equal('20:75254', selectedPos());

    examine.handleSelectRecord(null);
    assert.equal(null, selectedPos());
  });

  it('should show the right columns', function() {
    assert.ok(examine.state.hasLoaded);

    // Make sure all 19 columns are here.
    var totalColumns = Utils.findInComponent(
        '.vcf-table thead tr:nth-child(2) th', examine).length;
    assert.equal(totalColumns, 19);

    var columnAttributes = Utils.findInComponent(
        '.vcf-table thead tr:nth-child(2) th', examine).map(function(el) {
          var attr = el.attributes['data-attribute'];
          if (attr) {
            return attr.value;
          }
        });

    // Make sure some specific columns both in and out of 'sample' and 'info'
    // are here.
    assert.ok(_.contains(columnAttributes, 'position'));
    assert.ok(_.contains(columnAttributes, 'info:SOMATIC'));
    assert.ok(_.contains(columnAttributes, 'info:SPV'));
    assert.ok(_.contains(columnAttributes, 'info:DP'));
    assert.ok(_.contains(columnAttributes, 'sample:FREQ'));
    assert.ok(_.contains(columnAttributes, 'sample:DP'));
  });
});
