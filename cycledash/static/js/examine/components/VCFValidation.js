// Provides a ComboBox for choosing a VCF to compare against the current VCF
// being examined.
"use strict";


var React = require('react');

var VCFValidation = React.createClass({
  propTypes: {
    vcfs: React.PropTypes.arrayOf(React.PropTypes.object).isRequired,
    compareToVcfId: React.PropTypes.number,
    handleComparisonVcfChange: React.PropTypes.func.isRequired
  },
  handleSelect: function(evt) {
    this.props.handleComparisonVcfChange(parseInt(evt.target.value, 10));
  },
  render: function() {
    var vcfs = [{id: null, uri: 'Compare to...'}].concat(this.props.vcfs)
        .map(v => <option value={v.id} key={v.uri}>{v.uri}</option>);
    return (
      <div className='vcf-validations'>
        <select onChange={this.handleSelect} value={this.props.compareToVcfId}>
          {vcfs}
        </select>
      </div>
    );
  }
});

module.exports = VCFValidation;
