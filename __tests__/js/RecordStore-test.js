/** @jsx React.DOM */
require('./testdom')('<html><body></body></html>');

var _ = require('underscore'),
    Utils = require('./Utils.js'),
    ACTION_TYPES = require('../../cycledash/static/js/examine/RecordActions.js').ACTION_TYPES,
    $ = require('jquery'),
    sinon = require('sinon'),
    RecordStore = require('../../cycledash/static/js/examine/RecordStore.js');
    assert = require('assert');

var TEST_VCF_PATH = '__tests__/js/data/snv.vcf';
sinon.stub($, 'get', Utils.fakeGet(TEST_VCF_PATH));

describe('RecordStore', function() {
  function getFreshRecordStore() {
    return RecordStore('/vcf/snv.vcf', '/vcf/snv.vcf');
  }

  it('should load VCF records', function() {
    var rs = getFreshRecordStore();

    assert.ok(rs.getState().hasLoadedVcfs);
    assert.equal(rs.getState().records.length, 10);
  });

  it('should sort records by INFO:DP', function() {
    var rs = getFreshRecordStore();

    var originalDps = _.pluck(_.pluck(rs.getState().records, 'INFO'), 'DP'),
        sortedDps = _.pluck(_.pluck(rs.getState().records, 'INFO'), 'DP');
    sortedDps.sort((a, b) => a - b);

    rs.receiver({actionType: ACTION_TYPES.SORT_BY,
                 path: ['INFO', 'DP'], order:'asc'});

    var storeDps = _.pluck(_.pluck(rs.getState().records, 'INFO'), 'DP');

    assert.deepEqual(storeDps, sortedDps);
    assert.notDeepEqual(storeDps, originalDps);
  });

  it('should filter to DP = 53', function() {
    var rs = getFreshRecordStore();

    var filteredDps = _.filter(_.pluck(_.pluck(
      rs.getState().records, 'INFO'), 'DP'), dp => dp == 53);

    rs.receiver({actionType: ACTION_TYPES.UPDATE_FILTER,
                 path: ['INFO', 'DP'], filterValue: '=53'});

    var storeDps = _.pluck(_.pluck(rs.getState().records, 'INFO'), 'DP');

    assert.deepEqual(storeDps, filteredDps);
  });

  it('should filter to DP > 55 and then NORMAL:GT = 1/1', function() {
    var rs = getFreshRecordStore();

    var filteredDps = _.filter(_.pluck(_.pluck(
      rs.getState().records, 'INFO'), 'DP'), dp => dp > 55);

    var filteredDpsGt = _.filter(rs.getState().records, record => {
      return record.INFO.DP > 55 && record.NORMAL.GT == '1/1';
    });
    filteredDpsGt = _.map(filteredDpsGt, record => record.NORMAL.GT);

    rs.receiver({actionType: ACTION_TYPES.UPDATE_FILTER,
                 path: ['INFO', 'DP'], filterValue: '>55'});

    var storeDps = _.pluck(_.pluck(rs.getState().records, 'INFO'), 'DP');

    rs.receiver({actionType: ACTION_TYPES.UPDATE_FILTER,
                 path: ['NORMAL', 'GT'], filterValue: '1/1'});

    var storeDpsGt = _.pluck(_.pluck(rs.getState().records, 'NORMAL'), 'GT');

    assert.deepEqual(storeDps, filteredDps);
    assert.deepEqual(storeDpsGt, filteredDpsGt);
  });

  it('should select a range within chromosome 20', function() {
    var rs = getFreshRecordStore();

    var withinRangeRecords = _.filter(rs.getState().records, record => {
      return record.POS >= 66370;
    });

    rs.receiver({actionType: ACTION_TYPES.SELECT_RECORD_RANGE,
                 chromosome: '20', start: 66370, end: null});

    var storeRecords = rs.getState().records;

    assert.equal(storeRecords.length, withinRangeRecords.length);
  });

  it('should select a range, filter by NORMAL:AD > 25, and sort by desc position', function() {
    var rs = getFreshRecordStore();

    var validatedRecords = _.filter(rs.getState().records, record => {
      return record.POS < 70000 && record.NORMAL.AD > 25;
    });
    validatedRecords = validatedRecords.sort((a, b) => b.POS - a.POS);

    rs.receiver({actionType: ACTION_TYPES.SORT_BY,
                 path: null, order:'desc'});

    rs.receiver({actionType: ACTION_TYPES.UPDATE_FILTER,
                 path: ['NORMAL', 'AD'], filterValue: '>25'});

    rs.receiver({actionType: ACTION_TYPES.SELECT_RECORD_RANGE,
                 chromosome: '20', start: 0, end: 70000});

    var storeRecords = rs.getState().records;

    assert.equal(storeRecords.length, validatedRecords.length);
    assert.deepEqual(storeRecords, validatedRecords);
  });

  it('should apply a filter, then remove it', function() {
    var rs = getFreshRecordStore();
    var getAlts = () => rs.getState().records.map((r) => r.ALT[0]);
    var originalAlts = getAlts();

    rs.receiver({actionType: ACTION_TYPES.UPDATE_FILTER,
                path: ['ALT'], filterValue: 'C'});
    var filteredAlts = getAlts();

    rs.receiver({actionType: ACTION_TYPES.UPDATE_FILTER,
                path: ['ALT'], filterValue: ''});
    var defilteredAlts = getAlts();

    assert.equal(originalAlts.length, 10);
    assert.deepEqual(filteredAlts, ['C']);
    assert.equal(defilteredAlts.length, 10);
  });
});
