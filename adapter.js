var Promise = require('./promise')

exports.resolved = function (value) {
  return Promise.resolve(value)
}

exports.rejected = function (reason) {
  return Promise.reject(reason)
}

exports.deferred = function () {
  var promise = new Promise()
  return promise
}
