/** @jsx React.DOM */
"use strict";

var _ = require('underscore'),
    d3 = require('d3'),
    React = require('react/addons'),
    idiogrammatik = require('idiogrammatik.js'),
    types = require('./types.js'),
    $ = require('jquery'),
    getIn = require('./utils').getIn;


var VCFTable = React.createClass({
  propTypes: {
    columns: React.PropTypes.object.isRequired,
    // Subset of columns which are currently selected to be graphed.
    selectedColumns: React.PropTypes.arrayOf(React.PropTypes.object).isRequired,
    // Currently selected VCF record.
    selectedRecord: React.PropTypes.object,
    // Function which takes a chart attribute name and propagates the change up
    handleChartChange: React.PropTypes.func.isRequired,
    // List of chromosomes found in the VCF
    chromosomes: React.PropTypes.arrayOf(React.PropTypes.string).isRequired,
    // The position object, from ExaminePage, denoting the current range selected
    position: types.PositionType,
    // List of VCF records
    records: React.PropTypes.arrayOf(React.PropTypes.object).isRequired,
    // The VCF header, used to get information about the INFO fields
    header: React.PropTypes.object.isRequired,
    // Attribute by which we are sorting
    sortBy: React.PropTypes.array,
    handleSortByChange: React.PropTypes.func.isRequired,
    handleChromosomeChange: React.PropTypes.func.isRequired,
    handleRangeChange: React.PropTypes.func.isRequired,
    handleSelectRecord: React.PropTypes.func.isRequired
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
      <table className="vcf-table" ref="vcfTable">
        <VCFTableHeader columns={this.props.columns}
                        selectedColumns={this.props.selectedColumns}
                        sortBy={this.props.sortBy}
                        header={this.props.header}
                        handleSortByChange={this.props.handleSortByChange}
                        handleChartChange={this.props.handleChartChange} />
        <VCFTableFilter columns={this.props.columns}
                        position={this.props.position}
                        chromosomes={this.props.chromosomes}
                        handleFilterUpdate={this.props.handleFilterUpdate}
                        handleChromosomeChange={this.props.handleChromosomeChange}
                        handleRangeChange={this.props.handleRangeChange} />
        <VCFTableBody records={this.props.records}
                      columns={this.props.columns}
                      selectedRecord={this.props.selectedRecord}
                      handleSelectRecord={this.props.handleSelectRecord} />
      </table>
    );
  }
});

var VCFTableHeader = React.createClass({
  propTypes: {
    header: React.PropTypes.object.isRequired,
    selectedColumns: React.PropTypes.arrayOf(React.PropTypes.object).isRequired,
    columns: React.PropTypes.object.isRequired,
    sortBy: React.PropTypes.array,
    handleChartChange: React.PropTypes.func.isRequired,
    handleSortByChange: React.PropTypes.func.isRequired
  },
  handleChartToggle: function(column) {
    return e => {
      this.props.handleChartChange(column);
    };
  },
  handleSortByChange: function(e) {
    var path = e.currentTarget.parentElement
        .attributes.getNamedItem('data-attribute').value;
    var [sortPath, direction] = this.props.sortBy;
    if (!sortPath || path === sortPath.join('::')) {
      direction = direction == 'asc' ? 'desc' : 'asc';
    } else {
      direction = 'desc';
    }
    if (path === 'position') {
      path = null;
    } else {
      path = path.split('::');
    }

    this.props.handleSortByChange(path, direction);
  },
  render: function() {
    var uberColumns = [],
        columnHeaders = [];

    window.cols = [];
    _.each(this.props.columns, (columns, topLvlColName) => {
      uberColumns.push(
        <th colSpan={_.keys(columns).length} className="uber-column" key={topLvlColName}>
          {topLvlColName}
        </th>
      );
      for (var colName in columns) {
        var column = columns[colName];
        columnHeaders.push(<ColumnHeader info={column.info}
                                         key={column.path.join('::')}
                                         column={column}
                                         sortBy={this.props.sortBy}
                                         isSelected={false}
                                         handleSortByChange={this.handleSortByChange}
                                         handleChartToggle={this.handleChartToggle(column)} />);
      };
    });
    var sorterClasses = React.addons.classSet({
      'sort': true,
      'desc': this.props.sortBy[1] === 'desc',
      'asc': this.props.sortBy[1] === 'asc',
      'sorting-by': this.props.sortBy[0] === null
    });

    return (
      <thead>
        <tr>
          <th colSpan={2}>{/* This is the uber column for position and ref/alt. */}</th>
          {uberColumns}
        </tr>
        <tr>
          <th data-attribute="position">
            chr::position
            <a className={sorterClasses} onClick={this.handleSortByChange}></a>
          </th>
          <th>REF / ALT</th>
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
    sortBy: React.PropTypes.array
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

    var [sortByPath, direction] = this.props.sortBy;
    var sortingBy = false;
    if (sortByPath) {
      sortingBy = _.every(_.zip(sortByPath, this.props.column.path), function(pair) {
        return pair[0] == pair[1];
      });
    }
    var aClasses = React.addons.classSet({
      'sorting-by': sortingBy,
      'desc': this.props.sortBy[1] === 'desc',
      'asc': this.props.sortBy[1] === 'asc',
      'sort': true
    });

    if (_.contains(['Integer', 'Float'], this.props.info['Type'])) {
      var sorter = <a className={aClasses} onClick={this.props.handleSortByChange}></a>;
    }


    if (_.contains(['Integer', 'Float'], this.props.info['Type'])) {
      var chartToggle = (<span className="chartable"
                               onClick={this.props.handleChartToggle}>
                           {this.props.column.name}
                         </span>);
    } else {
      var chartToggle = <span>{this.props.column.name}</span>;
    }

    return (
      <th className={thClasses} data-attribute={this.props.column.path.join('::')}>
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
    var infoText = this.props.info['Description'],
        infoType = this.props.info['Type'],
        path = this.props.column.path.join(' → ');
    return (
      <div className="tooltip">
        <p className="description">{infoText}</p>
        <p className="description">{path}</p>
        <p className="type">Type: <strong>{infoType}</strong></p>
      </div>
    );
  }
});

var VCFTableFilter = React.createClass({
  propTypes: {
    chromosomes: React.PropTypes.arrayOf(React.PropTypes.string).isRequired,
    position: types.PositionType,
    handleChromosomeChange: React.PropTypes.func.isRequired,
    handleRangeChange: React.PropTypes.func.isRequired,
    columns: React.PropTypes.object.isRequired
  },
  handleChromosomeChange: function(e) {
    var chromosome = this.refs.chromosome.getDOMNode().value;
    this.props.handleChromosomeChange(chromosome);
  },
  handleRangeChange: function(e) {
    var start = this.refs.startPos.getDOMNode().value,
    end = this.refs.endPos.getDOMNode().value,
    chromosome = this.props.position.chromosome;
    this.props.handleRangeChange(chromosome, Number(start) || null, Number(end) || null);
  },
  handleFilterUpdate: function(e) {
    // Array.slice converts the returned node list into an array so that we can
    // map over it.
    var filters = Array.prototype.slice.call(document.querySelectorAll('input.infoFilter'));
    // Return an object mapping filter names to filter values to be processed
    // when filtering records.
    filters = _.object(filters.map(function(f) {
      return [f.name, f.value];
    }));
    this.props.handleFilterUpdate(filters);
  },
  render: function() {
    var {position, kgram} = this.props,
        {start, end} = position;

    var chromosomeOptions = this.props.chromosomes.map(function(chromosome) {
      return (
        <option name="chromosome" key={chromosome} value={chromosome}>{chromosome}</option>
      );
    }.bind(this));
    var columnFilterFields = [];
    _.each(this.props.columns, (columns, topLvlColumnName) => {
      for (var colName in columns) {
        var column = columns[colName];
        columnFilterFields.push(
          <th key={topLvlColumnName + column.name}>
            <input name={column.name} className="infoFilter" type="text"
                   onChange={this.handleFilterUpdate} />
          </th>
        );
      }
    });
    return (
      <thead>
        <tr>
          <th id="position">
            <select onChange={this.handleChromosomeChange}
                    ref="chromosome" value={this.props.position.chromosome || 'all'}>
              <option name="chromosome" key="all" value="all">&lt;all&gt;</option>
              {chromosomeOptions}
            </select>
            <input name="start" type="text" placeholder="start"
                   disabled={!this.props.position.chromosome}
                   ref="startPos" value={start || ''} onChange={this.handleRangeChange} />
            <input name="end" type="text" placeholder="end"
                   disabled={!this.props.position.chromosome}
                   ref="endPos" value={end || ''} onChange={this.handleRangeChange} />
          </th>
          <th>
            <input name="refAlt" className="infoFilter" type="text"
                   onChange={this.handleFilterUpdate} />
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
    handleSelectRecord: React.PropTypes.func.isRequired
  },
  BOTTOM_BUFFER: 500, // distance in px from bottom at which we load more records
  getInitialState: function() {
    return {numRowsToShow: 100};
  },
  componentDidMount: function() {
    $(window).on('scroll.vcftable', () => {
      // Show more rows if the browser viewport is close to the bottom and
      // there are more rows to be shown.
      if (this.state.numRowsToShow >= this.props.records.length) return;

      var $table = $(this.refs.lazyload.getDOMNode()),
          tableBottom = $table.position().top + $table.height(),
          windowBottom = $(window).scrollTop() + $(window).height();
      if (tableBottom < windowBottom + this.BOTTOM_BUFFER) {
        this.setState({numRowsToShow: this.state.numRowsToShow + 100});
      }
    });

    $(this.refs.lazyload.getDOMNode()).on('click', 'tr', (e) => {
      this.props.handleSelectRecord(
          this.props.records[$(e.currentTarget).index()]);
    });
  },
  componentWillUnmount: function() {
    $(window).off('scroll.vcftable');
    $(this.refs.lazyload.getDOMNode()).off('click');
  },
  render: function() {
    var selectedRecord = this.props.selectedRecord;
    var selKey = selectedRecord ? selectedRecord.__KEY__ : null;
    var rows = _.first(this.props.records, this.state.numRowsToShow)
        .map((record, idx) => <VCFRecord record={record}
                                         columns={this.props.columns}
                                         key={record.__KEY__}
                                         isSelected={record.__KEY__ == selKey} />);
    return (
      <tbody ref="lazyload">
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
    _.each(this.props.columns, (columns, topLvlColumnName) => {
      for (var colName in columns) {
        var column = columns[colName];
        tds.push(
          <td key={column.path.join('::')} title={column.path.join('→')}>
            {String(getIn(this.props.record, column.path))}
          </td>
        );
      }
    });
    var classes = React.addons.classSet({selected: this.props.isSelected});
    return (
      <tr className={classes}>
        <td title="chr::position" className="pos">{this.props.record.CHROM}::{this.props.record.POS}</td>
        <td title="REF/ALT">{this.props.record.REF}/{this.props.record.ALT}</td>
        {tds}
      </tr>
    );
  }
});


module.exports = VCFTable;
