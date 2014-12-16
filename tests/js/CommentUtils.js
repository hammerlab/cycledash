'use strict';
var _ = require('underscore'),
    fs = require('fs'),
    vcf = require('vcf.js'),
    Utils = require('./Utils'),
    DataUtils = require('./DataUtils');

/**
 * Fake for jQuery's $.ajax() which uses DataUtils.makeFakeServer(...) to
 * respond to requests for these URLs:
 *  - /runs/1/genotypes
 *  - /runs/1/comments
 *  - /runs/1/comments/<ID>
 *
 * Accepts a failingPaths dictionary, in the form of:
 *   {<TYPE>: [<PATH>, <PATH>, ...]}.
 * where TYPE is the request type (GET/POST/etc.) and PATH is something like
 * '/runs/1/comments'. All together, {POST: ['/runs/1/comments']} means a POST
 * request to that path should fail.
 */
function makeFakeCommentServer(vcfPath, commentDatabaseJSONPath, failingPaths) {
  var commentDatabase = JSON.parse(
      fs.readFileSync(commentDatabaseJSONPath, {encoding:'utf8'}));

  var commentsResponse = function(path, type, data, callback, failCallback) {
    if (isFailingPath(type, path, failingPaths)) {
      failCallback();
    } else {
      if (type === 'GET') {
        var commentResponse = getCommentResponse(commentDatabase);
        callback(commentResponse);
      } else if (type === 'POST') {
        var newCommentId = getMaxAttribute(commentDatabase, 'id') + 1,
            newLastModifiedUs = getMaxAttribute(
              commentDatabase, 'last_modified_us') + 1;
        commentDatabase[newCommentId] = _.extend({}, data, {
          vcf_id: 1,
          id: newCommentId,
          last_modified_us: newLastModifiedUs
        });
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
  };

  var fakeServer = DataUtils.makeFakeServer(vcfPath, commentsResponse);

  // Include references to the underlying data in case it's helpful.
  return _.extend(fakeServer, {commentDatabase});
}

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

  return {comments: _.object(_.map(commentDatabase, c => [getRowKey(c), c]))};
}

function isFailingPath(type, path, failingPaths) {
  return _.has(failingPaths, type) &&
         _.contains(failingPaths[type], path);
}

module.exports = {
  makeFakeCommentServer
};
