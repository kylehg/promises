'use strict';

var assert = require('assert')
var adapter = require('./adapter')

var resolved = adapter.resolved
var rejected = adapter.rejected
var deferred = adapter.deferred

var dummy = { dummy: 'dummy' } // we fulfill or reject with this when we don't intend to test against it
var sentinel = { sentinel: 'sentinel' } // a sentinel fulfillment value to test for with strict equality
var other = { other: 'other' } // a value we don't want to be strict equal to
var sentinelArray = [sentinel] // a sentinel fulfillment value to test when we need an array

function xFactory() {
  var d = deferred()
  setTimeout(function () {
    d.resolve(sentinel)
  }, 50)

  return {
    then: function (resolvePromise) {
      resolvePromise(d.promise)
      throw other
    }
  }
}

function test() {
  var promise = resolved(dummy).then(function onBasePromiseFulfilled() {
    return xFactory()
  })

  promise.then(function (value) {
    assert.strictEqual(reason, sentinel)
    console.log('Success')
    process.exit(0)
  })
}


// Main
test()

setTimeout(function () {
  console.log('Timed out')
  process.exit(1)
})
