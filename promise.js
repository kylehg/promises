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
   * @type {Promise}
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
    return
  }

  // If promise and x refer to the same object, reject promise with a
  // TypeError as the reason
  if (value == this) {
    this.reject(new TypeError('Cannot resolve a promise with itself'))
    return
  }

  // If x is a promise, adopt its state
  if (value instanceof Promise) {
    this._adopt(value)
    return
  }

  // Otherwise, if x is an object or function
  if (typeof value == 'function' || typeof value == 'object') {
    try {
      // Let then be x.then
      var then = value.then
    } catch (err) {
      // If retrieving the property x.then results in a thrown exception e,
      // reject promise with e as the reason
      this.reject(err)
      return
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
    }
    return
  }

  // If then is not a function, or if x is not an object or function,
  // fulfill promise with x
  this._state = State.FULFILLED
  this._setValue(value)
  this._callSuccessFunctions(value)
}

/**
 * Reject the promise with the given reason. Does nothing if the promise is
 * already resolved or rejected.
 * @param {!Error} reason
 */
Promise.prototype.reject = function (reason) {
  if (this._state != State.PENDING) {
    return
  }

  this._state = State.REJECTED
  this._setReason(reason)
  this._callFailureFunctions(reason)
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
  return new Promise(function executor(resolve, reject) {

    // Wrap a .then handler in a function that calls it and resolves the new
    // promise with its result (or rejects it with the error as the reason)
    function makeWrapper(onComplete) {
      return function onCompleteWrapper(value) {
        try {
          var result = onComplete(value)
        } catch (err) {
          reject(err)
          return
        }
        resolve(result)
      }
    }

    if (typeof onFulfilled == 'function') {
      var onFulfilledWrapper = makeWrapper(onFulfilled)

      // If the promise is pending, add onFulfilled to the success callbacks
      if (this._state == State.PENDING) {
        this._onFulfilleds.push(onFulfilledWrapper)

      // If the promise is already fulfilled, call the success callback
      // immediately with the value
      } else if (this._state == State.FULFILLED) {
        onFulfilledWrapper(this._getValue())
      }

    // If the onFulfilled handler isn't a function but the promise is already
    // fulfilled, resolve the new promise with the current promise's value
    } else if (this._state == State.FULFILLED) {
      resolve(this._getValue())
    }

    if (typeof onRejected == 'function') {
      var onRejectedWrapper = makeWrapper(onRejected)

      // If the promise is pending, add onRejected to the reject callbacks
      if (this._state == State.PENDING) {
        this._onRejecteds.push(onRejectedWrapper)

      // If the promise is already rejected, call the rejection callback
      // immediately with the reason
      } else if (this._state == State.REJECTED) {
        onRejectedWrapper(this._getReason())
      }

    // If the onRejected handler isn't a function but the promise is already
    // rejected, resolve the new promise with the current promise's value
    } else if (this._state == State.REJECTED) {
      reject(this._getReason())
    }
  })
}

/**
 * Add a failure callback to the promise and return a new promise that will
 * resolve to the result of the callback.
 * @param {?function(this:void, !Error):R} onRejected
 * @return {!Promise.<R>} A new promsie resolved to the return value of the
 *   called handler.
 * @tempalte R
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

  this._reasonContainer.REASON
}

/**
 * Call the queued success functions with the resolved value
 * @param {T} value
 * @private
 */
Promise.prototype._callSuccessFunctions = function (value) {
  this._onFulfilleds.forEach(function (onFulfilled) {
    onFulfilled(value)
  })
}

/**
 * Call the queued failure functions with the rejected reason
 * @param {!Error} reason
 * @private
 */
Promise.prototype._callFailureFunctions = function (reason) {
  this._onRejecteds.forEach(function (onRejected) {
    onRejected(reason)
  })
}

/**
 * Given an array of promises, resolve them all into a single promise of the
 * array of resulting values.
 * @param {!Array.<!Promise>} iterable
 * @return {!Promise.<Array>}
 * @static
 */
Promise.all = function (iterable) {
  return new Promise(function (resolve, reject) {
    var promisesLeft = iterable.length
    var resultArr = new Array(promisesLeft)

    iterable.forEach(function (promise, i) {
      promise.then(function (value) {
        resultArr[i] = value
        promisesLeft--

        if (promisesLeft == 0) {
          resolve(resultArr)
        }
      }, function (reason) {
        reject(reason)
      })
    })
  })
}

/**
 * Given an array of promises, return a promise resolved with the first value
 * to reserve.
 * @param {!Array.<!Promise>} iterable
 * @return {!Promise}
 * @static
 */
Promise.race = function (iterable) {
  return new Promise(function (resolve, reject) {
    var finished = false

    iterable.forEach(function (promise) {
      promise.then(function (value) {
        if (finished) {
          return
        }

        finished = true
        resolve(value)
      }, function (reason) {
        if (finished) {
          return
        }

        finished = true
        reject(reason)
      })
    })
  })
}

/**
 * Return a promise rejected with the given reason
 * @param {!Error} reason
 * @return {!Promise}
 * @static
 */
Promise.reject = function (reason) {
  return new Promise().reject(reason)
}

/**
 * Return a promise resolved to the given value
 * @param {T} value
 * @return {!Promise.<T>}
 * @static
 */
Promise.resolve = function (value) {
  return new Promise().resolve(value)
}

module.exports = Promise
