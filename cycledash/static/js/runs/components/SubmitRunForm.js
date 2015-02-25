'use strict';
var React = require('react'),
    d3 = require('d3');


var SubmitRunForm = React.createClass({
  propTypes: {
    handleClose: React.PropTypes.func.isRequired,
    handleDrop: React.PropTypes.func
  },
  render: function() {
    return (
      <form method='POST' action='/runs' role='form' id='submit'>
        <h2>
        <button type='button'
                className='close' aria-hidden='true'
                onClick={this.props.handleClose}>&times;</button>
        </h2>

        <TextInput label='Variant Caller Name:' name='variantCallerName'
                   placeholder='Guacamole::Somatic' />
        <TextInput label='Dataset Name:' name='dataset'
                   placeholder='DREAM training chr20' />
        <TextInput label='Project:' name='projectName'
                   placeholder='PT123' />
        <TextInput label='VCF Path:' name='vcfPath'
                   placeholder='/data/somevcf.vcf'
                   uploadable={true} handleDrop={this.props.handleDrop} />
        <TextInput label='Truth VCF Path:' name='truthVcfPath'
                   placeholder='/data/truth_somevcf.vcf'
                   uploadable={true} handleDrop={this.props.handleDrop} />
        <TextInput label='Tumor BAM:' name='tumorPath'
                   placeholder='/data/dream/tumor.chr20.bam' />
        <TextInput label='Normal BAM:' name='normalPath'
                   placeholder='/data/dream/normal.chr20.bam' />
        <div className='form-group'>
          <label>Notes, Config, Params:</label>
          <textarea className='form-control' rows='3' name='params'
                    placeholder='command line parameters here'></textarea>
        </div>

        <button type='submit' className='btn btn-success btn-block'>Submit New Run</button>
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
    handleDrop: React.PropTypes.func
  },
  getInitialState: function() {
    return {receivingDrag: false};
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
      this.props.handleDrop();
      this.handleDragLeave();
      var files = evt.dataTransfer.files;
      if (files.length === 0) return;
      if (files.length > 1) {
        window.alert('You may only upload one file at a time.');
      } else {
        this._upload(files[0], this.refs.input.getDOMNode());
      }
    };
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

    d3.text('/upload')
      .post(formData)
      .on('load', function(path) {
        fileInputElement.value = path;
      })
      .on('error', function(error) {
        console.error(error);
        fileInputElement.value = this._extractError(error);
      })
      .on('progress', function() {
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
    return (
        <div className='form-group'>
          <label>{this.props.label}</label>
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


module.exports = SubmitRunForm;
