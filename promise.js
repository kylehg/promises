/**
 * The three states a promise can be in.
 * @enum {string}
 */
var State = {
  PENDING: 'pending',
  FULFILLED: 'fulfilled',
  REJECTED: 'rejected'
}

/**
 * Constructor for a new promise, pending by default.
 * @param {function(function(T), function(!Error))=} executor An optional
 *   callback that will be immediately executed to resolve or reject the
 *   promise
 * @constructor
 * @template T
 */
function Promise(executor) {
  /**
   * The promise, exposed for A+ compliance
   * @type {!Promise}
   */
  this.promise = this

  /**
   * The current state of the promise
   * @private {State}
   */
  this._state = State.PENDING

  /**
   * The list of callbacks to call when the promise is fulfilled
   * @private {!Array.<function(T):*>}
   */
  this._onFulfilleds = []

  /**
   * The list of callbacks to call when the promise is rejected
   * @private {!Array.<function(!Error):*>}
   */
  this._onRejecteds = []

  /**
   * The container for resolved value
   * @private {?{VALUE: T}}
   */
  this._valueContainer = null

  /**
   * The container for the rejected reason
   * @private {?{REASON: !Error}}
   */
  this._reasonContainer = null

  // Make the magic happen
  if (typeof executor == 'function') {
    this._execute(executor)
  }
}


/**
 * Resolve the promise with the given value. Does nothing if the promise is
 * already resolved or rejected.
 * @see [Promise resolution procedure](https://promisesaplus.com/#point-45)
 * @param {*} value
 */
Promise.prototype.resolve = function (value) {
  if (this._state != State.PENDING) {
    return this
  }

  // If promise and x refer to the same object, reject promise with a
  // TypeError as the reason
  if (value == this) {
    return this.reject(new TypeError('Cannot resolve a promise with itself'))
  }

  // If x is a promise, adopt its state
  if (value instanceof Promise) {
    return this._adopt(value)
  }

  // Otherwise, if x is an object or function
  if (typeof value == 'function' || typeof value == 'object') {
    try {
      // Let then be x.then
      var then = value.then
    } catch (err) {
      // If retrieving the property x.then results in a thrown exception e,
      // reject promise with e as the reason
      return this.reject(err)
    }

    // If then is a function, call it with x as this, first argument
    // resolvePromise, and second argument rejectPromise
    if (typeof then == 'function') {
      try {
        then.call(value, this.resolve.bind(this), this.reject.bind(this))
      } catch (err) {
        // If calling then throws an exception e, reject promise with e as
        // the reason
        this.reject(err)
      }
      return this
    }
  }

  // If then is not a function, or if x is not an object or function,
  // fulfill promise with x
  this._state = State.FULFILLED
  this._setValue(value)
  this._callSuccessFunctions(value)

  return this
}

/**
 * Reject the promise with the given reason. Does nothing if the promise is
 * already resolved or rejected.
 * @param {!Error} reason
 */
Promise.prototype.reject = function (reason) {
  if (this._state != State.PENDING) {
    return this
  }

  this._state = State.REJECTED
  this._setReason(reason)
  this._callFailureFunctions(reason)

  return this
}

/**
 * Add a success and failure callback to the promise and return a new promise
 * that will resolve to the result of the callbacks.
 * @param {?function(this:void, T):R} onFulfilled
 * @param {?function(this:void, !Error):R} onRejected
 * @return {!Promise.<R>} A new promise resolved to the return value of the
 *   called handler.
 * @template R
 */
Promise.prototype.then = function (onFulfilled, onRejected) {
  var newPromise = new Promise()
  var oldPromise = this

  var onFulfilledWrapper = function onFulfilledWrapper(value) {
    if (typeof onFulfilled == 'function') {
      try {
        var result = onFulfilled(value)
      } catch (err) {
        newPromise.reject(err)
        return
      }
      newPromise.resolve(result)
    } else {
      newPromise.resolve(oldPromise._getValue())
    }
  }

  // If the promise is pending, add onFulfilled to the success callbacks
  if (this._state == State.PENDING) {
    this._onFulfilleds.push(onFulfilledWrapper)

  // If the promise is already fulfilled, call the success callback
  // immediately with the value
  } else if (this._state == State.FULFILLED) {
    executeHandler(onFulfilledWrapper, this._getValue())
  }

  var onRejectedWrapper = function onRejectedWrapper(reason) {
    if (typeof onRejected == 'function') {
      try {
        var result = onRejected(reason)
      } catch (err) {
        newPromise.reject(err)
        return
      }
      newPromise.resolve(result)
    } else {
      newPromise.reject(reason)
    }
  }

  // If the promise is pending, add onRejected to the reject callbacks
  if (this._state == State.PENDING) {
    this._onRejecteds.push(onRejectedWrapper)

  // If the promise is already rejected, call the rejection callback
  // immediately with the reason
  } else if (this._state == State.REJECTED) {
    executeHandler(onRejectedWrapper, this._getReason())
  }

  return newPromise
}

/**
 * Add a failure callback to the promise and return a new promise that will
 * resolve to the result of the callback.
 * @param {?function(this:void, !Error):R} onRejected
 * @return {!Promise.<R>} A new promsie resolved to the return value of the
 *   called handler.
 * @template R
 */
Promise.prototype.catch = function (onRejected) {
  return this.then(null, onRejected)
}

/**
 * Execute the executor supplied to the promise constructor
 * @param {function(function(T), function(Error))} executor
 * @private
 */
Promise.prototype._execute = function (executor) {
  try {
    executor(this.resolve.bind(this), this.reject.bind(this))
  } catch (err) {
    this.reject(err)
  }
}

/**
 * Adopt the state of a given promise
 * @param {!Promise}
 * @private
 */
Promise.prototype._adopt = function (promise) {
  // TODO be smarter than this
  promise.then(this.resolve.bind(this), this.reject.bind(this))
}

/**
 * Set the resolved value of the promise
 * @param {*} value
 * @private
 */
Promise.prototype._setValue = function (value) {
  if (this._valueContainer != null) {
    throw new Error('Cannot set promise value twice')
  }

  this._valueContainer = {VALUE: value}
}

/**
 * Get the resolved value of the promise
 * @return {*}
 * @private
 */
Promise.prototype._getValue = function () {
  if (this._valueContainer == null) {
    throw new Error('Cannot get promise value that has not been set')
  }

  return this._valueContainer.VALUE
}

/**
 * Set the rejected reason of the promise
 * @param {!Error} reason
 * @private
 */
Promise.prototype._setReason = function (reason) {
  if (this._reasonContainer != null) {
    throw new Error('Cannot set promise rejection reason twice')
  }

  this._reasonContainer = {REASON: reason}
}

/**
 * Get the rejected reason of the promise
 * @return {!Error}
 * @private
 */
Promise.prototype._getReason = function () {
  if (this._reasonContainer == null) {
    throw new Error('Cannot get promise rejection reason that has not been set')
  }

  return this._reasonContainer.REASON
}

/**
 * Call the queued success functions with the resolved value
 * @param {T} value
 * @private
 */
Promise.prototype._callSuccessFunctions = function (value) {
  this._onFulfilleds.forEach(function (onFulfilled) {
    executeHandler(onFulfilled, value)
  })
}

/**
 * Call the queued failure functions with the rejected reason
 * @param {!Error} reason
 * @private
 */
Promise.prototype._callFailureFunctions = function (reason) {
  this._onRejecteds.forEach(function (onRejected) {
    executeHandler(onRejected, reason)
  })
}

/**
 * Return a promise resolved to the given value
 * @param {T} value
 * @return {!Promise.<T>}
 * @static
 */
Promise.resolve = function (value) {
  var promise = new Promise()
  promise.resolve(value)
  return promise
}

/**
 * Return a promise rejected with the given reason
 * @param {!Error} reason
 * @return {!Promise}
 * @static
 */
Promise.reject = function (reason) {
  var promise = new Promise()
  promise.reject(reason)
  return promise
}

/**
 * Given an array of promises, resolve them all into a single promise of the
 * array of resulting values.
 * @param {!Array.<!Promise>} iterable
 * @return {!Promise.<Array>}
 * @static
 */
Promise.all = function (iterable) {
  var result = new Promise()
  var promisesLeft = iterable.length
  var resultArr = new Array(promisesLeft)

  iterable.forEach(function (promise, i) {
    promise.then(function (value) {
      resultArr[i] = value
      promisesLeft--

      if (promisesLeft == 0) {
        result.resolve(resultArr)
      }
    }, function (reason) {
      result.reject(reason)
    })
  })

  return result
}

/**
 * Given an array of promises, return a promise resolved with the first value
 * to reserve.
 * @param {!Array.<!Promise>} iterable
 * @return {!Promise}
 * @static
 */
Promise.race = function (iterable) {
  var winner = new Promise()
  var finished = false

  iterable.forEach(function (promise) {
    promise.then(function (value) {
      if (finished) return

      finished = true
      winner.resolve(value)
    }, function (reason) {
      if (finished) return

      finished = true
      winner.reject(reason)
    })
  })

  return winner
}

function executeHandler(fn, arg) {
  var boundFn = fn.bind(null, arg)
  setTimeout(boundFn, 0)
}

module.exports = Promise
