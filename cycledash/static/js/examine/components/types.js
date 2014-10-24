/** @jsx */
'use strict';
var React = require('react/addons');


// Sentinel value to indicate no chromosome restriction
var ALL_CHROMOSOMES = null;

var PositionType = React.PropTypes.shape({
  start: React.PropTypes.oneOfType([
    React.PropTypes.number,
    React.PropTypes.instanceOf(null)
  ]),
  end: React.PropTypes.oneOfType([
    React.PropTypes.number,
    React.PropTypes.instanceOf(null)
  ]),
  chromosome: React.PropTypes.oneOfType([
    React.PropTypes.string,
    React.PropTypes.instanceOf(ALL_CHROMOSOMES)
  ])
}).isRequired;

module.exports = {
  PositionType,
  ALL_CHROMOSOMES
};
