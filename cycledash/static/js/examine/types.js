/** @jsx */
'use strict';
var React = require('react/addons'),
    idiogrammatik = require('idiogrammatik.js');

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
    React.PropTypes.instanceOf(idiogrammatik.ALL_CHROMOSOMES)
  ])
}).isRequired;

// Sentinel value for filtering on ref/alt
var REF_ALT_PATH = [null];

// Sentinel value to indicate no chromosome restriction
var ALL_CHROMOSOMES = null;

module.exports = {
  PositionType,
  REF_ALT_PATH,
  ALL_CHROMOSOMES
};
