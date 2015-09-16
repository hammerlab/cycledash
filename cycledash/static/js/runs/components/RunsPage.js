'use strict';
var React = require('react'),
    forms = require('./forms'),
    LatestComments = require('../../comments/components/comment').LatestComments,
    _ = require('underscore'),
    moment = require('moment'),
    utils = require('../../examine/utils');

var NO_FILTER = 'All projects';

var ModalStates = {
  NONE: 0,
  PROJECT: 1,
  RUN: 2,
  BAM: 3
};

// This is a Bootstrap modal that displays all (3) forms: New Project, Add Run, and Add BAM
// Closing/esc'ing/unfocusing the modal will set the ModalState to NONE.
// cf. http://getbootstrap.com/javascript/#modals
var Modal = React.createClass({
  componentDidMount: function() {
    $('.modal').modal('show');
    $('.modal').on('hidden.bs.modal', this.props.handleClose);
  },
  hideModal: function() {
    $('.modal').modal('hide');
  },
  render: function(){
    return (
      <div className="modal fade" role="dialog" tabIndex="-1">
        <div className="modal-dialog" role="document">
          <button className='close' type='button' onClick={this.hideModal}>&times;</button>
          {this.props.children}
        </div>
      </div>
    );
  }
});

var RunsPage = React.createClass({
  propTypes: {
    // cf. cycledash.projects._get_projects
    projects: React.PropTypes.arrayOf(React.PropTypes.object).isRequired,
    comments: React.PropTypes.arrayOf(React.PropTypes.object).isRequired,
  },
  getInitialState: function() {
    return {projectFilter: NO_FILTER,
            draggingOver: false,
            displayProjectForm: false,
            modal: ModalStates.NONE};
  },
  closeModal: function(){
    this.setState({modal: ModalStates.NONE, "newFormProps": null});
  },
  showProjectModal: function(){
    this.setState({modal: ModalStates.PROJECT, "newFormProps": null});
  },
  showRunModal: function(projectName, projectId, projectBams){
    this.setState({modal: ModalStates.RUN, "newFormProps": {projectName, projectId, projectBams}});
  },
  showBAMModal: function(projectName, projectId){
    this.setState({modal: ModalStates.BAM, "newFormProps": {projectName, projectId}});
  },
  handleProjectFilter: function(evt) {
    this.setState({projectFilter: evt.target.value});
  },
  filteredProjects: function() {
    return this.state.projectFilter === NO_FILTER ?
        this.props.projects :
        _.where(this.props.projects, {'name': this.state.projectFilter});
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
                                 notes={project.notes}
                                 handleShowRunModal={this.showRunModal}
                                 handleShowBAMModal={this.showBAMModal} />;
        }.bind(this)).value();
    var modal;
    if (this.state.modal === ModalStates.NONE) {
      modal = null;
    } else {
      var form;
      if (this.state.modal === ModalStates.PROJECT) {
        form = <forms.NewProjectForm />;
      } else if (this.state.modal === ModalStates.RUN) {
        form = <forms.NewRunForm bamUris={_.unique(_.pluck(this.state.newFormProps.projectBams, 'uri'))}
                                 projectId={this.state.newFormProps.projectId}
                                 projectName={this.state.newFormProps.projectName} />;
      } else {
        form = <forms.NewBAMForm {...this.state.newFormProps} />;
      }
      modal = <Modal handleClose={this.closeModal}>{form}</Modal>;
    }
    return (
      <div className="row">
        <div onDragOver={this.createDragOverHandler(true)}
             onDragLeave={this.createDragOverHandler(false)}
             className={this.state.draggingOver ? 'dragging-over container' : 'container'}>
          <div className="projects-page-header">
            <h1>
              Projects
              {!this.state.displayProjectForm ?
               <button className='btn btn-primary' id='new-project'
                       onClick={this.showProjectModal}>
                 New Project
               </button> : null}
            </h1>
          </div>
          <div className="projects-table">
          <div className='filter-runs'>
            <label>Now Viewing</label>
            <select className='select-project-filter' value={this.state.projectFilter}
                    onChange={this.handleProjectFilter}>
              {projectOptions}
            </select>
          </div>
            {projectTables}
          </div>
          <LatestComments comments={this.props.comments} />
        </div>
        {modal}
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
    bams: React.PropTypes.arrayOf(React.PropTypes.object).isRequired,
    handleShowRunModal: React.PropTypes.func,
    handleShowBAMModal: React.PropTypes.func
  },
  getInitialState: function() {
    return {selectedRunId: null,
            selectedBamId: null,
            bamsTable: false};
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
  showRunModal: function(){
    this.props.handleShowRunModal(this.props.name, this.props.project_id, this.props.bams);
  },
  showBAMModal: function(){
    this.props.handleShowBAMModal(this.props.name, this.props.project_id);
  },
  render: function() {
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
    var notes;
    if (this.props.notes) {
      notes = <p className='notes'>{this.props.notes}</p>;
    }
    return (
      <div className='project'>
        <div className='project-header'>
          <h2 title={this.props.project_id}>{this.props.name === 'null' ? 'No Project' : this.props.name}</h2>
          {notes}
        </div>
        <div className='project-stats'>
          <div className='project-table-nav'>
            <a onClick={() => this.setState({bamsTable: false})} className={this.state.bamsTable ? '' : 'selected-pivot'}>
              {numRuns} Runs
            </a>
            <a onClick={() => this.setState({bamsTable: true})} className={this.state.bamsTable ? 'selected-pivot' : ''}>
              {numBams} BAMs
            </a>
          </div>
          <div className='add'>
            <button onClick={this.showRunModal}
                    type='button' className='btn btn-primary btn-xs'>
              Add Run
            </button>
            <button onClick={this.showBAMModal}
                    type='button' className='btn btn-primary btn-xs'>
              Add BAM
            </button>
          </div>
        </div>
        <div className="runs-table-container">
          {table}
        </div>
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
      <table className='runs-table'>
        <thead>
          <tr>
            <th className='caller-name'>Caller Name</th>
            <th className='date'>Submitted</th>
            <th className='num-variants'>Variants</th>
            <th className='linked-bams'>Linked BAMs</th>
            <th className='task-labels'></th>
            <th className='num-comments'></th>
            <th className='examine-col'></th>
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
        <td className='caller-name'>{run.caller_name}</td>
        <td className='date' title={run.created_at}>{moment(new Date(run.created_at)).format('YYYY-MM-DD')}</td>
        <td className='num-variants' title={run.genotype_count}>{run.genotype_count}</td>
        <LinkedBams run={run} />
        <TaskLabels run={run} />
        <RunComments run={run} />
        <td className='run-id'>
          <a className='btn btn-default btn-xs' href={'/runs/' + run.id + '/examine'} ref='link'>Examine</a>
        </td>
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
                <a href={`/runs/${run.id}/tasks`}>{state}</a> : state;
            return [<dt key={'tdt'+i}>{type}</dt>,
                    <dd key={'tdd'+i}>{stateEl}</dd>];
          });
    return (
      <tr className='info'>
        <td colSpan='7'>
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
      url: `/api/runs/${this.props.run.id}/tasks`,
      dataType: "json",
      contentType: "application/json;charset=utf-8",
    })
    .done(tasks => {
      this.setState({tasks: tasks.tasks});
    });
  }
});

var TaskLabels = React.createClass({
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
    var labelSpecs = [
      {path: ['run'], title: 'Has a running worker task', cssClass: 'run'},
      {path: ['fail'], title: 'Has a failed worker task', cssClass: 'fail'}
    ];
    var labels = labelSpecs.map(
      function({path, title, cssClass}) {
        var value = utils.getIn(taskStates, path);
        if (value) {
          return (
            <span className={cssClass} title={title} key={path.join('-')}>
              {value}
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

var LinkedBams = React.createClass({
  propTypes: {
    run: React.PropTypes.object.isRequired
  },
  render: function() {
    var run = this.props.run;

    var labelSpecs = [
      {path: ['tumor_bam' , 'name'], title: 'Tumor BAM' },
      {path: ['normal_bam', 'name'], title: 'Normal BAM' },
    ];
    var runBams = labelSpecs.map(
      function({path, title}) {
        var value = utils.getIn(run, path);
        if (value) {
          return (
            <span className="linked-bam" title={title} key={path.join('-')}>
              {value}
            </span>
          );
        }
      });
    return (
        <td className='bam-labels'>
          {runBams}
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
    var commentBubble;
    if (run.num_comments !== 0){
      commentBubble = <div>{run.num_comments}<span className='comment-bubble'></span></div>;
    }

    return (
      <td className='comments'>
        {commentBubble}
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
      <table className='bams-table'>
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
