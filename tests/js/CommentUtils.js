'use strict';
var _ = require('underscore'),
    fs = require('fs'),
    vcf = require('vcf.js'),
    Utils = require('./Utils'),
    dataUtils = require('./DataUtils');

/**
* Fake for jQuery's $.ajax() which responds to requests for these URLs
* using JS objects.
*  - /runs/1/genotypes
*  - /runs/1/comments
*  - /runs/1/comments/<ID>
*
* Accepts a failingPaths dictionary, in the form of:
*   {<TYPE>: [<PATH>, <PATH>, ...]}.
*/
function makeFakeCommentServer(vcfPath, commentDatabaseJSONPath, failingPaths) {
  var parseVcf = vcf.parser(),
      vcfData = parseVcf(fs.readFileSync(vcfPath, {encoding:'utf8'})),
      spec = dataUtils.getSpec(vcfData),
      contigs = dataUtils.getContigs(vcfData),
      records = dataUtils.getRecords(vcfData),
      commentDatabase = JSON.parse(
        fs.readFileSync(commentDatabaseJSONPath, {encoding:'utf8'}));

  var genotypesUrl = '/runs/1/genotypes';
  var commentsUrl = '/runs/1/comments';

  var ajax = function(path, type, data, callback, failCallback) {
    function getMaxAttribute(comments, attribute) {
      return _.max(_.map(comments, function(comment, key) {
        return comment[attribute];
      }));
    }

    function getCommentIdFromPath(path) {
      var pathParts = path.split('/');
      return pathParts[pathParts.length - 1];
    }

    // We represent the database of comments as an object keyed by comment ID,
    // however our HTTP GET response needs to key comments by row key (as is
    // done in comments.py).
    function getCommentResponse(commentDatabase) {
      function getRowKey(commentOrRecord) {
        return commentOrRecord.contig +
               commentOrRecord.position +
               commentOrRecord.reference +
               commentOrRecord.alternates +
               commentOrRecord.sample_name;
      }

      var keyMapped = _.object(_.map(commentDatabase, function(comment, key) {
        return [getRowKey(comment), comment];
      }));
      return {comments: keyMapped};
    }

    function isFailingPath(type, path) {
      return _.has(failingPaths, type) &&
             _.indexOf(failingPaths[type], path) !== -1;
    }

    if (path.slice(0, genotypesUrl.length) === genotypesUrl) {
      callback({
        records: records,
        stats: {
          totalRecords: records.length,
          totalUnfilteredRecords: records.length
        }
      });
    } else if (path.slice(0, commentsUrl.length) === commentsUrl) {
      if (isFailingPath(type, path)) {
        failCallback();
      } else {
        if (type === 'GET') {
          var commentResponse = getCommentResponse(commentDatabase);
          callback(commentResponse);
        } else if (type === 'POST') {
          var newCommentId = getMaxAttribute(commentDatabase, 'id') + 1,
              newLastModifiedUs = getMaxAttribute(
                commentDatabase, 'last_modified_us') + 1;
          commentDatabase[newCommentId] = {
            alternates: data.alternates,
            comment_text: data.comment_text,
            contig: data.contig,
            position: data.position,
            reference: data.reference,
            sample_name: data.sample_name,
            vcf_id: 1,
            id: newCommentId,
            last_modified_us: newLastModifiedUs
          };
          callback({
            comment_id: newCommentId,
            last_modified_us: newLastModifiedUs
          });
        } else if (type === 'PUT') {
          var id = getCommentIdFromPath(path);
          var newLastModifiedUs = getMaxAttribute(
            commentDatabase, 'last_modified_us') + 1;
          commentDatabase[id].comment_text = data.comment_text;
          commentDatabase[id].last_modified_us = newLastModifiedUs;
          callback({
            last_modified_us: newLastModifiedUs
          });
        } else if (type === 'DELETE') {
          var commentId = getCommentIdFromPath(path);
          delete commentDatabase[commentId];
        }
      }
    } else {
      throw new Error('Unexpected request for ' + path);
    }
  };

  // Include references to the underlying data in case it's helpful.
  _.extend(ajax, {spec, contigs, records, commentDatabase});

  return ajax;
}

module.exports = {
  makeFakeCommentServer
};
