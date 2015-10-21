'use strict';

var _ = require('underscore'),
    utils = require('../utils'),
    React = require('react'),
    classnames = require('classnames'),
    $ = require('jquery'),
    CommentBox = require('./CommentBox');

var VCFTable = React.createClass({
  propTypes: {
    // c.f. vcfTools.deriveColumns for structure of object
    columns: React.PropTypes.object.isRequired,
    // Currently selected VCF record.
    selectedRecord: React.PropTypes.object,
    // List of VCF records (including embedded user comments)
    records: React.PropTypes.arrayOf(React.PropTypes.object).isRequired,
    // Attribute by which we are sorting
    sortBys: React.PropTypes.array.isRequired,
    // Link to load data in IGV
    igvLink: React.PropTypes.string,
    handleSortByChange: React.PropTypes.func.isRequired,
    handleSelectRecord: React.PropTypes.func.isRequired,
    handleOpenViewer: React.PropTypes.func.isRequired,
    handleRequestPage: React.PropTypes.func.isRequired,
    handleSetComment: React.PropTypes.func.isRequired,
    handleDeleteComment: React.PropTypes.func.isRequired,
    handleStarGenotype: React.PropTypes.func.isRequired,
    currentUser: React.PropTypes.object.isRequired
  },
  // Call this to scroll a record to somewhere close to the top of the page.
  scrollRecordToTop: function(record) {
    var idx = this.props.records.indexOf(record);
    if (idx >= 0) {
      var row = $(this.refs.vcfTable).find('tr').get(idx);
      $('html,body').animate({
        scrollTop: $(row).offset().top - 70
      }, 250 /* ms */);
    }
  },
  render: function() {
    return (
      <table className='vcf-table' ref='vcfTable'>
        <VCFTableHeader ref='vcfTableHeader'
                        columns={this.props.columns}
                        sortBys={this.props.sortBys}
                        handleSortByChange={this.props.handleSortByChange}
                        records={this.props.records} />
        <VCFTableBody records={this.props.records}
                      columns={this.props.columns}
                      currentUser={this.props.currentUser}
                      selectedRecord={this.props.selectedRecord}
                      igvLink={this.props.igvLink}
                      handleRequestPage={this.props.handleRequestPage}
                      handleSelectRecord={this.props.handleSelectRecord}
                      handleOpenViewer={this.props.handleOpenViewer}
                      handleSetComment={this.props.handleSetComment}
                      handleDeleteComment={this.props.handleDeleteComment}
                      handleStarGenotype={this.props.handleStarGenotype} />
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
  handleSortByChange: function(columnNames) {
    return (e) => {
      var sortBys = _.map(columnNames, (columnName) => {
        var sortBy = _.findWhere(this.props.sortBys, {columnName}),
            order = sortBy && sortBy.order == 'asc' ? 'desc' : 'asc';
        return {columnName, order};
      });
      this.props.handleSortByChange(sortBys);
    };
  },
  render: function() {
    var uberColumns = [],
        columnHeaders = [],
        posSorts = this.props.sortBys.filter(c => _.contains(['position', 'contig'], c.columnName)),
        posSorterClasses = classnames({
          'sort': true,
          'desc': posSorts[0] && posSorts[0].order === 'desc',
          'asc': posSorts[0] && posSorts[0].order === 'asc',
          'sorting-by': posSorts.length > 0
        }),
        leftSideTableHeaders = [
            <th key='is-starred'></th>,
            <th className='has-comment tag' key='has-comment' />,
            <th className='true-positive tag' key='true-positive' />,
            <th key='contig-position' data-attribute='position'>
              contig:position
              <a className={posSorterClasses}
                 onClick={this.handleSortByChange(['position', 'contig'])}></a>
            </th>,
            <th key='ref' className='ref'>REF</th>,
            <th key='arrow' className='arrow'>→</th>,
            <th key='alt' className='alt'>ALT</th>,
            <th key='quality' className='quality'>quality</th>,
            <th key='filters' className='filters'>filters</th>
        ];

    _.each(this.props.columns, (columns, topLevelColumnName) => {
      uberColumns.push(
        <th colSpan={_.keys(columns).length}
            className='uber-column'
            key={topLevelColumnName}>
          {topLevelColumnName}
        </th>
      );
      for (var columnName in columns) {
        var column = columns[columnName],
            sortHandle = this.handleSortByChange([column.path.join(':')]);

        columnHeaders.push(<ColumnHeader info={column.info}
                                         key={column.path.join(':')}
                                         column={column}
                                         sortBys={this.props.sortBys}
                                         records={this.props.records}
                                         handleSortByChange={sortHandle} />);
      }
    });

    return (
      <thead>
        <tr>
          <th colSpan={leftSideTableHeaders.length} />
          {uberColumns}
        </tr>
        <tr>
          {leftSideTableHeaders}
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
                           _.isFinite(r[props.column.columnName])),
        isSortableType = _.contains(['Integer', 'Float'], props.info.type),
        isNotArray = props.info.number && props.info.number == 1;
    return hasValues && isSortableType && isNotArray;
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
    var aClasses = classnames({
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
        number = this.props.info.number,
        path = this.props.column.path.join(' → ');
    return (
      <div className='tooltip'>
        <p className='description'>{infoText}</p>
        <p className='description'>{path}</p>
        <p className='type'>Type: <strong>{infoType}</strong></p>
        <p className='number'>Num: <strong>{number}</strong></p>
      </div>
    );
  }
});

/**
 * As an optimization, this component only displays rows as they get close to
 * the screen. The number of rows shown only increases over time.
 */
var VCFTableBody = React.createClass({
  propTypes: {
    records: React.PropTypes.arrayOf(React.PropTypes.object).isRequired,
    columns: React.PropTypes.object.isRequired,
    selectedRecord: React.PropTypes.object,
    igvLink: React.PropTypes.string,
    handleSelectRecord: React.PropTypes.func.isRequired,
    handleOpenViewer: React.PropTypes.func.isRequired,
    handleRequestPage: React.PropTypes.func.isRequired,
    handleSetComment: React.PropTypes.func.isRequired,
    handleDeleteComment: React.PropTypes.func.isRequired,
    handleStarGenotype: React.PropTypes.func.isRequired,
    currentUser: React.PropTypes.object.isRequired
  },
  BOTTOM_BUFFER: 5000, // distance in px from bottom at which we load more records
  componentDidMount: function() {
    var handleRequestPage = this.props.handleRequestPage;
    $(window).on('scroll.vcftable', () => {
      // Show more rows if the browser viewport is close to the bottom and
      // there are more rows to be shown.
      var $table = $(this.refs.lazyload),
          tableBottom = $table.position().top + $table.height(),
          windowBottom = $(window).scrollTop() + $(window).height();
      if (tableBottom < windowBottom + this.BOTTOM_BUFFER) {
        handleRequestPage();
      }
    });
  },
  getInitialState: () => ({hasOpenedIGV: false}),
  componentWillUnmount: function() {
    $(window).off('scroll.vcftable');
    $(this.refs.lazyload).off('click');
  },
  render: function() {
    var selectedRecord = this.props.selectedRecord,
        rows = this.props.records.map((record, idx) => {
          var key = utils.getRowKey(record);

          // The actual comment box element should be distinguished
          // from its parent record. Note: this is not the same as
          // giving each individual comment its own key, which we
          // also do.
          var commentBoxKey = key + 'comment';
          var elements = [
            <VCFRecord record={record}
                       columns={this.props.columns}
                       key={key}
                       isSelected={selectedRecord === record}
                       handleSelectRecord={this.props.handleSelectRecord}
                       handleStarGenotype={this.props.handleStarGenotype} />
          ];
          if (selectedRecord === record) {
            elements.push(
              <CommentBox record={record}
                          key={commentBoxKey}
                          igvLink={this.props.igvLink}
                          currentUser={this.props.currentUser}
                          handleOpenViewer={this.props.handleOpenViewer}
                          handleSetComment={this.props.handleSetComment}
                          handleDeleteComment={this.props.handleDeleteComment} />
            );
          }

          return elements;
      });
    return (
      <tbody ref='lazyload'>
        {
          // Turn [record, [record, comment], ...] into [record, record, comment].
          _.flatten(rows)
        }
      </tbody>
    );
  }
});

var VCFRecord = React.createClass({
  propTypes: {
    record: React.PropTypes.object.isRequired,
    columns: React.PropTypes.object.isRequired,
    isSelected: React.PropTypes.bool.isRequired,
    handleSelectRecord: React.PropTypes.func.isRequired,
    handleStarGenotype: React.PropTypes.func.isRequired
  },
  handleClick: function() {
    // If the same record is selected, treat that as a deselect toggle.
    if (this.props.isSelected) {
      this.props.handleSelectRecord(null);
    } else {
      this.props.handleSelectRecord(this.props.record);
    }
  },
  formatCell: function(val) {
    return val === null ? '-' : String(val);
  },
  starGenotype: function(e) {
    e.stopPropagation();
    var starred = this.props.record['annotations:starred'];
    this.props.handleStarGenotype(!starred, this.props.record);
  },
  render: function() {
    var hasComments = _.has(this.props.record, 'comments') &&
        this.props.record.comments.length > 0;
    var commentBubbleClass = classnames({
      'comment-bubble': hasComments
    });
    var tds = [
      <td key='is-starred' className='is-starred' onClick={this.starGenotype}>
        <span className={this.props.record['annotations:starred'] ? 'starred' : 'not-starred'}>
        </span>
      </td>,
      <td key='has-comment'>
        <span className={commentBubbleClass}></span>
        <span>
          {hasComments ? this.props.record.comments.length : ''}
        </span>
      </td>,
      <td title="This record is a true positive." key='true-positive'>
        {this.props.record['tag:true-positive'] ? '✓' : ''}
      </td>,
      <td key='contig-position'
          title='contig:position'
          className='pos'>
        {this.props.record.contig}:{this.props.record.position}
      </td>,
      <td key='ref' className='ref' title={this.props.record.reference}>
        {this.props.record.reference}
      </td>,
      <td key='arrow' className='arrow'>→</td>,
      <td key='alt' className='alt' title={this.props.record.alternates}>
        {this.props.record.alternates}
      </td>,
      <td key='quality' className='quality' title={this.props.record.quality}>
        {this.props.record.quality}
      </td>,
      <td key='filters' className='filters' title={this.props.record.filters}>
        {this.props.record.filters}
      </td>
    ];
    _.each(this.props.columns, (columns, topLevelColumnName) => {
      for (var columnName in columns) {
        var column = columns[columnName],
            val = this.props.record[column.path.join(':')];
        tds.push(
          <td key={column.path.join(':')} title={val}>
            {this.formatCell(val)}
          </td>
        );
      }
    });
    var recordClasses = classnames({selected: this.props.isSelected});
    return (
      <tr className={recordClasses} onClick={this.handleClick}>
        {tds}
      </tr>
    );
  }
});


module.exports = VCFTable;
