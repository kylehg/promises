var Promise = require('./promise')

exports.resolved = Promise.resolve

exports.rejected = Promise.reject

exports.deferred = function () {
  return new Promise()
}
