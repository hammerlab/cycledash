var React = require('react'),
    SubmitRunForm = require('./SubmitRunForm'),
    LatestComments = require('./LatestComments'),
    _ = require('underscore');

var NO_FILTER = '----';

var RunsPage = React.createClass({
  propTypes: {
    runs: React.PropTypes.arrayOf(React.PropTypes.object).isRequired,
    runDescriptionTitleKeys: React.PropTypes.object.isRequired,
    comments: React.PropTypes.arrayOf(React.PropTypes.object).isRequired
  },
  getInitialState: function() {
    return {selectedRunId: null, projectFilter: null};
  },
  filteredRuns: function() {
    return this.props.runs.filter(run => {
      var filter = this.state.projectFilter,
          noFilter = filter === null,
          matches = filter && filter.match(run.project_name);
      return noFilter || matches;
    });
  },
  handleClickRun: function(runId) {
    return () => {
      this.setState({selectedRunId: this.state.selectedRunId === runId ? null : runId});
    };
  },
  handleProjectFilter: function(evt) {
    var val = evt.target.value;
    this.setState({projectFilter: val === NO_FILTER ? null : val});
  },
  render: function() {
    var projectNames = _.unique(_.pluck(this.props.runs, 'project_name'));
    var projects = projectNames.map(name => {
      return (
          <option value={name} key={name ? name : NO_FILTER}>
            {name ? name : NO_FILTER}
          </option>
      );
    });
    var runs = this.filteredRuns();
    var rows = runs.map((run) => {
      var rows = [<Run run={run} key={run.id} handleClick={this.handleClickRun(run.id)} />];
      if (run.id === this.state.selectedRunId) {
        rows.push(<RunDescription run={run}
                                   runDescriptionTitleKeys={this.props.runDescriptionTitleKeys}
                                   key={'row-values-'+run.id} />);
      }
      return rows;
    });
    return (
      <div>
        <h2>Runs Directory
          <button id="show-submit" className="btn btn-default">Submit New Run</button>
        </h2>
        <SubmitRunForm />
        <LatestComments comments={this.props.comments} />
        <h5>Filter runs by project name:&nbsp;&nbsp;
          <select value={this.state.projectFilter}
                  onChange={this.handleProjectFilter}>{projects}</select>
        </h5>
        <table className='runs table condenses table-hover' >
          <thead>
            <tr>
              <th></th>
              <th className='caller-name'>Caller Name</th>
              <th className='dataset'>Dataset</th>
              <th className='date'>Submitted On</th>
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

var Run = React.createClass({
  propTypes: {
    run: React.PropTypes.object.isRequired,
    handleClick: React.PropTypes.func.isRequired
  },
  render: function() {
    var run = this.props.run;
    return (
      <tr className='run' onClick={this.props.handleClick}>
        <td className='run-id'>
          <span className='run-id'>{ run.id }</span>
          <a className='btn btn-default btn-xs' href='/runs/{ run.id }/examine'>Examine</a>
        </td>
        <td className='caller-name'>{ run.caller_name }</td>
        <td className='dataset'>{ run.dataset_name }</td>
        <td className='date' title='{ run.created_at }'>{ run.created_at }</td>
        <RunLabels run={run} />
        <RunComments run={run} />
      </tr>
    );
  }
});

var RunDescription = React.createClass({
  propTypes: {
    run: React.PropTypes.object.isRequired,
    runDescriptionTitleKeys: React.PropTypes.object.isRequired
  },
  render: function() {
    var run = this.props.run,
        descriptions = _.reduce(this.props.runDescriptionTitleKeys, function(acc, key, title) {
          if (run[key]) {
            acc.push(<dt key={'dt'+key}>{ title }</dt>);
            acc.push(<dd key={'dd'+key}>{ run[key] }</dd>);
          }
          return acc;
        }, []);
    return (
      <tr className='run-info'>
        <td colSpan='6'>
          <dl className='dl-horizontal'>
            {descriptions}
          </dl>
        </td>
      </tr>
    );
  }
});

var RunLabels = React.createClass({
  propTypes: {
    run: React.PropTypes.object.isRequired
  },
  render: function() {
    var run = this.props.run,
        labels = [];
    if (run.validation_vcf) {
      labels.push(<span className='label label-info'
                        title='Is a validation VCF'
                        key='valid-label'>
                    validation
                  </span>);
    }
    if (run.tumor_bam_uri) {
      labels.push(<span className='label label-info'
                        title='Has an associated tumor BAM'
                        key='tumor-bam-label'>
                    tumor
                  </span>);
    }
    if (run.normal_bam_uri) {
      labels.push(<span className='label label-info'
                        title='Has an associated normal BAM'
                        key='normal-bam-label'>
                    normal
                  </span>);
    }
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
    return (
      <td className='comments'>
        <span className={'comment-bubble' + (run.num_comments ? '' : ' no-comment') }></span>
        <span className={ run.num_comments ? '' : 'no-comment' }>
          { run.num_comments }
        </span>
      </td>
    );
  }
});


module.exports = RunsPage;
