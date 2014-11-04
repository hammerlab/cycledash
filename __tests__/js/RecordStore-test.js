/** @jsx React.DOM */
require('./testdom')('<html><body></body></html>');

var _ = require('underscore'),
    Utils = require('./Utils.js'),
    ACTION_TYPES = require('../../cycledash/static/js/examine/RecordActions.js').ACTION_TYPES,
    $ = require('jquery'),
    sinon = require('sinon'),
    RecordStore = require('../../cycledash/static/js/examine/RecordStore.js');
    ExamineUtils = require('../../cycledash/static/js/examine/utils.js');
    assert = require('assert');

var TEST_VCF_PATH = '__tests__/js/data/snv.vcf';

describe('RecordStore', function() {
  before(function() {
    sinon.stub($, 'get', Utils.fakeGet(TEST_VCF_PATH));
  });
  after(function() {
    $.get.restore();
  });

  function getFreshRecordStore() {
    return RecordStore('/vcf/snv.vcf', '/vcf/snv.vcf');
  }

  function getValues(recordStore, ...path) {
    return recordStore.getState().records.map(r => ExamineUtils.getIn(r, path));
  }
  function getPositions(recordStore) {
    return recordStore.getState().records.map(r => r.CHROM + '::' + r.POS);
  }

  it('should load VCF records', function() {
    var rs = getFreshRecordStore();

    assert.ok(rs.getState().hasLoadedVcfs);
    assert.equal(rs.getState().records.length, 10);
  });

  it('should sort records by INFO:DP', function() {
    var rs = getFreshRecordStore();

    var originalDps = getValues(rs, 'INFO', 'DP'),
        sortedDps = getValues(rs, 'INFO', 'DP');
    sortedDps.sort((a, b) => a - b);

    rs.receiver({actionType: ACTION_TYPES.SORT_BY,
                 path: ['INFO', 'DP'], order:'asc'});

    var storeDps = getValues(rs, 'INFO', 'DP');

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
    rs.receiver({actionType: ACTION_TYPES.UPDATE_FILTER,
                 path: ['INFO', 'DP'], filterValue: '>55'});

    var storeDps = getValues(rs, 'INFO', 'DP');
    assert.deepEqual(storeDps, [81, 68, 72, 66, 64, 74]);

    rs.receiver({actionType: ACTION_TYPES.UPDATE_FILTER,
                 path: ['NORMAL', 'GT'], filterValue: '1/1'});
    assert.deepEqual(getPositions(rs), ['20::66370', '20::68749']);
  });

  it('should select a range within chromosome 20', function() {
    var rs = getFreshRecordStore();
    rs.receiver({actionType: ACTION_TYPES.SELECT_RECORD_RANGE,
                 chromosome: '20', start: 66370, end: null});
    assert.deepEqual(getPositions(rs),
        ['20::66370', '20::68749', '20::69094', '20::69408', '20::75254']);
  });

  it('should select a range, filter by NORMAL:AD > 25, and sort by desc position', function() {
    var rs = getFreshRecordStore();

    rs.receiver({actionType: ACTION_TYPES.SORT_BY,
                 path: null, order:'desc'});

    rs.receiver({actionType: ACTION_TYPES.UPDATE_FILTER,
                 path: ['NORMAL', 'AD'], filterValue: '>25'});

    rs.receiver({actionType: ACTION_TYPES.SELECT_RECORD_RANGE,
                 chromosome: '20', start: 0, end: 70000});

    assert.deepEqual(getPositions(rs),
        ['20::66370', '20::65900']);
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
