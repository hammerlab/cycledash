"use strict";

var React = require('react');

var VCFValidation = React.createClass({
  propTypes: {
    vcfs: React.PropTypes.arrayOf(React.PropTypes.object).isRequired,
    selectedVcfId: React.PropTypes.number,
    handleValidationVcfChange: React.PropTypes.func.isRequired
  },
  handleSelect: function(evt) {
    this.props.handleValidationVcfChange(evt.target.value);
  },
  render: function() {
    var vcfs = [{id: null, uri: '---'}].concat(
      this.props.vcfs).map(
        v => <option value={v.id} key={v.uri}>{v.uri}</option>);
    return (
      <div id='vcf-validations'>
        Validate against:
        <select onChange={this.handleSelect}
                value={this.props.selectedVcfId}>
          {vcfs}
        </select>
      </div>
    );
  }
});

module.exports = VCFValidation;
