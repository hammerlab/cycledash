'use strict';
var React = require('react'),
    forms = require('./forms'),
    LatestComments = require('../../comments/components/comment').LatestComments,
    _ = require('underscore'),
    moment = require('moment'),
    utils = require('../../examine/utils');

var NO_FILTER = '----';


var RunsPage = React.createClass({
  propTypes: {
    // cf. cycledash.projects._get_projects
    projects: React.PropTypes.arrayOf(React.PropTypes.object).isRequired,
    comments: React.PropTypes.arrayOf(React.PropTypes.object).isRequired,
  },
  getInitialState: function() {
    return {projectFilter: NO_FILTER,
            draggingOver: false,
            displayProjectForm: false};
  },
  setDisplayProjectForm: function(displayProjectForm) {
    this.setState({displayProjectForm});
  },
  handleProjectFilter: function(evt) {
    this.setState({projectFilter: evt.target.value});
  },
  filteredProjects: function() {
    return this.state.projectFilter === NO_FILTER ?
        this.props.projects :
        _.where(this.props.projects, {'name': this.state.projectFilter});
  },
  createDisplayProjectFormHandler: function(showForm) {
    return () => this.setState({showForm});
  },
  createDragOverHandler: function(draggingOver) {
    return () => this.setState({draggingOver});
  },
  render: function() {
    var projectOptions = [NO_FILTER].concat(_.pluck(this.props.projects, 'name')).map(name => {
      return <option value={name} key={name}>{name}</option>;
    });
    var projectTables = _.chain(this.filteredProjects())
        .sortBy(project => {
          var vcf = project.vcfs[0];
          // Sort by the descending ID, assuming project.runs is already sorted
          // by descending ID.
          return vcf ?  -vcf.id : -100;
        }).map(function(project) {
            return <ProjectTable key={project.name}
                                 runs={project.vcfs}
                                 bams={project.bams}
                                 project_id={project.id}
                                 name={project.name}
                                 notes={project.notes} />;
        }.bind(this)).value();
    var newProjectForm = <forms.NewProjectForm handleClose={() => this.setDisplayProjectForm(false)} />;
    return (
      <div onDragOver={this.createDragOverHandler(true)}
           onDragLeave={this.createDragOverHandler(false)}
           className={this.state.draggingOver ? 'dragging-over' : ''}>
        <h1>
          Data Directory
          {!this.state.displayProjectForm ?
           <button className='btn btn-default' id='new-project'
                   onClick={() => this.setDisplayProjectForm(true)}>
             New Project
           </button> : null}
        </h1>
        {this.state.displayProjectForm ? newProjectForm : null}
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
    project_id: React.PropTypes.number.isRequired,
    name: React.PropTypes.string.isRequired,
    notes: React.PropTypes.string,
    runs: React.PropTypes.arrayOf(React.PropTypes.object).isRequired,
    bams: React.PropTypes.arrayOf(React.PropTypes.object).isRequired
  },
  getInitialState: function() {
    return {selectedRunId: null,
            selectedBamId: null,
            displayRunForm: false,
            displayBAMForm: false,
            bamsTable: false};
  },
  displayRunForm: function(displayRunForm) {
    this.setState({displayRunForm});
  },
  displayBAMForm: function(displayBAMForm) {
    this.setState({displayBAMForm});
  },
  createClickRunHandler: function(runId) {
    return () => {
      var selectedRunId = this.state.selectedRunId === runId ? null : runId;
      this.setState({selectedRunId});
    };
  },
  createClickBamHandler: function(bamId) {
    return () => {
      var selectedBamId = this.state.selectedBamId === bamId ? null : bamId;
      this.setState({selectedBamId});
    };
  },
  render: function() {
    var newRunForm = <forms.NewRunForm bamUris={_.unique(_.pluck(this.props.bams, 'uri'))}
                                       projectId={this.props.id}
                                       projectName={this.props.name} />;
    var newBAMForm = <forms.NewBAMForm projectId={this.props.id}
                                       projectName={this.props.name} />;
    var numBams = this.props.bams.length;
    var numRuns = this.props.runs.length;
    var table;
    if (this.state.bamsTable) {
      table = <BamsTable bams={this.props.bams}
                         selectedBamId={this.state.selectedBamId}
                         createClickBamHandler={this.createClickBamHandler} />;
    } else {
      table = <RunsTable runs={this.props.runs}
                         selectedRunId={this.state.selectedRunId}
                         createClickRunHandler={this.createClickRunHandler} />;
    }
    return (
      <div className='project'>
        <div className='project-header'>
        <h2 title={this.props.project_id}>{this.props.name === 'null' ? 'No Project' : this.props.name}</h2>
          <div className='project-stats'>
            <div>
              <a onClick={() => this.setState({bamsTable: true})} className={this.state.bamsTable ? 'selected-pivot' : ''}>
                <em>{numBams}</em>&nbsp;BAMs
              </a>
              ,&nbsp;&nbsp;
              <a onClick={() => this.setState({bamsTable: false})} className={this.state.bamsTable ? '' : 'selected-pivot'}>
                {numRuns}&nbsp;Runs
              </a>
            </div>
          </div>
          <div className='add'>
            <button onClick={() => { this.displayRunForm(false); this.displayBAMForm(!this.state.displayBAMForm); }}
                    type='button' className='btn btn-default btn-xs'>
              Add BAM
            </button>
            <button onClick={() => { this.displayBAMForm(false); this.displayRunForm(!this.state.displayRunForm); }}
                    type='button' className='btn btn-default btn-xs'>
              Add Run
            </button>
          </div>
          <p className='notes'>{this.props.notes}</p>
        </div>
        {this.state.displayRunForm ? newRunForm : null}
        {this.state.displayBAMForm ? newBAMForm : null}
        {table}
      </div>
    );
  }
});


var RunsTable = React.createClass({
  propsType: {
    runs: React.PropTypes.string.isRequired,
    selectedRunId: React.PropTypes.integer,
    createClickRunHandler: React.PropTypes.func.isRequired,
  },
  render: function() {
    var rows = this.props.runs.map(run => {
      var rows = [<RunRow run={run} key={run.id} handleClick={this.props.createClickRunHandler(run.id)} />];
      if (run.id === this.props.selectedRunId) {
        var runDescription = (
            <RunDescriptionRow run={run}
                               key={'row-values-'+run.id} />);
        rows.push(runDescription);
      }
      return rows;
    });
    return (
      <table className='runs table'>
        <thead>
          <tr>
            <th></th>
            <th className='caller-name'>Caller Name</th>
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
          <a className='btn btn-default btn-xs' href={'/runs/' + run.id + '/examine'} ref='link'>Examine</a>
        </td>
        <td className='caller-name'>{run.caller_name}</td>
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
    run: React.PropTypes.object.isRequired
  },
  getInitialState: () => ({tasks: []}),
  // This is a map from titles to keys in `run` objects that are optionally
  // there to appear in the description field of an expanded RunRow.
  runDescriptionTitleKeys: {
    'Tumor BAM': ['tumor_bam', 'uri'],
    'Normal BAM': ['normal_bam', 'uri'],
    'VCF URI': ['uri'],
    'Notes': ['notes'],
    'Project': ['project_name']
  },
  render: function() {
    var run = this.props.run,
        descriptions = _.map(this.runDescriptionTitleKeys, (keys, title) => {
          if (utils.getIn(run, keys)) {
            return [<dt key={'dt'+keys}>{title}</dt>,
                    <dd key={'dd'+keys}>{utils.getIn(run, keys)}</dd>];
          }
        }),
        tasks = this.state.tasks.map(
          function({type, state}, i) {
            var stateEl = state == 'FAILURE' ?
                <a href={`/tasks/${run.id}`}>{state}</a> : state;
            return [<dt key={'tdt'+i}>{type}</dt>,
                    <dd key={'tdd'+i}>{stateEl}</dd>];
          });
    return (
      <tr className='info'>
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
      ['tumor_bam_id', 'tumor', 'Has an associated tumor BAM'],
      ['normal_bam_id', 'normal', 'Has an associated normal BAM'],
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
        <span>
          {run.num_comments === 0 ? null : run.num_comments}
        </span>
        <span className='comment-bubble'></span>
      </td>
    );
  }
});

var BamsTable = React.createClass({
  propsType: {
    bams: React.PropTypes.arrayOf(React.PropTypes.object).isRequired,
    selectedBamId: React.PropTypes.integer,
    createClickBamHandler: React.PropTypes.func.isRequired,
  },
  render: function() {
    var rows = this.props.bams.map(bam => {
      var rows = [<BamRow bam={bam} key={bam.id} handleClick={this.props.createClickBamHandler(bam.id)} />];
      if (bam.id === this.props.selectedBamId) {
        var bamDescription = (
            <BamDescriptionRow bam={bam}
                               key={'row-values-'+bam.id} />);
        rows.push(bamDescription);
      }
      return rows;
    });
    return (
      <table className='bams table'>
        <thead>
          <tr>
            <th className='bam-name'>BAM Name</th>
            <th className='resection-date'>Resected On</th>
            <th className='tissues'>Tissues</th>
          </tr>
        </thead>
        <tbody>
          {rows}
        </tbody>
      </table>
    );
  }
});

var BamRow = React.createClass({
  propTypes: {
    bam: React.PropTypes.object.isRequired,
    handleClick: React.PropTypes.func.isRequired
  },
  handleClick: function(evt) {
    this.props.handleClick();
  },
  render: function() {
    var bam = this.props.bam;
    return (
      <tr className='bam' onClick={this.handleClick}>
        <td className='name'>{bam.name}</td>
        <td className='resection-date'>{bam.resection_date}</td>
        <td className='tissues'>{bam.tissues}</td>
      </tr>
    );
  }
});

var BamDescriptionRow = React.createClass({
  propTypes: {
    bam: React.PropTypes.object.isRequired
  },
  getInitialState: () => ({tasks: []}),
  // This is a map from titles to keys in `bam` objects that are optionally
  // there to appear in the description field of an expanded BamRow.
  bamDescriptionTitleKeys: {
    'Notes': 'notes',
    'URI': 'uri'
  },
  render: function() {
    var bam = this.props.bam,
        descriptions = _.map(this.bamDescriptionTitleKeys, (key, title) => {
          if (bam[key]) {
            return [<dt key={'dt'+key}>{title}</dt>,
                    <dd key={'dd'+key}>{bam[key]}</dd>];
          }
        });
    return (
      <tr className='info'>
        <td colSpan='7'>
          <dl className='dl-horizontal'>
            {descriptions}
          </dl>
        </td>
      </tr>
    );
  }
});


module.exports = RunsPage;
