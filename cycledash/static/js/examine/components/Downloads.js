'use strict';
var React = require('react');

var Downloads = React.createClass({
  propTypes: {
    query: React.PropTypes.object
  },
  render: function() {
    var jsonQuery = encodeURIComponent(JSON.stringify(this.props.query)),
        link = `/runs/${this.props.run_id}/download?query=${jsonQuery}`;
    return <a className='download-vcf' href={link}>Download VCF</a>;
  }
});

module.exports = Downloads;
