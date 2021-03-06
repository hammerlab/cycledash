'use strict';
var _ = require('underscore'),
    fs = require('fs'),
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

  var handleCommentPath = function(path, type, data, callback, failCallback) {
    if (isFailingPath(type, path, failingPaths)) {
      failCallback();
    } else {
      if (type === 'GET') {
        var commentResponse = getCommentResponse(commentDatabase);
        callback(commentResponse);
      } else if (type === 'POST') {
        var newCommentId = getMaxAttribute(commentDatabase, 'id') + 1,
            newLastModified = 1; // We are not currently testing last_modified.
        commentDatabase[newCommentId] = _.extend({}, data, {
          vcfId: 1,
          id: newCommentId,
          lastModified: newLastModified
        });
        callback({
          id: newCommentId,
          lastModified: newLastModified
        });
      } else if (type === 'PUT') {
        var id = getCommentIdFromPath(path);
        var newLastModified = 1; // We are not currently testing last_modified.
        commentDatabase[id].commentText = data.commentText;
        commentDatabase[id].lastModified = newLastModified;
        callback({
          lastModified: newLastModified
        });
      } else if (type === 'DELETE') {
        var commentId = getCommentIdFromPath(path);
        delete commentDatabase[commentId];
      }
    }
  };

  var fakeServer = DataUtils.makeFakeServer(vcfPath, handleCommentPath);

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

function getRowKey(comment) {
  return [comment.contig,
          comment.position,
          comment.reference,
          comment.alternates,
          comment.sampleName].join(':');
}

// We represent the database of comments as an object keyed by comment ID,
// however our HTTP GET response needs to key comments by row key (as is
// done in comments.py).
function getCommentResponse(commentDatabase) {
  return {comments: _.groupBy(commentDatabase, getRowKey)};
}

function isFailingPath(type, path, failingPaths) {
  return _.has(failingPaths, type) &&
         _.contains(failingPaths[type], path);
}

module.exports = {
  makeFakeCommentServer
};
