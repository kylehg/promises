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

function test() {
  var promise = resolved(dummy).then(function onBasePromiseFulfilled() {
    var d = deferred()
    d.name = 'd'
    setTimeout(function () {
      console.log('Resolving delayed promise')
      d.resolve(sentinel)
    }, 50)

    return {
      name: 'fake thennable',
      then: function (resolvePromise) {
        console.log('Calling fake thennable')
        resolvePromise(d.promise)
        throw other
      }
    }
  })

  promise.then(function (value) {
    assert.strictEqual(value, sentinel)
    console.log('SUCCESS')
    process.exit(0)
  })
}


// Main
test()

setTimeout(function () {
  console.log('TIMED OUT')
  process.exit(1)
}, 1000)
