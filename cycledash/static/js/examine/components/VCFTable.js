/** @jsx React.DOM */
'use strict';

var _ = require('underscore'),
    React = require('react/addons'),
    types = require('./types'),
    $ = require('jquery'),
    utils = require('../utils');


var VCFTable = React.createClass({
  propTypes: {
    // c.f. vcfTools.deriveColumns for structure of object
    columns: React.PropTypes.object.isRequired,
    // Subset of columns which are currently selected to be graphed.
    selectedColumns: React.PropTypes.arrayOf(React.PropTypes.object).isRequired,
    // Currently selected VCF record.
    selectedRecord: React.PropTypes.object,
    // List of contigs found in the VCF
    contigs: React.PropTypes.arrayOf(React.PropTypes.string).isRequired,
    // The position object, from ExaminePage, denoting the current range selected
    range: types.PositionType,
    // List of VCF records
    records: React.PropTypes.arrayOf(React.PropTypes.object).isRequired,
    // Attribute by which we are sorting
    sortBys: React.PropTypes.array.isRequired,
    // Function which takes a chart attribute name and propagates the change up
    handleChartChange: React.PropTypes.func.isRequired,
    handleSortByChange: React.PropTypes.func.isRequired,
    handleFilterUpdate: React.PropTypes.func.isRequired,
    handleContigChange: React.PropTypes.func.isRequired,
    handleRangeChange: React.PropTypes.func.isRequired,
    handleSelectRecord: React.PropTypes.func.isRequired,
    handlePageRequest: React.PropTypes.func.isRequired
  },
  // Call this to scroll a record to somewhere close to the top of the page.
  scrollRecordToTop: function(record) {
    var idx = this.props.records.indexOf(record);
    if (idx >= 0) {
      var row = $(this.refs.vcfTable.getDOMNode()).find('tr').get(idx);
      $('html,body').animate({
        scrollTop: $(row).offset().top - 70
      }, 250 /* ms */);
    }
  },
  render: function() {
    return (
      <table className='vcf-table' ref='vcfTable'>
        <VCFTableHeader columns={this.props.columns}
                        selectedColumns={this.props.selectedColumns}
                        sortBys={this.props.sortBys}
                        handleSortByChange={this.props.handleSortByChange}
                        handleChartChange={this.props.handleChartChange}
                        records={this.props.records} />
        <VCFTableFilter columns={this.props.columns}
                        range={this.props.range}
                        contigs={this.props.contigs}
                        handleFilterUpdate={this.props.handleFilterUpdate}
                        handleContigChange={this.props.handleContigChange}
                        handleRangeChange={this.props.handleRangeChange} />
        <VCFTableBody records={this.props.records}
                      columns={this.props.columns}
                      selectedRecord={this.props.selectedRecord}
                      handlePageRequest={this.props.handlePageRequest}
                      handleSelectRecord={this.props.handleSelectRecord} />
      </table>
    );
  }
});

var VCFTableHeader = React.createClass({
  propTypes: {
    selectedColumns: React.PropTypes.arrayOf(React.PropTypes.object).isRequired,
    columns: React.PropTypes.object.isRequired,
    sortBys: React.PropTypes.array.isRequired,
    handleChartChange: React.PropTypes.func.isRequired,
    handleSortByChange: React.PropTypes.func.isRequired,
    records: React.PropTypes.arrayOf(React.PropTypes.object).isRequired
  },
  handleChartToggle: function(column) {
    return e => {
      this.props.handleChartChange(column);
    };
  },
  handleSortByChange: function(columnName) {
    return (e) => {
      var sortBy = this.props.sortBys[0],
          order = 'asc';
      if (sortBy && sortBy.columnName == columnName) {
        order = sortBy.order == 'asc' ? 'desc' : 'asc'
      }
      this.props.handleSortByChange({columnName, order});
    }
  },
  render: function() {
    var uberColumns = [],
        columnHeaders = [];

    window.cols = [];
    _.each(this.props.columns, (columns, topLevelColumnName) => {
      uberColumns.push(
        <th colSpan={_.keys(columns).length} className='uber-column' key={topLevelColumnName}>
          {topLevelColumnName}
        </th>
      );
      for (var columnName in columns) {
        var column = columns[columnName],
            isSelected = _.any(this.props.selectedColumns, el => _.isEqual(el, column)),
            sortHandle = this.handleSortByChange(column.path.join(':'));

        columnHeaders.push(<ColumnHeader info={column.info}
                                         key={column.path.join(':')}
                                         column={column}
                                         sortBys={this.props.sortBys}
                                         isSelected={isSelected}
                                         handleSortByChange={sortHandle}
                                         handleChartToggle={this.handleChartToggle(column)} />);
      };
    });

    var sortBy = this.props.sortBys[0];
    var sorterClasses = React.addons.classSet({
      'sort': true,
      'desc': sortBy.order === 'desc',
      'asc': sortBy.order === 'asc',
      'sorting-by': sortBy.columnName == 'position'
    });

    return (
      <thead>
        <tr>
          <th colSpan={4}>{/* This is the uber column for position and ref/alt. */}</th>
          {uberColumns}
        </tr>
        <tr>
          <th data-attribute='position'>
            contig::position
            <a className={sorterClasses} onClick={this.handleSortByChange('position')}></a>
          </th>
          <th className='ref'>REF</th><th className='arrow'>→</th><th className='alt'>ALT</th>
          {columnHeaders}
        </tr>
      </thead>
    );
  }
});

var ColumnHeader = React.createClass({
  propTypes: {
    column: React.PropTypes.object.isRequired,
    info: React.PropTypes.object,
    handleChartToggle: React.PropTypes.func.isRequired,
    isSelected: React.PropTypes.bool.isRequired,
    handleSortByChange: React.PropTypes.func.isRequired,
    sortBys: React.PropTypes.array.isRequired
  },
  isChartable: function() {
    var hasValues = _.some(this.props.records, record =>
      _.isFinite(utils.getIn(record, this.props.column.path))
    );

    return (hasValues &&
            _.contains(['Integer', 'Float'], this.props.info['Type']));
  },
  render: function() {
    var tooltip;
    if (this.props.info) {
      tooltip = <InfoColumnTooltip info={this.props.info} column={this.props.column} />;
    }
    var thClasses = React.addons.classSet({
      'attr': true,
      'selected': this.props.isSelected,
    });

    var order = null,
        sortingBy = false,
        sortBy = this.props.sortBys[0];
    if (sortBy) {
      sortingBy = sortBy.columnName == this.props.column.path.join(':'),
      order = sortBy.order;
    }
    var aClasses = React.addons.classSet({
        'sorting-by': sortingBy,
        'desc': order === 'desc',
        'asc': order === 'asc',
        'sort': true
      });

    if (this.isChartable()) {
      var sorter = <a className={aClasses} onClick={this.props.handleSortByChange}></a>;
      var chartToggle = (<span className='chartable'
                               onClick={this.props.handleChartToggle}>
                           {this.props.column.name}
                         </span>);
    } else {
      var chartToggle = <span>{this.props.column.name}</span>;
    }

    return (
      <th className={thClasses} data-attribute={this.props.column.path.join(':')}>
        {chartToggle}
        {tooltip}
        {sorter}
      </th>
    );
  }
});

var InfoColumnTooltip = React.createClass({
  propTypes: {
    column: React.PropTypes.object.isRequired,
    info: React.PropTypes.object.isRequired
  },
  render: function() {
    var infoText = this.props.info['description'],
        infoType = this.props.info['type'],
        path = this.props.column.path.join(' → ');
    return (
      <div className='tooltip'>
        <p className='description'>{infoText}</p>
        <p className='description'>{path}</p>
        <p className='type'>Type: <strong>{infoType}</strong></p>
      </div>
    );
  }
});

var VCFTableFilter = React.createClass({
  propTypes: {
    contigs: React.PropTypes.arrayOf(React.PropTypes.string).isRequired,
    range: types.PositionType,
    handleContigChange: React.PropTypes.func.isRequired,
    handleRangeChange: React.PropTypes.func.isRequired,
    columns: React.PropTypes.object.isRequired
  },
  handleContigChange: function(e) {
    var contig = this.refs.contig.getDOMNode().value;
    if (contig === 'all') contig = null;
    this.props.handleContigChange(contig);
  },
  handleRangeChange: function(e) {
    var start = this.refs.startPos.getDOMNode().value,
        end = this.refs.endPos.getDOMNode().value,
        contig = this.props.range.contig;
    this.props.handleRangeChange({contig,
                                  start: Number(start) || null,
                                  end: Number(end) || null});
  },
  handleFilterUpdate: function(path) {
    return e => {
      var value = e.currentTarget.value;
      var op;
      if (value.length > 1 && _.contains(['LIKE', 'RLIKE', '>', '<', '='], value[0])) {
        op = value[0];
        value = value.slice(1);
      } else {
        op = 'RLIKE'
      }
      var filter = {filterValue: value, columnName: path.join(':'), type: op};
      this.props.handleFilterUpdate(filter);
    };
  },
  render: function() {
    var {range, kgram} = this.props,
        {start, end} = range;

    var contigOptions = this.props.contigs.map(function(contig) {
      return (
        <option name='contig' key={contig} value={contig}>{contig}</option>
      );
    }.bind(this));
    var columnFilterFields = [];
    _.each(this.props.columns, (columns, topLevelColumnName) => {
      for (var columnName in columns) {
        var column = columns[columnName];
        columnFilterFields.push(
          <th key={topLevelColumnName + column.name}>
            <input name={column.name} className='infoFilter' type='text'
                   onChange={this.handleFilterUpdate(column.path)} />
          </th>
        );
      }
    });
    return (
      <thead>
        <tr>
          <th id='range'>
            <select onChange={this.handleContigChange}
                    ref='contig' value={this.props.range.contig || 'all'}>
              <option name='contig' key='all' value='all'>&lt;all&gt;</option>
              {contigOptions}
            </select>
            <input name='start' type='text' placeholder='start'
                   disabled={!this.props.range.contig}
                   ref='startPos' value={start || ''} onChange={this.handleRangeChange} />
            <input name='end' type='text' placeholder='end'
                   disabled={!this.props.range.contig}
                   ref='endPos' value={end || ''} onChange={this.handleRangeChange} />
          </th>
          <th className='ref'>
            <input name='ref' className='infoFilter' type='text'
                   onChange={this.handleFilterUpdate(['reference'])} />
          </th>
          <th>→</th>
          <th className='alt'>
            <input name='alt' className='infoFilter' type='text'
                   onChange={this.handleFilterUpdate(['alternates'])} />
          </th>
          {columnFilterFields}
        </tr>
      </thead>
    );
  }
});

// As an optimization, this component only displays rows as they get close to
// the screen. The number of rows shown only increases over time.
var VCFTableBody = React.createClass({
  propTypes: {
    records: React.PropTypes.arrayOf(React.PropTypes.object).isRequired,
    columns: React.PropTypes.object.isRequired,
    selectedRecord: React.PropTypes.object,
    handleSelectRecord: React.PropTypes.func.isRequired,
    handlePageRequest: React.PropTypes.func.isRequired
  },
  BOTTOM_BUFFER: 5000, // distance in px from bottom at which we load more records
  componentDidMount: function() {
    var handlePageRequest = this.props.handlePageRequest;
    $(window).on('scroll.vcftable', () => {
      // Show more rows if the browser viewport is close to the bottom and
      // there are more rows to be shown.
      var $table = $(this.refs.lazyload.getDOMNode()),
          tableBottom = $table.position().top + $table.height(),
          windowBottom = $(window).scrollTop() + $(window).height();
      if (tableBottom < windowBottom + this.BOTTOM_BUFFER) {
        handlePageRequest();
      }
    });

    $(this.refs.lazyload.getDOMNode()).on('click', 'tr', (e) => {
      var selectedRecord = this.props.records[$(e.currentTarget).index()];
      this.props.handleSelectRecord(selectedRecord);
    });
  },
  componentWillUnmount: function() {
    $(window).off('scroll.vcftable');
    $(this.refs.lazyload.getDOMNode()).off('click');
  },
  render: function() {
    var selectedRecord = this.props.selectedRecord,
        selKey = selectedRecord ? selectedRecord.__KEY__ : null,
        rows = this.props.records.map((record, idx) => {
          var key = record.contig + record.position + record.reference + record.alternates;
          return (
              <VCFRecord record={record}
                         columns={this.props.columns}
                         key={key}
                         isSelected={false && record.__KEY__ == selKey} />
          );
        });
    return (
      <tbody ref='lazyload'>
        {rows}
      </tbody>
    );
  }
});

var VCFRecord = React.createClass({
  propTypes: {
    record: React.PropTypes.object.isRequired,
    columns: React.PropTypes.object.isRequired,
    isSelected: React.PropTypes.bool.isRequired
  },
  render: function() {
    var tds = [];
    _.each(this.props.columns, (columns, topLevelColumnName) => {
      for (var columnName in columns) {
        var column = columns[columnName];
        tds.push(
          <td key={column.path.join(':')} title={column.path.join('→')}>
            {String(this.props.record[column.path.join(':')])}
          </td>
        );
      }
    });
    var classes = React.addons.classSet({selected: this.props.isSelected});
    var record = this.props.record;
    return (
      <tr className={classes}>
        <td title='contig:position' className='pos'>{record.contig}::{record.position}</td>
        <td className='ref' title={record.reference}>{record.reference}</td>
        <td className='arrow'>→</td>
        <td className='alt' title={record.alternates}>{record.alternates}</td>
        {tds}
      </tr>
    );
  }
});


module.exports = VCFTable;
