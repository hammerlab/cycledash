'use strict';
var d3 = require('d3');

window.activateRunsUI = function() {
  d3.selectAll('tr.run')
    .on('click', function(d, i) {
      // Ignore clicks on links in the row.
      var tag = d3.event.target.tagName;
      if (tag == 'A' || tag == 'INPUT') return;

      var selected = d3.select(this).attr('data-selected');
      var $this = d3.select(this);
      if (selected == 'true') {
        $this.attr('data-selected', false)
            .attr('class', 'run');
        d3.select($this.node().nextElementSibling)
            .style('display', 'none');
        } else {
          $this.attr('data-selected', true)
              .attr('class', 'run selected');
          d3.select($this.node().nextElementSibling)
              .style('display', 'table-row');
        }
    });

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
};
