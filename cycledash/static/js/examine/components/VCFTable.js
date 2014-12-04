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
    handleSortByChange: React.PropTypes.func.isRequired,
    handleSelectRecord: React.PropTypes.func.isRequired,
    handleRequestPage: React.PropTypes.func.isRequired
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
                        sortBys={this.props.sortBys}
                        handleSortByChange={this.props.handleSortByChange}
                        records={this.props.records} />
        <VCFTableBody records={this.props.records}
                      columns={this.props.columns}
                      selectedRecord={this.props.selectedRecord}
                      handleRequestPage={this.props.handleRequestPage}
                      handleSelectRecord={this.props.handleSelectRecord} />
      </table>
    );
  }
});

var VCFTableHeader = React.createClass({
  propTypes: {
    columns: React.PropTypes.object.isRequired,
    sortBys: React.PropTypes.array.isRequired,
    handleSortByChange: React.PropTypes.func.isRequired,
    records: React.PropTypes.arrayOf(React.PropTypes.object).isRequired
  },
  handleSortByChange: function(columnName) {
    return (e) => {
      var sortBy = this.props.sortBys[0],
          order = 'asc';
      if (sortBy && sortBy.columnName == columnName) {
        order = sortBy.order == 'asc' ? 'desc' : 'asc';
      }
      this.props.handleSortByChange({columnName, order});
    };
  },
  render: function() {
    var uberColumns = [],
        columnHeaders = [];

    _.each(this.props.columns, (columns, topLevelColumnName) => {
      uberColumns.push(
        <th colSpan={_.keys(columns).length} className='uber-column' key={topLevelColumnName}>
          {topLevelColumnName}
        </th>
      );
      for (var columnName in columns) {
        var column = columns[columnName],
            sortHandle = this.handleSortByChange(column.path.join(':'));

        columnHeaders.push(<ColumnHeader info={column.info}
                                         key={column.path.join(':')}
                                         column={column}
                                         sortBys={this.props.sortBys}
                                         records={this.props.records}
                                         handleSortByChange={sortHandle} />);
      }
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
            contig:position
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
    handleSortByChange: React.PropTypes.func.isRequired,
    sortBys: React.PropTypes.array.isRequired,
    records: React.PropTypes.array.isRequired
  },
  isSortable: function() {
    var props = this.props,
        hasValues = _.some(props.records, r =>
                           _.isFinite(r[props.column.columnName]));
    return (hasValues && _.contains(['Integer', 'Float'], props.info.type));
  },
  render: function() {
    var tooltip;
    if (this.props.info) {
      tooltip = <InfoColumnTooltip info={this.props.info} column={this.props.column} />;
    }

    var columnName = this.props.column.path.join(':'),
        sortBy = _.findWhere(this.props.sortBys, {columnName}),
        sortingBy = false,
        order = null;
    if (sortBy) {
      sortingBy = true;
      order = sortBy.order;
    }
    var aClasses = React.addons.classSet({
        'sorting-by': sortingBy,
        'desc': sortingBy && order === 'desc',
        'asc': sortingBy && order === 'asc',
        'sort': true
      });

    var sorter;
    if (this.isSortable()) {
      sorter = <a className={aClasses} onClick={this.props.handleSortByChange}></a>;
    }
    var name = <span>{this.props.column.name}</span>;

    return (
      <th data-attribute={this.props.column.path.join(':')}>
        {name}
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
    var infoText = this.props.info.description,
        infoType = this.props.info.type,
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

// As an optimization, this component only displays rows as they get close to
// the screen. The number of rows shown only increases over time.
var VCFTableBody = React.createClass({
  propTypes: {
    records: React.PropTypes.arrayOf(React.PropTypes.object).isRequired,
    columns: React.PropTypes.object.isRequired,
    selectedRecord: React.PropTypes.object,
    handleSelectRecord: React.PropTypes.func.isRequired,
    handleRequestPage: React.PropTypes.func.isRequired
  },
  BOTTOM_BUFFER: 5000, // distance in px from bottom at which we load more records
  componentDidMount: function() {
    var handleRequestPage = this.props.handleRequestPage;
    $(window).on('scroll.vcftable', () => {
      // Show more rows if the browser viewport is close to the bottom and
      // there are more rows to be shown.
      var $table = $(this.refs.lazyload.getDOMNode()),
          tableBottom = $table.position().top + $table.height(),
          windowBottom = $(window).scrollTop() + $(window).height();
      if (tableBottom < windowBottom + this.BOTTOM_BUFFER) {
        handleRequestPage();
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
        rows = this.props.records.map((record, idx) => {
          var key = record.contig + record.position + record.reference + record.alternates + record.sample_name;
          return (
              <VCFRecord record={record}
                         columns={this.props.columns}
                         key={key}
                         isSelected={selectedRecord === record} />
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
        <td title='contig:position' className='pos'>{record.contig}:{record.position}</td>
        <td className='ref' title={record.reference}>{record.reference}</td>
        <td className='arrow'>→</td>
        <td className='alt' title={record.alternates}>{record.alternates}</td>
        {tds}
      </tr>
    );
  }
});

module.exports = VCFTable;
