'use strict';
var d3 = require('d3');

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
