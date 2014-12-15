'use strict';

var _ = require('underscore'),
    React = require('react/addons'),
    types = require('./types'),
    $ = require('jquery'),
    marked = require('marked'),
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
    // List of VCF records (including embedded user comments)
    records: React.PropTypes.arrayOf(React.PropTypes.object).isRequired,
    // Attribute by which we are sorting
    sortBys: React.PropTypes.array.isRequired,
    handleSortByChange: React.PropTypes.func.isRequired,
    handleSelectRecord: React.PropTypes.func.isRequired,
    handleOpenViewer: React.PropTypes.func.isRequired,
    handleRequestPage: React.PropTypes.func.isRequired,
    handleSetComment: React.PropTypes.func.isRequired,
    handleDeleteComment: React.PropTypes.func.isRequired
  },
  // Call this to scroll a record to somewhere close to the top of the page.
  scrollRecordToTop: function(record) {
    var idx = this.props.records.indexOf(record);
    if (idx >= 0) {
      var row = $(this.refs.vcfTable.getDOMNode()).find('tr').get(idx);
      $('html,body').animate({
        scrollTop: $(row).offset().top
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
                      selectedRecord={this.props.selectedRecord}
                      handleRequestPage={this.props.handleRequestPage}
                      handleSelectRecord={this.props.handleSelectRecord}
                      handleOpenViewer={this.props.handleOpenViewer}
                      handleSetComment={this.props.handleSetComment}
                      handleDeleteComment={this.props.handleDeleteComment} />
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
    var uberColumns = [];
    var columnHeaders = [];
    var initialThElements = [
      <th key='has-comment' />,
      <th key='contig-position' data-attribute='position'>
        contig:position
        <a className={sorterClasses}
          onClick={this.handleSortByChange('position')}>
        </a>
      </th>,
      <th key='ref' className='ref'>REF</th>,
      <th key='arrow' className='arrow'>→</th>,
      <th key='alt' className='alt'>ALT</th>
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
          <th colSpan={initialThElements.length} />
          {uberColumns}
        </tr>
        <tr>
          {initialThElements}
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
    handleOpenViewer: React.PropTypes.func.isRequired,
    handleRequestPage: React.PropTypes.func.isRequired,
    handleSetComment: React.PropTypes.func.isRequired,
    handleDeleteComment: React.PropTypes.func.isRequired
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
  },
  componentWillUnmount: function() {
    $(window).off('scroll.vcftable');
    $(this.refs.lazyload.getDOMNode()).off('click');
  },
  render: function() {
    var selectedRecord = this.props.selectedRecord,
        rows = this.props.records.map((record, idx) => {
          var key = record.contig + record.position + record.reference + record.alternates + record.sample_name;

          // The actual comment element should be distinguished from its parent record
          var commentKey = key + 'comment';
          var elements = [
            <VCFRecord record={record}
                       hasComment={_.has(record, 'comment')}
                       columns={this.props.columns}
                       key={key}
                       isSelected={selectedRecord === record}
                       handleSelectRecord={this.props.handleSelectRecord} />
          ];
          if (selectedRecord === record) {
            elements.push(
              <VCFCommentBox record={record}
                             key={commentKey}
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
    hasComment: React.PropTypes.bool.isRequired,
    columns: React.PropTypes.object.isRequired,
    isSelected: React.PropTypes.bool.isRequired,
    handleSelectRecord: React.PropTypes.func.isRequired
  },
  onClick: function() {
    // If the same record is selected, treat that as a deselect toggle.
    if (this.props.isSelected) {
      this.props.handleSelectRecord(null);
    } else {
      this.props.handleSelectRecord(this.props.record);
    }
  },
  formatCell: function(column) {
    var val = this.props.record[column.path.join(':')];
    if (val === null) {
      return '-';
    }
    return String(val);
  },
  render: function() {
    var tds = [
      <td key='has-comment'>{this.props.hasComment ? '✉︎' : ''}</td>,
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
      </td>
    ];
    _.each(this.props.columns, (columns, topLevelColumnName) => {
      for (var columnName in columns) {
        var column = columns[columnName];
        tds.push(
          <td key={column.path.join(':')} title={column.path.join('→')}>
            {this.formatCell(column)}
          </td>
        );
      }
    });
    var classes = React.addons.classSet({selected: this.props.isSelected});
    var record = this.props.record;
    return (
      <tr className={classes} onClick={this.onClick}>
        {tds}
      </tr>
    );
  }
});

// The VCFCommentBox box handles all functionality that requires the record and
// comment objects, including opening the Dalliance viewer. All child elements
// only require the comment text.
var VCFCommentBox = React.createClass({
  propTypes: {
    record: React.PropTypes.object.isRequired,
    handleOpenViewer: React.PropTypes.func.isRequired,
    handleSetComment: React.PropTypes.func.isRequired,
    handleDeleteComment: React.PropTypes.func.isRequired
  },
  handleSave: function(commentText) {
    var newComment;

    // If an old comment is provided, we clone it.
    if (!_.isUndefined(this.props.record.comment)) {
      newComment = _.clone(this.props.record.comment);
      newComment.comment_text = commentText;
    } else {
      // Otherwise, we fashion a new comment out of the record information.
      newComment = _.extend(
        _.pick(
          this.props.record,
          'contig',
          'position',
          'reference',
          'alternates',
          'sample_name'),
          {'comment_text': commentText});
    }

    // Actually send the update request.
    this.props.handleSetComment(newComment);
  },
  handleDelete: function() {
    var result = window.confirm("Are you sure you want to delete this comment?");
    if (result) {
      this.props.handleDeleteComment(this.props.record.comment);
    }
  },
  render: function() {
    var commentText = !_.isUndefined(this.props.record.comment) ?
      this.props.record.comment.comment_text : '';
    return (
      <tr>
        <td colSpan={10000} className='variant-info'>
          <div>
            <div>
              <button className='btn btn-default dalliance-button btn-info'
                      onClick={() => {this.props.handleOpenViewer(this.props.record);}}>
                Open Biodalliance
              </button>
            </div>
            <VCFComment commentText={commentText}
                        handleDelete={this.handleDelete}
                        handleSave={this.handleSave} />
          </div>
        </td>
      </tr>
    );
  }
});

// The VCFComment record handles all state for user comments.
var VCFComment = React.createClass({
  propTypes: {
    commentText: React.PropTypes.string.isRequired,
    handleDelete: React.PropTypes.func.isRequired,
    handleSave: React.PropTypes.func.isRequired
  },
  getInitialState: function() {
    return {value: this.props.commentText, isEdit: false};
  },
  setValueState: function(value) {
    // If passed no value, setValueState resets the value.
    if (_.isUndefined(value)) {
      this.setState({value: this.props.commentText});
      return;
    }

    this.setState({value: value});
  },
  getValueState: function() {
    return this.state.value;
  },
  setEditState: function(isEdit) {
    this.setState({isEdit: isEdit});
  },
  componentDidUpdate: function(prevProps, prevState) {
    if (prevProps.commentText !== this.props.commentText) {
      this.setState({value: this.props.commentText});
    }
  },
  render: function() {
    var placeHolder = 'No Comment';
    var commentElement = this.state.isEdit ?
      <VCFCommentEditor commentText={this.props.commentText}
                        placeHolder={placeHolder}
                        getValueState={this.getValueState}
                        setValueState={this.setValueState}
                        setEditState={this.setEditState}
                        handleSave={this.props.handleSave} /> :
      <VCFCommentViewer commentText={this.props.commentText}
                        placeHolder={placeHolder} />;
    return (
      <div className='comment-container'>
        <VCFCommentHeader handleEdit={() => {this.setEditState(true);}}
                          handleDelete={this.props.handleDelete} />
        {commentElement}
      </div>
    );
  }
});

var VCFCommentHeader = React.createClass({
  propTypes: {
    handleEdit: React.PropTypes.func.isRequired,
    handleDelete: React.PropTypes.func.isRequired
  },
  render: function() {
    return (
      <div className='comment-header'>
        <button className='btn btn-default btn-xs comment-button'
                onClick={this.props.handleEdit}>
          Edit
        </button>
        <button className='btn btn-default btn-xs comment-button btn-danger'
                onClick={this.props.handleDelete}>
          Delete
        </button>
      </div>
    );
  }
});

var VCFCommentViewer = React.createClass({
  propTypes: {
    commentText: React.PropTypes.string.isRequired,
    placeHolder: React.PropTypes.string.isRequired
  },
  render: function() {
    // Warning: by using this dangerouslySetInnerHTML feature, we're relying
    // on marked to be secure.
    var plainText = this.props.commentText !== '' ?
      this.props.commentText : this.props.placeHolder;
    var markedDownText = marked(plainText);
    return (
      <div className='form-control comment-text'
           dangerouslySetInnerHTML={{__html: markedDownText}} />
    );
  }
});

var VCFCommentEditor = React.createClass({
  propTypes: {
    commentText: React.PropTypes.string,
    placeHolder: React.PropTypes.string.isRequired,
    getValueState: React.PropTypes.func.isRequired,
    setValueState: React.PropTypes.func.isRequired,
    setEditState: React.PropTypes.func.isRequired,
    handleSave: React.PropTypes.func.isRequired
  },
  handleSaveText: function() {
    var commentText = this.refs.textArea.getDOMNode().value.trim();
    if (commentText !== '') {
      // Create a new comment if none existed, or update the comment if it
      // changed (creating a new comment object in both cases).
      if (this.props.commentText !== commentText) {
        this.props.handleSave(commentText);
        this.props.setValueState(commentText);
        this.props.setEditState(false);
        return;
      }
    }

    // Reset the value and edit mode, if not already reset.
    this.props.setValueState();
    this.props.setEditState(false);

    // TODO(tavi) Alert the user to the fact their update (e.g. '') was not
    // submitted.
  },
  handleCancelConfirm: function(event) {
    var result = window.confirm("Are you sure you want to cancel this edit?");
    if (result) {
      this.props.setValueState();
      this.props.setEditState(false);
    }
  },
  handleChange: function(event) {
    this.props.setValueState(event.target.value);
  },
  render: function() {
    return (
      <div>
        <textarea className='form-control comment-textarea'
                  value={this.props.getValueState()}
                  placeholder={this.props.placeHolder}
                  onChange={this.handleChange}
                  ref='textArea' />
        <div className='edit-buttons'>
          <button className='btn btn-default comment-button btn-danger'
                  onClick={this.handleCancelConfirm}>
            Cancel
          </button>
          <button className='btn btn-default comment-button btn-success'
                  onClick={this.handleSaveText}>
            Save
          </button>
        </div>
      </div>
    );
  }
});


module.exports = VCFTable;
