var React = require('react/addons')
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


module.exports = {
  PositionType: PositionType
};
