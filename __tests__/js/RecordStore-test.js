/** @jsx React.DOM */
jest.autoMockOff();

var _ = require('underscore'),
    Utils = require('./Utils.js'),
    ACTION_TYPES = require('../../cycledash/static/js/examine/RecordActions.js').ACTION_TYPES,
    $ = require('jquery');

var TEST_VCF_PATH = '__tests__/js/data/snv.vcf';

describe('RecordStore', function() {
  var RecordStore, RecordActions, Dispatcher;

  function getFreshRecordStore() {
    spyOn($, 'get').andCallFake(Utils.fakeGet(TEST_VCF_PATH));
    return RecordStore('/vcf/snv.vcf', '/vcf/snv.vcf');
  }

  beforeEach(function() {
    RecordStore = require('../../cycledash/static/js/examine/RecordStore.js');
    $ = require('jquery');
  });


  it('should load VCF records', function() {
    var rs = getFreshRecordStore();

    expect(rs.getState().hasLoadedVcfs).toEqual(true);
    expect(rs.getState().records.length).toEqual(10);
  });

  it('should sort records by INFO:DP', function() {
    var rs = getFreshRecordStore();

    var originalDps = _.pluck(_.pluck(rs.getState().records, 'INFO'), 'DP'),
        sortedDps = _.pluck(_.pluck(rs.getState().records, 'INFO'), 'DP');
    sortedDps.sort((a, b) => a - b);

    rs.receiver({actionType: ACTION_TYPES.SORT_BY,
                 path: ['INFO', 'DP'], order:'asc'});

    var storeDps = _.pluck(_.pluck(rs.getState().records, 'INFO'), 'DP');

    expect(storeDps).toEqual(sortedDps);
    expect(storeDps).not.toEqual(originalDps);
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

    expect(storeDps).toEqual(filteredDps);
    expect(storeDpsGt).toEqual(filteredDpsGt);
  });

  it('should select a range within chromosome 20', function() {
    var rs = getFreshRecordStore();

    var withinRangeRecords = _.filter(rs.getState().records, record => {
      return record.POS >= 66370;
    });

    rs.receiver({actionType: ACTION_TYPES.SELECT_RECORD_RANGE,
                 chromosome: '20', start: 66370, end: null});

    var storeRecords = rs.getState().records;

    expect(storeRecords.length).toEqual(withinRangeRecords.length);
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

    expect(storeRecords.length).toEqual(validatedRecords.length);
    expect(_.isEqual(storeRecords, validatedRecords)).toEqual(true);
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

    expect(originalAlts.length).toEqual(10);
    expect(filteredAlts).toEqual(['C']);
    expect(defilteredAlts.length).toEqual(10);
  });
});
