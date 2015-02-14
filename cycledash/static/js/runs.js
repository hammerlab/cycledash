'use strict';
var d3 = require('d3'),
    React = require('react'),
    _ = require('underscore');


  //////////////////////////
 // React Run page code: //
//////////////////////////
var NO_FILTER = '----';

var RunsPage = React.createClass({
  propTypes: {
    runs: React.PropTypes.arrayOf(React.PropTypes.object).isRequired,
    runKeyVals: React.PropTypes.object.isRequired
  },
  getInitialState: function() {
    return {selectedRunId: null, projectFilter: null};
  },
  filteredRuns: function() {
    return this.props.runs.filter(run => (this.state.projectFilter === null) || this.state.projectFilter.match(run.project_name) );
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
    var projects = projectNames.map(name => <option value={name} key={name ? name : NO_FILTER}>{name ? name : NO_FILTER}</option>);
    var runs = this.filteredRuns();
    var rows = runs.map((run) => {
      var rows = [<RunRow run={run} key={run.id} handleClick={this.handleClickRun(run.id)} />];
      if (run.id === this.state.selectedRunId) {
        rows.push(<RowValues run={run} runKeyVals={this.props.runKeyVals} key={'row-values-'+run.id} />);
      }
      return rows;
    });
    return (
      <div>
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

var RunRow = React.createClass({
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
        <RowLabels run={run} />
        <RowComments run={run} />
      </tr>
    );
  }
});

var RowValues = React.createClass({
  propTypes: {
    run: React.PropTypes.object.isRequired,
    runKeyVals: React.PropTypes.object.isRequired
  },
  render: function() {
    var run = this.props.run,
        descriptions = _.reduce(this.props.runKeyVals, function(acc, key, title) {
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

var RowLabels = React.createClass({
  propTypes: {
    run: React.PropTypes.object.isRequired
  },
  render: function() {
    var run = this.props.run;
    return (
        <td className='labels'>
          { run.validation_vcf ? <span className='label label-info' title='Is a validation VCF'>validation</span> : null }
          { run.tumor_bam_uri ? <span className='label label-info' title='Has an associated tumor BAM'>tumor</span> : null }
          { run.normal_bam_uri ? <span className='label label-info' title='Has an associated normal BAM'>normal</span> : null }
        </td>
    );
  }
});

var RowComments = React.createClass({
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


  ///////////////////////////////////////
 // Non-React code for form handling: //
///////////////////////////////////////

// Upload the file and place its path in the element.
function upload(file, fileInputElement) {
  fileInputElement.value = '…uploading…';

  var formData = new FormData();
  formData.append('file', file);

  d3.text('/upload')
    .post(formData)
    .on('load', function(path) {
      fileInputElement.value = path;
    })
    .on('error', function(error) {
      console.error(error);
      fileInputElement.value = extractError(error);
    })
    .on('progress', function() {
      var e = d3.event;
      if (e.lengthComputable) {
        fileInputElement.value = 'Uploaded ' + e.loaded + '/' + e.total + ' bytes';
      }
    });
}

// Extract an error message from an XMLHttpRequest response
function extractError(response) {
  var json;
  try {
    json = JSON.parse(response.responseText);
  } catch(e) {
    return 'Upload failed.';
  }

  return json.message || json.error || 'Upload failed.';
}


window.renderRunPage = function(el, runs, runKeyVals) {
  React.render(<RunsPage runs={runs} runKeyVals={runKeyVals} />, el);

  d3.select('#show-submit')
      .on('click', function() {
        d3.select(this)
            .style('display', 'none');
        d3.select('form#submit')
            .style('display', 'block');
      });

  d3.select('form#submit .close')
      .on('click', function() {
        d3.select('form#submit')
            .style('display', 'none');
        d3.select('#show-submit')
            .style('display', 'block');
      });

  d3.selectAll('.uploadable')
      .on('dragover', function() {
        d3.select(this).classed({'receiving-drag': true});
      })
      .on('dragleave', function() {
        d3.select(this).classed({'receiving-drag': false});
      })
      .on('drop', function() {
        d3.event.preventDefault();
        d3.select(this).classed({'receiving-drag': false});
        d3.selectAll('.uploadable').classed({'wanting-drag': false});
        var files = d3.event.dataTransfer.files;
        if (files.length === 0) return;
        if (files.length > 1) {
          window.alert('You may only upload one file at a time.');
          return;
        }
        upload(files[0], this);
      });

  d3.select('main')
    .on('dragover', function() {
      d3.selectAll('.uploadable').classed({'wanting-drag': true});
    })
    .on('dragleave', function() {
      d3.selectAll('.uploadable').classed({'wanting-drag': false});
    });
};
