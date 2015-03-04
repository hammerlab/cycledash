'use strict';
var React = require('react'),
    SubmitRunForm = require('./SubmitRunForm'),
    LatestComments = require('./LatestComments'),
    _ = require('underscore'),
    moment = require('moment');

var NO_FILTER = '----';


var RunsPage = React.createClass({
  propTypes: {
    runs: React.PropTypes.arrayOf(React.PropTypes.object).isRequired,

    // This is a map from titles to keys in `run` objects that are optionally
    // there to appear in the description field of an expanded RunRow.
    runDescriptionTitleKeys: React.PropTypes.object.isRequired,

    comments: React.PropTypes.arrayOf(React.PropTypes.object).isRequired,

    // This is a map containing possible completions for typeahead in the
    // SubmitRunForm.
    // { variantCallerNames: ['forexample', 'guacamole', 'Strelka'], ... };
    completions: React.PropTypes.object.isRequired
  },
  getInitialState: function() {
    return {projectFilter: null,
            showForm: false,
            draggingOver: false};
  },
  filteredRuns: function() {
    return this.props.runs.filter(run => {
      var filter = this.state.projectFilter,
          noFilter = filter === null,
          matches = filter && filter.match(run.project_name);
      return noFilter || matches;
    });
  },
  handleProjectFilter: function(evt) {
    var val = evt.target.value;
    this.setState({projectFilter: val === NO_FILTER ? null : val});
  },
  createDisplayFormHandler: function(showForm) {
    return () => this.setState({showForm});
  },
  createDragOverHandler: function(draggingOver) {
    return () => this.setState({draggingOver});
  },
  render: function() {
    var projectNames = _.chain(this.props.runs)
        .pluck('project_name')
        .unique()
        .filter(p => p)
        .sortBy(p => p)
        .value();
    var projectOptions = [NO_FILTER].concat(projectNames).map(name => {
      return <option value={name} key={name}>{name}</option>;
    });
    var runs = this.filteredRuns();
    var projectTables = _.chain(runs)
        .groupBy('project_name')
        .map((runs, projectName) => [projectName, runs])
        .sortBy(function([projectName, runs]) {
          return -runs[0].id; // to sort by the descending ID
        }).map(function([projectName, runs]) {
          return <ProjectTable key={projectName}
                               runs={runs}
                               runDescriptionTitleKeys={this.props.runDescriptionTitleKeys}
                               name={projectName} />;
        }.bind(this)).value();

    var form = <SubmitRunForm completions={this.props.completions}
                              handleClose={this.createDisplayFormHandler(false)}
                              handleDrop={this.createDragOverHandler(false)} />;
    return (
      <div onDragOver={this.createDragOverHandler(true)}
           onDragLeave={this.createDragOverHandler(false)}
           className={this.state.draggingOver ? 'dragging-over' : ''}>
        <h1>
          Data Directory
          {!this.state.showForm ?
           <button id='show-submit'
                   className='btn btn-default'
                   onClick={this.createDisplayFormHandler(true)}>
             Submit New Run
           </button>
           : null}
        </h1>
        {this.state.showForm ? form : null}
        <LatestComments comments={this.props.comments} />
        <h5>
          Filter runs by project name:&nbsp;&nbsp;
          <select value={this.state.projectFilter}
                  onChange={this.handleProjectFilter}>
            {projectOptions}
          </select>
        </h5>
        {projectTables}
      </div>
    );
  }
});

var ProjectTable = React.createClass({
  propTypes: {
    name: React.PropTypes.string.isRequired,
    runs: React.PropTypes.arrayOf(React.PropTypes.object).isRequired,
    // This is a map from titles to keys in `run` objects that are optionally
    // there to appear in the description field of an expanded RunRow.
    runDescriptionTitleKeys: React.PropTypes.object.isRequired
  },
  getInitialState: function() {
    return {selectedRunId: null};
  },
  createClickRunHandler: function(runId) {
    return () => {
      var selectedRunId = this.state.selectedRunId === runId ? null : runId;
      this.setState({selectedRunId});
    };
  },
  render: function() {
    var rows = this.props.runs.map(run => {
      var rows = [<RunRow run={run} key={run.id} handleClick={this.createClickRunHandler(run.id)} />];
      if (run.id === this.state.selectedRunId) {
        var runDescription = (
            <RunDescriptionRow run={run}
                               runDescriptionTitleKeys={this.props.runDescriptionTitleKeys}
                               key={'row-values-'+run.id} />);
        rows.push(runDescription);
      }
      return rows;
    });
    var numDatasets = _.chain(this.props.runs).pluck('dataset_name').unique().value().length;
    var numRuns = this.props.runs.length;
    return (
      <div className='project'>
        <div className='project-header'>
          <h2>{this.props.name === 'null' ? 'No Project' : this.props.name}</h2>
          <div className='project-stats'>
            <em>{numDatasets}</em> Datasets, &nbsp;<em>{numRuns}</em> Runs
          </div>
        </div>
        <table className='runs table table-hover'>
          <thead>
            <tr>
              <th></th>
              <th className='caller-name'>Caller Name</th>
              <th className='dataset'>Dataset</th>
              <th className='date'>Submitted On</th>
              <th className='num-variants'>Variants</th>
              <th></th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rows}
          </tbody>
        </table>
      </div>
    );
  }
});

var RunRow = React.createClass({
  propTypes: {
    run: React.PropTypes.object.isRequired,
    handleClick: React.PropTypes.func.isRequired
  },
  handleClick: function(evt) {
    if (evt.target == this.refs.link.getDOMNode()) return;
    this.props.handleClick();
  },
  render: function() {
    var run = this.props.run;
    return (
      <tr className='run' onClick={this.handleClick}>
        <td className='run-id'>
          <span className='run-id'>{run.id}</span>
          <a className='btn btn-default btn-xs' href={'/runs/' + run.id + '/examine'} ref='link'>Examine</a>
        </td>
        <td className='caller-name'>{run.caller_name}</td>
        <td className='dataset'>{run.dataset_name}</td>
        <td className='date' title={run.created_at}>{moment(new Date(run.created_at)).format('YYYY-MM-DD')}</td>
        <td className='num-variants' title={run.genotype_count}>{run.genotype_count}</td>
        <RunLabels run={run} />
        <RunComments run={run} />
      </tr>
    );
  }
});

var RunDescriptionRow = React.createClass({
  propTypes: {
    run: React.PropTypes.object.isRequired,
    runDescriptionTitleKeys: React.PropTypes.object.isRequired
  },
  getInitialState: () => ({tasks: null}),
  render: function() {
    var run = this.props.run,
        descriptions = _.map(this.props.runDescriptionTitleKeys, (key, title) => {
          if (run[key]) {
            return [<dt key={'dt'+key}>{title}</dt>,
                    <dd key={'dd'+key}>{run[key]}</dd>];
          }
        }),
        tasks = this.state.tasks &&
          this.state.tasks.map(function({type, state}, i) {
            var ds = [<dt key={'tdt'+i}>{type}</dt>,
                      <dd key={'tdd'+i}>{state}</dd>];
            if (state == 'FAILURE') {
              ds[1] = <a href={`/tasks/${run.id}`}>{ds[1]}</a>;
            }
            return ds;
          });
    return (
      <tr className='run-info'>
        <td colSpan='6'>
          <dl className='dl-horizontal'>
            {descriptions}
            {tasks}
          </dl>
        </td>
      </tr>
    );
  },
  componentDidMount: function() {
    $.ajax({
      url: `/tasks/${this.props.run.id}`,
      dataType: "json",
      contentType: "application/json;charset=utf-8",
    })
    .done(tasks => {
      this.setState({tasks: tasks.tasks});
    });
  }
});

var RunLabels = React.createClass({
  propTypes: {
    run: React.PropTypes.object.isRequired
  },
  // Simplified task state map for state icons
  stateMap: {
    'STARTED': 'run',
    'PENDING': 'run',
    'FAILURE': 'fail',
    'SUCCESS': null
  },
  render: function() {
    var run = this.props.run;
    var taskStates = _.chain(run.task_states)
                      .map(x => this.stateMap[x])
                      .unique()
                      .filter(x => x)
                      .map(x => [x, true])
                      .object()
                      .value();
    var labelTypes = [
      ['validation_vcf', 'validation', 'Is a validation VCF'],
      ['tumor_bam_uri', 'tumor', 'Has an associated tumor BAM'],
      ['normal_bam_uri', 'normal', 'Has an associated normal BAM'],
      ['run', '', 'Has a running worker task'],
      ['fail', '', 'Has a failed worker task']
    ];
    var labels = labelTypes.map(function([key, text, title]) {
      if (run[key] || taskStates[key]) {
        return (
          <span className={`label label-info ${key}`} title={title} key={key}>
            {text}
          </span>
        );
      }
    });
    return (
        <td className='labels'>
          {labels}
        </td>
    );
  }
});

var RunComments = React.createClass({
  propTypes: {
    run: React.PropTypes.object.isRequired
  },
  render: function() {
    var run = this.props.run;
    var tdClasses = React.addons.classSet({
      'comments': true,
      'no-comment': run.num_comments === 0
    });
    return (
      <td className={tdClasses}>
        <span className='comment-bubble'></span>
        <span>
          { run.num_comments }
        </span>
      </td>
    );
  }
});


module.exports = RunsPage;
