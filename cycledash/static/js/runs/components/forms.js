'use strict';
var React = require('react'),
    d3 = require('d3'),
    $ = require('jquery'),
    _ = require('underscore');


// Hack to make typeahead.js use the correct jQuery.
// This should be improved when typeahead v0.11 is released, see
// https://github.com/twitter/typeahead.js/issues/743#issuecomment-52817924
(function() {
  var oldJQuery = window.jQuery;
  window.jQuery = $;
  require('typeahead.js');
  window.jQuery = oldJQuery;
})(); // from ../examine/components/QueryBox.js

// This instruments a form to submit via AJAX.
// if the form successfully submits, the page will refresh.
// If there is an error, the error message is shown in an alert.
function ajaxifyForm(form) {
  $(form).submit(function(evt) {
    evt.preventDefault();
    var inputs = $(form).find('input, textarea').toArray();
    var requestData = _.reduce(inputs, (req, input) => {
      if (input.value.length > 0) {
        req[input.name] = input.value;
      }
      return req;
    }, {});
    $.ajax({
      url: form.action,
      type: form.method || 'GET',
      data: requestData
    }).done(() => {
      window.location.reload();
    }).error(e => {
      window.alert(e.responseText);
    });
    return false;
  });
}

var NewRunForm = React.createClass({
  propTypes: {
    // list of URIs used for completing the BAM URIs
    bamUris: React.PropTypes.arrayOf(React.PropTypes.string).isRequired,
    projectName: React.PropTypes.string.isRequired
  },
  componentDidMount: function() {
    ajaxifyForm(this.refs.runForm.getDOMNode());
  },
  render: function() {
    var props = this.props;
    return (
      <form method='POST' action='/api/runs' className='add-form' ref='runForm'>
        <div className='row'>
          <h3>New Run</h3>
          <div className='add-form-input-half'>
            <TextInput label='Tumor BAM URI:' name='tumorBamUri'
                       completions={props.bamUris}
                       placeholder='/data/dream/tumor.chr20.bam' />
          </div>                   
          <div className='add-form-input-half'>
            <TextInput label='Normal BAM URI:' name='normalBamUri'
                       completions={props.bamUris}
                       placeholder='/data/dream/normal.chr20.bam' />
          </div>                 
          <div className='add-form-input-half'>
            <TextInput label='Variant Caller Name:' name='callerName'
                       placeholder='Guacamole::Somatic' />
          </div>                   
          <div className='add-form-input-half'>
            <TextInput label='VCF Path:' name='uri'
                       placeholder='/data/somevcf.vcf'
                       required={true}
                       uploadable={true} uploadPath={'/upload'} />
          </div>
          <input type='hidden' value={this.props.projectName} name='projectName' />
          <div className='form-group add-form-input-full'>
            <label>Notes, Config, Params:</label>
            <textarea className='form-control add-form-notes' rows='8' name='notes'
                      placeholder='Notes, parameters, etc.'></textarea>
          </div>
          <div className='form-group add-form-input-full'>
            <button type='submit' className='btn btn-success btn-block'>Submit New Run</button>
          </div>
        </div>
      </form>
    );
  }
});

var NewBAMForm = React.createClass({
  propTypes: {
    projectName: React.PropTypes.string.isRequired
  },
  componentDidMount: function() {
    ajaxifyForm(this.refs.bamForm.getDOMNode());
  },
  render: function() {
    return (
      <form method='POST' action='/api/bams' className='add-form' ref='bamForm'>
        <div className='row'>
          <h3>New BAM</h3>
          <div className='add-form-input-half'>
            <TextInput label='Name:' name='name' required={true}
                       placeholder='...' />
          </div>
          <div className='add-form-input-half'>
            <TextInput label='Tissues:' name='tissues'
                       placeholder='Left Ovary' />
          </div>
          <div className='add-form-input-half'>
            <TextInput label='Resection Date:' name='resectionDate'
                       placeholder='2015-08-14' />
          </div>
          <div className='add-form-input-half'>
            <TextInput label='BAM URI:' name='uri'
                       required={true}
                       placeholder='hdfs:///data/somebam.bam' />
          </div>

          <input type='hidden' value={this.props.projectName} name='projectName' />
          <div className='form-group add-form-input-full'>
            <label>Notes:</label>
            <textarea className='form-control add-form-notes' rows='8' name='notes'
                      placeholder='Notes on the procedure, sample, alignment, etc.'></textarea>
          </div>
          <div className='form-group add-form-input-full'>
            <button type='submit' className='btn btn-success btn-block'>Submit New BAM</button>
          </div>
        </div>
      </form>
    );
  }
});

var NewProjectForm = React.createClass({
  propTypes: {
    handleClose: React.PropTypes.func.isRequired,
  },
  componentDidMount: function() {
    ajaxifyForm(this.refs.projectForm.getDOMNode());
  },
  render: function() {
    return (
      <form method='POST' action='/api/projects' className='add-form' ref='projectForm'>
        <div className='row'>
          <h3>New Project
            <button className='close' type='button'
            onClick={this.props.handleClose}>&times;</button>
          </h3>
            <div className='add-form-input-full'>
              <TextInput label='Project Name:' name='name' placeholder='PT01234' required={true} />
            </div>
            <div className='form-group add-form-input-full'>
              <label>Notes</label>
              <textarea className='form-control add-form-notes' rows='3' name='notes'
                        placeholder='Notes etc.'></textarea>
            </div>
            <div className='form-group add-form-input-full'>
              <button type='submit' className='btn btn-success btn-block'>Submit New Project</button>
            </div>
        </div>
      </form>
    );
  }
});

var TextInput = React.createClass({
  propTypes: {
    label: React.PropTypes.string.isRequired,
    name: React.PropTypes.string.isRequired,
    placeholder: React.PropTypes.string.isRequired,
    uploadable: React.PropTypes.bool,
    handleDrop: React.PropTypes.func,
    completions: React.PropTypes.arrayOf(React.PropTypes.string),
    required: React.PropTypes.bool
  },
  getInitialState: function() {
    return {receivingDrag: false};
  },
  componentDidMount: function(prevProps, prevState) {
    var $input = $(this.refs.input.getDOMNode());
    if (this.props.completions) {
      $input
        .typeahead({
          highlight: true
        }, {
          name: 'data',
          source: this.queryMatcher(this.props.completions)
        });
    }
  },
  queryMatcher: function(strings) {
    return function(q, callback) {
      var re = new RegExp(q, 'i');
      callback(_.filter(strings, s => re.test(s)).map(value => ({value})));
    };
  },
  handleDragOver: function() {
    if (this.props.uploadable) {
      this.setState({receivingDrag: true});
    }
  },
  handleDragLeave: function() {
    if (this.props.uploadable) {
      this.setState({receivingDrag: false});
    }
  },
  handleDrop: function(evt) {
    if (this.props.uploadable) {
      evt.preventDefault();
      if (this.props.handleDrop) {
        this.props.handleDrop();
      }
      if (this.handleDragLeave) {
        this.handleDragLeave();
      }
      var files = evt.dataTransfer.files;
      if (files.length === 0) return;
      if (files.length > 1) {
        window.alert('You may only upload one file at a time.');
      } else {
        this._upload(files[0], this.refs.input.getDOMNode());
      }
    }
  },
  _extractError: function(response) {
    // Extract an error message from an XMLHttpRequest response
    var json;
    try {
      json = JSON.parse(response.responseText);
    } catch(e) {
      return 'Upload failed.';
    }
    return json.message || json.error || 'Upload failed.';
  },
  _upload: function(file, fileInputElement) {
    // Upload the file and place its path in the element.
    fileInputElement.value = '…uploading…';

    var formData = new FormData();
    formData.append('file', file);

    d3.text(this.props.uploadPath)
      .post(formData)
      .on('load', path => {
        fileInputElement.value = path;
      })
      .on('error', error => {
        fileInputElement.value = this._extractError(error);
        throw error;
      })
      .on('progress', () => {
        var e = d3.event;
        if (e.lengthComputable) {
          fileInputElement.value = 'Uploaded ' + e.loaded + '/' + e.total + ' bytes';
        }
      });
  },
  render: function() {
    var formClasses = React.addons.classSet({
      uploadable: this.props.uploadable,
      'receiving-drag': this.state.receivingDrag,
      'form-control': true
    });
    var divClasses = React.addons.classSet({required: this.props.required,
                                            'form-group': true});
    return (
        <div className={divClasses}>
          <label className='control-label'>{this.props.label}</label>
          <input className={formClasses}
                 onDragOver={this.handleDragOver}
                 onDragLeave={this.handleDragLeave}
                 onDrop={this.handleDrop}
                 ref='input'
                 type='text' name={this.props.name}
                 placeholder={this.props.placeholder} />
        </div>
    );
  }
});


module.exports = {NewRunForm, NewBAMForm, NewProjectForm};
