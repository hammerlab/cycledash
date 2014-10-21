/** @jsx React.DOM */
jest.autoMockOff();

var _ = require('underscore'),
    Utils = require('./Utils.js'),
    ACTION_TYPES = require('../../cycledash/static/js/examine/RecordActions.js').ACTION_TYPES,
    $ = require('jquery');


describe('RecordStore', function() {
  var RecordStore, RecordActions, Dispatcher;

  beforeEach(function() {
    RecordStore = require('../../cycledash/static/js/examine/RecordStore.js');
    $ = require('jquery');
  });

  it('should load VCF records', function() {
    spyOn($, 'get').andCallFake(Utils.fakeGet('__tests__/js/data/snv.vcf'));
    var rs = RecordStore('/vcf/snv.vcf', '/vcf/snv.vcf');
    expect(rs.hasLoadedVcfs()).toEqual(true);
    expect(rs.getRecords().length).toEqual(10);
  });

  it('should sort records by INFO:DP', function() {
    spyOn($, 'get').andCallFake(Utils.fakeGet('__tests__/js/data/snv.vcf'));
    var rs = RecordStore('/vcf/snv.vcf', '/vcf/snv.vcf');

    var originalDps = _.pluck(_.pluck(rs.getRecords(), 'INFO'), 'DP'),
        sortedDps = _.pluck(_.pluck(rs.getRecords(), 'INFO'), 'DP');
    sortedDps.sort((a, b) => a - b);

    rs.receiver({actionType: ACTION_TYPES.SORT_BY,
                 path: ['INFO', 'DP'], order:'asc'});

    var storeDps = _.pluck(_.pluck(rs.getRecords(), 'INFO'), 'DP');

    expect(storeDps).toEqual(sortedDps);
    expect(storeDps).not.toEqual(originalDps);
  });

  it('should filter to DP > 55 and then NORMAL:GT = 1/1', function() {
    spyOn($, 'get').andCallFake(Utils.fakeGet('__tests__/js/data/snv.vcf'));
    var rs = RecordStore('/vcf/snv.vcf', '/vcf/snv.vcf');

    var filteredDps = _.filter(_.pluck(_.pluck(
      rs.getRecords(), 'INFO'), 'DP'), dp => dp > 55);

    var filteredDpsGt = _.filter(rs.getRecords(), record => {
      return record.INFO.DP > 55 && record.NORMAL.GT == '1/1';
    });
    filteredDpsGt = _.map(filteredDpsGt, record => record.NORMAL.GT);

    rs.receiver({actionType: ACTION_TYPES.UPDATE_FILTER,
                 path: ['INFO', 'DP'], filterValue: '>55'});

    var storeDps = _.pluck(_.pluck(rs.getRecords(), 'INFO'), 'DP');

    rs.receiver({actionType: ACTION_TYPES.UPDATE_FILTER,
                 path: ['NORMAL', 'GT'], filterValue: '1/1'});

    var storeDpsGt = _.pluck(_.pluck(rs.getRecords(), 'NORMAL'), 'GT');

    expect(storeDps).toEqual(filteredDps);
    expect(storeDpsGt).toEqual(filteredDpsGt);
  });

  it('should select a range within chromosome 20', function() {
    spyOn($, 'get').andCallFake(Utils.fakeGet('__tests__/js/data/snv.vcf'));
    var rs = RecordStore('/vcf/snv.vcf', '/vcf/snv.vcf');

    var withinRangeRecords = _.filter(rs.getRecords(), record => {
      return record.POS >= 66370;
    });

    rs.receiver({actionType: ACTION_TYPES.SELECT_RECORD_RANGE,
                 chromosome: '20', start: 66370, end: null});

    var storeRecords = rs.getRecords();

    expect(storeRecords.length).toEqual(withinRangeRecords.length);
  });

  it('should select a range, filter by NORMAL:AD > 25, and sort by desc position', function() {
    spyOn($, 'get').andCallFake(Utils.fakeGet('__tests__/js/data/snv.vcf'));
    var rs = RecordStore('/vcf/snv.vcf', '/vcf/snv.vcf');

    var validatedRecords = _.filter(rs.getRecords(), record => {
      return record.POS < 70000 && record.NORMAL.AD > 25;
    });
    validatedRecords = validatedRecords.sort((a, b) => b.POS - a.POS);

    rs.receiver({actionType: ACTION_TYPES.SORT_BY,
                 path: null, order:'desc'});

    rs.receiver({actionType: ACTION_TYPES.UPDATE_FILTER,
                 path: ['NORMAL', 'AD'], filterValue: '>25'});

    rs.receiver({actionType: ACTION_TYPES.SELECT_RECORD_RANGE,
                 chromosome: '20', start: 0, end: 70000});

    var storeRecords = rs.getRecords();

    expect(storeRecords.length).toEqual(validatedRecords.length);
    expect(_.isEqual(storeRecords, validatedRecords)).toEqual(true);
  });
});
