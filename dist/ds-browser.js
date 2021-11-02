(function(f){if(typeof exports==="object"&&typeof module!=="undefined"){module.exports=f()}else if(typeof define==="function"&&define.amd){define([],f)}else{var g;if(typeof window!=="undefined"){g=window}else if(typeof global!=="undefined"){g=global}else if(typeof self!=="undefined"){g=self}else{g=this}g.DSBrowser = f()}})(function(){var define,module,exports;return (function(){function r(e,n,t){function o(i,f){if(!n[i]){if(!e[i]){var c="function"==typeof require&&require;if(!f&&c)return c(i,!0);if(u)return u(i,!0);var a=new Error("Cannot find module '"+i+"'");throw a.code="MODULE_NOT_FOUND",a}var p=n[i]={exports:{}};e[i][0].call(p.exports,function(r){var n=e[i][1][r];return o(n||r)},p,p.exports,r,e,n,t)}return n[i].exports}for(var u="function"==typeof require&&require,i=0;i<t.length;i++)o(t[i]);return o}return r})()({1:[function(require,module,exports){
module.exports = require('./lib/axios');
},{"./lib/axios":3}],2:[function(require,module,exports){
'use strict';

var utils = require('./../utils');
var settle = require('./../core/settle');
var cookies = require('./../helpers/cookies');
var buildURL = require('./../helpers/buildURL');
var buildFullPath = require('../core/buildFullPath');
var parseHeaders = require('./../helpers/parseHeaders');
var isURLSameOrigin = require('./../helpers/isURLSameOrigin');
var createError = require('../core/createError');

module.exports = function xhrAdapter(config) {
  return new Promise(function dispatchXhrRequest(resolve, reject) {
    var requestData = config.data;
    var requestHeaders = config.headers;
    var responseType = config.responseType;

    if (utils.isFormData(requestData)) {
      delete requestHeaders['Content-Type']; // Let the browser set it
    }

    var request = new XMLHttpRequest();

    // HTTP basic authentication
    if (config.auth) {
      var username = config.auth.username || '';
      var password = config.auth.password ? unescape(encodeURIComponent(config.auth.password)) : '';
      requestHeaders.Authorization = 'Basic ' + btoa(username + ':' + password);
    }

    var fullPath = buildFullPath(config.baseURL, config.url);
    request.open(config.method.toUpperCase(), buildURL(fullPath, config.params, config.paramsSerializer), true);

    // Set the request timeout in MS
    request.timeout = config.timeout;

    function onloadend() {
      if (!request) {
        return;
      }
      // Prepare the response
      var responseHeaders = 'getAllResponseHeaders' in request ? parseHeaders(request.getAllResponseHeaders()) : null;
      var responseData = !responseType || responseType === 'text' ||  responseType === 'json' ?
        request.responseText : request.response;
      var response = {
        data: responseData,
        status: request.status,
        statusText: request.statusText,
        headers: responseHeaders,
        config: config,
        request: request
      };

      settle(resolve, reject, response);

      // Clean up request
      request = null;
    }

    if ('onloadend' in request) {
      // Use onloadend if available
      request.onloadend = onloadend;
    } else {
      // Listen for ready state to emulate onloadend
      request.onreadystatechange = function handleLoad() {
        if (!request || request.readyState !== 4) {
          return;
        }

        // The request errored out and we didn't get a response, this will be
        // handled by onerror instead
        // With one exception: request that using file: protocol, most browsers
        // will return status as 0 even though it's a successful request
        if (request.status === 0 && !(request.responseURL && request.responseURL.indexOf('file:') === 0)) {
          return;
        }
        // readystate handler is calling before onerror or ontimeout handlers,
        // so we should call onloadend on the next 'tick'
        setTimeout(onloadend);
      };
    }

    // Handle browser request cancellation (as opposed to a manual cancellation)
    request.onabort = function handleAbort() {
      if (!request) {
        return;
      }

      reject(createError('Request aborted', config, 'ECONNABORTED', request));

      // Clean up request
      request = null;
    };

    // Handle low level network errors
    request.onerror = function handleError() {
      // Real errors are hidden from us by the browser
      // onerror should only fire if it's a network error
      reject(createError('Network Error', config, null, request));

      // Clean up request
      request = null;
    };

    // Handle timeout
    request.ontimeout = function handleTimeout() {
      var timeoutErrorMessage = 'timeout of ' + config.timeout + 'ms exceeded';
      if (config.timeoutErrorMessage) {
        timeoutErrorMessage = config.timeoutErrorMessage;
      }
      reject(createError(
        timeoutErrorMessage,
        config,
        config.transitional && config.transitional.clarifyTimeoutError ? 'ETIMEDOUT' : 'ECONNABORTED',
        request));

      // Clean up request
      request = null;
    };

    // Add xsrf header
    // This is only done if running in a standard browser environment.
    // Specifically not if we're in a web worker, or react-native.
    if (utils.isStandardBrowserEnv()) {
      // Add xsrf header
      var xsrfValue = (config.withCredentials || isURLSameOrigin(fullPath)) && config.xsrfCookieName ?
        cookies.read(config.xsrfCookieName) :
        undefined;

      if (xsrfValue) {
        requestHeaders[config.xsrfHeaderName] = xsrfValue;
      }
    }

    // Add headers to the request
    if ('setRequestHeader' in request) {
      utils.forEach(requestHeaders, function setRequestHeader(val, key) {
        if (typeof requestData === 'undefined' && key.toLowerCase() === 'content-type') {
          // Remove Content-Type if data is undefined
          delete requestHeaders[key];
        } else {
          // Otherwise add header to the request
          request.setRequestHeader(key, val);
        }
      });
    }

    // Add withCredentials to request if needed
    if (!utils.isUndefined(config.withCredentials)) {
      request.withCredentials = !!config.withCredentials;
    }

    // Add responseType to request if needed
    if (responseType && responseType !== 'json') {
      request.responseType = config.responseType;
    }

    // Handle progress if needed
    if (typeof config.onDownloadProgress === 'function') {
      request.addEventListener('progress', config.onDownloadProgress);
    }

    // Not all browsers support upload events
    if (typeof config.onUploadProgress === 'function' && request.upload) {
      request.upload.addEventListener('progress', config.onUploadProgress);
    }

    if (config.cancelToken) {
      // Handle cancellation
      config.cancelToken.promise.then(function onCanceled(cancel) {
        if (!request) {
          return;
        }

        request.abort();
        reject(cancel);
        // Clean up request
        request = null;
      });
    }

    if (!requestData) {
      requestData = null;
    }

    // Send the request
    request.send(requestData);
  });
};

},{"../core/buildFullPath":9,"../core/createError":10,"./../core/settle":14,"./../helpers/buildURL":18,"./../helpers/cookies":20,"./../helpers/isURLSameOrigin":23,"./../helpers/parseHeaders":25,"./../utils":28}],3:[function(require,module,exports){
'use strict';

var utils = require('./utils');
var bind = require('./helpers/bind');
var Axios = require('./core/Axios');
var mergeConfig = require('./core/mergeConfig');
var defaults = require('./defaults');

/**
 * Create an instance of Axios
 *
 * @param {Object} defaultConfig The default config for the instance
 * @return {Axios} A new instance of Axios
 */
function createInstance(defaultConfig) {
  var context = new Axios(defaultConfig);
  var instance = bind(Axios.prototype.request, context);

  // Copy axios.prototype to instance
  utils.extend(instance, Axios.prototype, context);

  // Copy context to instance
  utils.extend(instance, context);

  return instance;
}

// Create the default instance to be exported
var axios = createInstance(defaults);

// Expose Axios class to allow class inheritance
axios.Axios = Axios;

// Factory for creating new instances
axios.create = function create(instanceConfig) {
  return createInstance(mergeConfig(axios.defaults, instanceConfig));
};

// Expose Cancel & CancelToken
axios.Cancel = require('./cancel/Cancel');
axios.CancelToken = require('./cancel/CancelToken');
axios.isCancel = require('./cancel/isCancel');

// Expose all/spread
axios.all = function all(promises) {
  return Promise.all(promises);
};
axios.spread = require('./helpers/spread');

// Expose isAxiosError
axios.isAxiosError = require('./helpers/isAxiosError');

module.exports = axios;

// Allow use of default import syntax in TypeScript
module.exports.default = axios;

},{"./cancel/Cancel":4,"./cancel/CancelToken":5,"./cancel/isCancel":6,"./core/Axios":7,"./core/mergeConfig":13,"./defaults":16,"./helpers/bind":17,"./helpers/isAxiosError":22,"./helpers/spread":26,"./utils":28}],4:[function(require,module,exports){
'use strict';

/**
 * A `Cancel` is an object that is thrown when an operation is canceled.
 *
 * @class
 * @param {string=} message The message.
 */
function Cancel(message) {
  this.message = message;
}

Cancel.prototype.toString = function toString() {
  return 'Cancel' + (this.message ? ': ' + this.message : '');
};

Cancel.prototype.__CANCEL__ = true;

module.exports = Cancel;

},{}],5:[function(require,module,exports){
'use strict';

var Cancel = require('./Cancel');

/**
 * A `CancelToken` is an object that can be used to request cancellation of an operation.
 *
 * @class
 * @param {Function} executor The executor function.
 */
function CancelToken(executor) {
  if (typeof executor !== 'function') {
    throw new TypeError('executor must be a function.');
  }

  var resolvePromise;
  this.promise = new Promise(function promiseExecutor(resolve) {
    resolvePromise = resolve;
  });

  var token = this;
  executor(function cancel(message) {
    if (token.reason) {
      // Cancellation has already been requested
      return;
    }

    token.reason = new Cancel(message);
    resolvePromise(token.reason);
  });
}

/**
 * Throws a `Cancel` if cancellation has been requested.
 */
CancelToken.prototype.throwIfRequested = function throwIfRequested() {
  if (this.reason) {
    throw this.reason;
  }
};

/**
 * Returns an object that contains a new `CancelToken` and a function that, when called,
 * cancels the `CancelToken`.
 */
CancelToken.source = function source() {
  var cancel;
  var token = new CancelToken(function executor(c) {
    cancel = c;
  });
  return {
    token: token,
    cancel: cancel
  };
};

module.exports = CancelToken;

},{"./Cancel":4}],6:[function(require,module,exports){
'use strict';

module.exports = function isCancel(value) {
  return !!(value && value.__CANCEL__);
};

},{}],7:[function(require,module,exports){
'use strict';

var utils = require('./../utils');
var buildURL = require('../helpers/buildURL');
var InterceptorManager = require('./InterceptorManager');
var dispatchRequest = require('./dispatchRequest');
var mergeConfig = require('./mergeConfig');
var validator = require('../helpers/validator');

var validators = validator.validators;
/**
 * Create a new instance of Axios
 *
 * @param {Object} instanceConfig The default config for the instance
 */
function Axios(instanceConfig) {
  this.defaults = instanceConfig;
  this.interceptors = {
    request: new InterceptorManager(),
    response: new InterceptorManager()
  };
}

/**
 * Dispatch a request
 *
 * @param {Object} config The config specific for this request (merged with this.defaults)
 */
Axios.prototype.request = function request(config) {
  /*eslint no-param-reassign:0*/
  // Allow for axios('example/url'[, config]) a la fetch API
  if (typeof config === 'string') {
    config = arguments[1] || {};
    config.url = arguments[0];
  } else {
    config = config || {};
  }

  config = mergeConfig(this.defaults, config);

  // Set config.method
  if (config.method) {
    config.method = config.method.toLowerCase();
  } else if (this.defaults.method) {
    config.method = this.defaults.method.toLowerCase();
  } else {
    config.method = 'get';
  }

  var transitional = config.transitional;

  if (transitional !== undefined) {
    validator.assertOptions(transitional, {
      silentJSONParsing: validators.transitional(validators.boolean, '1.0.0'),
      forcedJSONParsing: validators.transitional(validators.boolean, '1.0.0'),
      clarifyTimeoutError: validators.transitional(validators.boolean, '1.0.0')
    }, false);
  }

  // filter out skipped interceptors
  var requestInterceptorChain = [];
  var synchronousRequestInterceptors = true;
  this.interceptors.request.forEach(function unshiftRequestInterceptors(interceptor) {
    if (typeof interceptor.runWhen === 'function' && interceptor.runWhen(config) === false) {
      return;
    }

    synchronousRequestInterceptors = synchronousRequestInterceptors && interceptor.synchronous;

    requestInterceptorChain.unshift(interceptor.fulfilled, interceptor.rejected);
  });

  var responseInterceptorChain = [];
  this.interceptors.response.forEach(function pushResponseInterceptors(interceptor) {
    responseInterceptorChain.push(interceptor.fulfilled, interceptor.rejected);
  });

  var promise;

  if (!synchronousRequestInterceptors) {
    var chain = [dispatchRequest, undefined];

    Array.prototype.unshift.apply(chain, requestInterceptorChain);
    chain = chain.concat(responseInterceptorChain);

    promise = Promise.resolve(config);
    while (chain.length) {
      promise = promise.then(chain.shift(), chain.shift());
    }

    return promise;
  }


  var newConfig = config;
  while (requestInterceptorChain.length) {
    var onFulfilled = requestInterceptorChain.shift();
    var onRejected = requestInterceptorChain.shift();
    try {
      newConfig = onFulfilled(newConfig);
    } catch (error) {
      onRejected(error);
      break;
    }
  }

  try {
    promise = dispatchRequest(newConfig);
  } catch (error) {
    return Promise.reject(error);
  }

  while (responseInterceptorChain.length) {
    promise = promise.then(responseInterceptorChain.shift(), responseInterceptorChain.shift());
  }

  return promise;
};

Axios.prototype.getUri = function getUri(config) {
  config = mergeConfig(this.defaults, config);
  return buildURL(config.url, config.params, config.paramsSerializer).replace(/^\?/, '');
};

// Provide aliases for supported request methods
utils.forEach(['delete', 'get', 'head', 'options'], function forEachMethodNoData(method) {
  /*eslint func-names:0*/
  Axios.prototype[method] = function(url, config) {
    return this.request(mergeConfig(config || {}, {
      method: method,
      url: url,
      data: (config || {}).data
    }));
  };
});

utils.forEach(['post', 'put', 'patch'], function forEachMethodWithData(method) {
  /*eslint func-names:0*/
  Axios.prototype[method] = function(url, data, config) {
    return this.request(mergeConfig(config || {}, {
      method: method,
      url: url,
      data: data
    }));
  };
});

module.exports = Axios;

},{"../helpers/buildURL":18,"../helpers/validator":27,"./../utils":28,"./InterceptorManager":8,"./dispatchRequest":11,"./mergeConfig":13}],8:[function(require,module,exports){
'use strict';

var utils = require('./../utils');

function InterceptorManager() {
  this.handlers = [];
}

/**
 * Add a new interceptor to the stack
 *
 * @param {Function} fulfilled The function to handle `then` for a `Promise`
 * @param {Function} rejected The function to handle `reject` for a `Promise`
 *
 * @return {Number} An ID used to remove interceptor later
 */
InterceptorManager.prototype.use = function use(fulfilled, rejected, options) {
  this.handlers.push({
    fulfilled: fulfilled,
    rejected: rejected,
    synchronous: options ? options.synchronous : false,
    runWhen: options ? options.runWhen : null
  });
  return this.handlers.length - 1;
};

/**
 * Remove an interceptor from the stack
 *
 * @param {Number} id The ID that was returned by `use`
 */
InterceptorManager.prototype.eject = function eject(id) {
  if (this.handlers[id]) {
    this.handlers[id] = null;
  }
};

/**
 * Iterate over all the registered interceptors
 *
 * This method is particularly useful for skipping over any
 * interceptors that may have become `null` calling `eject`.
 *
 * @param {Function} fn The function to call for each interceptor
 */
InterceptorManager.prototype.forEach = function forEach(fn) {
  utils.forEach(this.handlers, function forEachHandler(h) {
    if (h !== null) {
      fn(h);
    }
  });
};

module.exports = InterceptorManager;

},{"./../utils":28}],9:[function(require,module,exports){
'use strict';

var isAbsoluteURL = require('../helpers/isAbsoluteURL');
var combineURLs = require('../helpers/combineURLs');

/**
 * Creates a new URL by combining the baseURL with the requestedURL,
 * only when the requestedURL is not already an absolute URL.
 * If the requestURL is absolute, this function returns the requestedURL untouched.
 *
 * @param {string} baseURL The base URL
 * @param {string} requestedURL Absolute or relative URL to combine
 * @returns {string} The combined full path
 */
module.exports = function buildFullPath(baseURL, requestedURL) {
  if (baseURL && !isAbsoluteURL(requestedURL)) {
    return combineURLs(baseURL, requestedURL);
  }
  return requestedURL;
};

},{"../helpers/combineURLs":19,"../helpers/isAbsoluteURL":21}],10:[function(require,module,exports){
'use strict';

var enhanceError = require('./enhanceError');

/**
 * Create an Error with the specified message, config, error code, request and response.
 *
 * @param {string} message The error message.
 * @param {Object} config The config.
 * @param {string} [code] The error code (for example, 'ECONNABORTED').
 * @param {Object} [request] The request.
 * @param {Object} [response] The response.
 * @returns {Error} The created error.
 */
module.exports = function createError(message, config, code, request, response) {
  var error = new Error(message);
  return enhanceError(error, config, code, request, response);
};

},{"./enhanceError":12}],11:[function(require,module,exports){
'use strict';

var utils = require('./../utils');
var transformData = require('./transformData');
var isCancel = require('../cancel/isCancel');
var defaults = require('../defaults');

/**
 * Throws a `Cancel` if cancellation has been requested.
 */
function throwIfCancellationRequested(config) {
  if (config.cancelToken) {
    config.cancelToken.throwIfRequested();
  }
}

/**
 * Dispatch a request to the server using the configured adapter.
 *
 * @param {object} config The config that is to be used for the request
 * @returns {Promise} The Promise to be fulfilled
 */
module.exports = function dispatchRequest(config) {
  throwIfCancellationRequested(config);

  // Ensure headers exist
  config.headers = config.headers || {};

  // Transform request data
  config.data = transformData.call(
    config,
    config.data,
    config.headers,
    config.transformRequest
  );

  // Flatten headers
  config.headers = utils.merge(
    config.headers.common || {},
    config.headers[config.method] || {},
    config.headers
  );

  utils.forEach(
    ['delete', 'get', 'head', 'post', 'put', 'patch', 'common'],
    function cleanHeaderConfig(method) {
      delete config.headers[method];
    }
  );

  var adapter = config.adapter || defaults.adapter;

  return adapter(config).then(function onAdapterResolution(response) {
    throwIfCancellationRequested(config);

    // Transform response data
    response.data = transformData.call(
      config,
      response.data,
      response.headers,
      config.transformResponse
    );

    return response;
  }, function onAdapterRejection(reason) {
    if (!isCancel(reason)) {
      throwIfCancellationRequested(config);

      // Transform response data
      if (reason && reason.response) {
        reason.response.data = transformData.call(
          config,
          reason.response.data,
          reason.response.headers,
          config.transformResponse
        );
      }
    }

    return Promise.reject(reason);
  });
};

},{"../cancel/isCancel":6,"../defaults":16,"./../utils":28,"./transformData":15}],12:[function(require,module,exports){
'use strict';

/**
 * Update an Error with the specified config, error code, and response.
 *
 * @param {Error} error The error to update.
 * @param {Object} config The config.
 * @param {string} [code] The error code (for example, 'ECONNABORTED').
 * @param {Object} [request] The request.
 * @param {Object} [response] The response.
 * @returns {Error} The error.
 */
module.exports = function enhanceError(error, config, code, request, response) {
  error.config = config;
  if (code) {
    error.code = code;
  }

  error.request = request;
  error.response = response;
  error.isAxiosError = true;

  error.toJSON = function toJSON() {
    return {
      // Standard
      message: this.message,
      name: this.name,
      // Microsoft
      description: this.description,
      number: this.number,
      // Mozilla
      fileName: this.fileName,
      lineNumber: this.lineNumber,
      columnNumber: this.columnNumber,
      stack: this.stack,
      // Axios
      config: this.config,
      code: this.code
    };
  };
  return error;
};

},{}],13:[function(require,module,exports){
'use strict';

var utils = require('../utils');

/**
 * Config-specific merge-function which creates a new config-object
 * by merging two configuration objects together.
 *
 * @param {Object} config1
 * @param {Object} config2
 * @returns {Object} New object resulting from merging config2 to config1
 */
module.exports = function mergeConfig(config1, config2) {
  // eslint-disable-next-line no-param-reassign
  config2 = config2 || {};
  var config = {};

  var valueFromConfig2Keys = ['url', 'method', 'data'];
  var mergeDeepPropertiesKeys = ['headers', 'auth', 'proxy', 'params'];
  var defaultToConfig2Keys = [
    'baseURL', 'transformRequest', 'transformResponse', 'paramsSerializer',
    'timeout', 'timeoutMessage', 'withCredentials', 'adapter', 'responseType', 'xsrfCookieName',
    'xsrfHeaderName', 'onUploadProgress', 'onDownloadProgress', 'decompress',
    'maxContentLength', 'maxBodyLength', 'maxRedirects', 'transport', 'httpAgent',
    'httpsAgent', 'cancelToken', 'socketPath', 'responseEncoding'
  ];
  var directMergeKeys = ['validateStatus'];

  function getMergedValue(target, source) {
    if (utils.isPlainObject(target) && utils.isPlainObject(source)) {
      return utils.merge(target, source);
    } else if (utils.isPlainObject(source)) {
      return utils.merge({}, source);
    } else if (utils.isArray(source)) {
      return source.slice();
    }
    return source;
  }

  function mergeDeepProperties(prop) {
    if (!utils.isUndefined(config2[prop])) {
      config[prop] = getMergedValue(config1[prop], config2[prop]);
    } else if (!utils.isUndefined(config1[prop])) {
      config[prop] = getMergedValue(undefined, config1[prop]);
    }
  }

  utils.forEach(valueFromConfig2Keys, function valueFromConfig2(prop) {
    if (!utils.isUndefined(config2[prop])) {
      config[prop] = getMergedValue(undefined, config2[prop]);
    }
  });

  utils.forEach(mergeDeepPropertiesKeys, mergeDeepProperties);

  utils.forEach(defaultToConfig2Keys, function defaultToConfig2(prop) {
    if (!utils.isUndefined(config2[prop])) {
      config[prop] = getMergedValue(undefined, config2[prop]);
    } else if (!utils.isUndefined(config1[prop])) {
      config[prop] = getMergedValue(undefined, config1[prop]);
    }
  });

  utils.forEach(directMergeKeys, function merge(prop) {
    if (prop in config2) {
      config[prop] = getMergedValue(config1[prop], config2[prop]);
    } else if (prop in config1) {
      config[prop] = getMergedValue(undefined, config1[prop]);
    }
  });

  var axiosKeys = valueFromConfig2Keys
    .concat(mergeDeepPropertiesKeys)
    .concat(defaultToConfig2Keys)
    .concat(directMergeKeys);

  var otherKeys = Object
    .keys(config1)
    .concat(Object.keys(config2))
    .filter(function filterAxiosKeys(key) {
      return axiosKeys.indexOf(key) === -1;
    });

  utils.forEach(otherKeys, mergeDeepProperties);

  return config;
};

},{"../utils":28}],14:[function(require,module,exports){
'use strict';

var createError = require('./createError');

/**
 * Resolve or reject a Promise based on response status.
 *
 * @param {Function} resolve A function that resolves the promise.
 * @param {Function} reject A function that rejects the promise.
 * @param {object} response The response.
 */
module.exports = function settle(resolve, reject, response) {
  var validateStatus = response.config.validateStatus;
  if (!response.status || !validateStatus || validateStatus(response.status)) {
    resolve(response);
  } else {
    reject(createError(
      'Request failed with status code ' + response.status,
      response.config,
      null,
      response.request,
      response
    ));
  }
};

},{"./createError":10}],15:[function(require,module,exports){
'use strict';

var utils = require('./../utils');
var defaults = require('./../defaults');

/**
 * Transform the data for a request or a response
 *
 * @param {Object|String} data The data to be transformed
 * @param {Array} headers The headers for the request or response
 * @param {Array|Function} fns A single function or Array of functions
 * @returns {*} The resulting transformed data
 */
module.exports = function transformData(data, headers, fns) {
  var context = this || defaults;
  /*eslint no-param-reassign:0*/
  utils.forEach(fns, function transform(fn) {
    data = fn.call(context, data, headers);
  });

  return data;
};

},{"./../defaults":16,"./../utils":28}],16:[function(require,module,exports){
(function (process){(function (){
'use strict';

var utils = require('./utils');
var normalizeHeaderName = require('./helpers/normalizeHeaderName');
var enhanceError = require('./core/enhanceError');

var DEFAULT_CONTENT_TYPE = {
  'Content-Type': 'application/x-www-form-urlencoded'
};

function setContentTypeIfUnset(headers, value) {
  if (!utils.isUndefined(headers) && utils.isUndefined(headers['Content-Type'])) {
    headers['Content-Type'] = value;
  }
}

function getDefaultAdapter() {
  var adapter;
  if (typeof XMLHttpRequest !== 'undefined') {
    // For browsers use XHR adapter
    adapter = require('./adapters/xhr');
  } else if (typeof process !== 'undefined' && Object.prototype.toString.call(process) === '[object process]') {
    // For node use HTTP adapter
    adapter = require('./adapters/http');
  }
  return adapter;
}

function stringifySafely(rawValue, parser, encoder) {
  if (utils.isString(rawValue)) {
    try {
      (parser || JSON.parse)(rawValue);
      return utils.trim(rawValue);
    } catch (e) {
      if (e.name !== 'SyntaxError') {
        throw e;
      }
    }
  }

  return (encoder || JSON.stringify)(rawValue);
}

var defaults = {

  transitional: {
    silentJSONParsing: true,
    forcedJSONParsing: true,
    clarifyTimeoutError: false
  },

  adapter: getDefaultAdapter(),

  transformRequest: [function transformRequest(data, headers) {
    normalizeHeaderName(headers, 'Accept');
    normalizeHeaderName(headers, 'Content-Type');

    if (utils.isFormData(data) ||
      utils.isArrayBuffer(data) ||
      utils.isBuffer(data) ||
      utils.isStream(data) ||
      utils.isFile(data) ||
      utils.isBlob(data)
    ) {
      return data;
    }
    if (utils.isArrayBufferView(data)) {
      return data.buffer;
    }
    if (utils.isURLSearchParams(data)) {
      setContentTypeIfUnset(headers, 'application/x-www-form-urlencoded;charset=utf-8');
      return data.toString();
    }
    if (utils.isObject(data) || (headers && headers['Content-Type'] === 'application/json')) {
      setContentTypeIfUnset(headers, 'application/json');
      return stringifySafely(data);
    }
    return data;
  }],

  transformResponse: [function transformResponse(data) {
    var transitional = this.transitional;
    var silentJSONParsing = transitional && transitional.silentJSONParsing;
    var forcedJSONParsing = transitional && transitional.forcedJSONParsing;
    var strictJSONParsing = !silentJSONParsing && this.responseType === 'json';

    if (strictJSONParsing || (forcedJSONParsing && utils.isString(data) && data.length)) {
      try {
        return JSON.parse(data);
      } catch (e) {
        if (strictJSONParsing) {
          if (e.name === 'SyntaxError') {
            throw enhanceError(e, this, 'E_JSON_PARSE');
          }
          throw e;
        }
      }
    }

    return data;
  }],

  /**
   * A timeout in milliseconds to abort a request. If set to 0 (default) a
   * timeout is not created.
   */
  timeout: 0,

  xsrfCookieName: 'XSRF-TOKEN',
  xsrfHeaderName: 'X-XSRF-TOKEN',

  maxContentLength: -1,
  maxBodyLength: -1,

  validateStatus: function validateStatus(status) {
    return status >= 200 && status < 300;
  }
};

defaults.headers = {
  common: {
    'Accept': 'application/json, text/plain, */*'
  }
};

utils.forEach(['delete', 'get', 'head'], function forEachMethodNoData(method) {
  defaults.headers[method] = {};
});

utils.forEach(['post', 'put', 'patch'], function forEachMethodWithData(method) {
  defaults.headers[method] = utils.merge(DEFAULT_CONTENT_TYPE);
});

module.exports = defaults;

}).call(this)}).call(this,require('_process'))
},{"./adapters/http":2,"./adapters/xhr":2,"./core/enhanceError":12,"./helpers/normalizeHeaderName":24,"./utils":28,"_process":68}],17:[function(require,module,exports){
'use strict';

module.exports = function bind(fn, thisArg) {
  return function wrap() {
    var args = new Array(arguments.length);
    for (var i = 0; i < args.length; i++) {
      args[i] = arguments[i];
    }
    return fn.apply(thisArg, args);
  };
};

},{}],18:[function(require,module,exports){
'use strict';

var utils = require('./../utils');

function encode(val) {
  return encodeURIComponent(val).
    replace(/%3A/gi, ':').
    replace(/%24/g, '$').
    replace(/%2C/gi, ',').
    replace(/%20/g, '+').
    replace(/%5B/gi, '[').
    replace(/%5D/gi, ']');
}

/**
 * Build a URL by appending params to the end
 *
 * @param {string} url The base of the url (e.g., http://www.google.com)
 * @param {object} [params] The params to be appended
 * @returns {string} The formatted url
 */
module.exports = function buildURL(url, params, paramsSerializer) {
  /*eslint no-param-reassign:0*/
  if (!params) {
    return url;
  }

  var serializedParams;
  if (paramsSerializer) {
    serializedParams = paramsSerializer(params);
  } else if (utils.isURLSearchParams(params)) {
    serializedParams = params.toString();
  } else {
    var parts = [];

    utils.forEach(params, function serialize(val, key) {
      if (val === null || typeof val === 'undefined') {
        return;
      }

      if (utils.isArray(val)) {
        key = key + '[]';
      } else {
        val = [val];
      }

      utils.forEach(val, function parseValue(v) {
        if (utils.isDate(v)) {
          v = v.toISOString();
        } else if (utils.isObject(v)) {
          v = JSON.stringify(v);
        }
        parts.push(encode(key) + '=' + encode(v));
      });
    });

    serializedParams = parts.join('&');
  }

  if (serializedParams) {
    var hashmarkIndex = url.indexOf('#');
    if (hashmarkIndex !== -1) {
      url = url.slice(0, hashmarkIndex);
    }

    url += (url.indexOf('?') === -1 ? '?' : '&') + serializedParams;
  }

  return url;
};

},{"./../utils":28}],19:[function(require,module,exports){
'use strict';

/**
 * Creates a new URL by combining the specified URLs
 *
 * @param {string} baseURL The base URL
 * @param {string} relativeURL The relative URL
 * @returns {string} The combined URL
 */
module.exports = function combineURLs(baseURL, relativeURL) {
  return relativeURL
    ? baseURL.replace(/\/+$/, '') + '/' + relativeURL.replace(/^\/+/, '')
    : baseURL;
};

},{}],20:[function(require,module,exports){
'use strict';

var utils = require('./../utils');

module.exports = (
  utils.isStandardBrowserEnv() ?

  // Standard browser envs support document.cookie
    (function standardBrowserEnv() {
      return {
        write: function write(name, value, expires, path, domain, secure) {
          var cookie = [];
          cookie.push(name + '=' + encodeURIComponent(value));

          if (utils.isNumber(expires)) {
            cookie.push('expires=' + new Date(expires).toGMTString());
          }

          if (utils.isString(path)) {
            cookie.push('path=' + path);
          }

          if (utils.isString(domain)) {
            cookie.push('domain=' + domain);
          }

          if (secure === true) {
            cookie.push('secure');
          }

          document.cookie = cookie.join('; ');
        },

        read: function read(name) {
          var match = document.cookie.match(new RegExp('(^|;\\s*)(' + name + ')=([^;]*)'));
          return (match ? decodeURIComponent(match[3]) : null);
        },

        remove: function remove(name) {
          this.write(name, '', Date.now() - 86400000);
        }
      };
    })() :

  // Non standard browser env (web workers, react-native) lack needed support.
    (function nonStandardBrowserEnv() {
      return {
        write: function write() {},
        read: function read() { return null; },
        remove: function remove() {}
      };
    })()
);

},{"./../utils":28}],21:[function(require,module,exports){
'use strict';

/**
 * Determines whether the specified URL is absolute
 *
 * @param {string} url The URL to test
 * @returns {boolean} True if the specified URL is absolute, otherwise false
 */
module.exports = function isAbsoluteURL(url) {
  // A URL is considered absolute if it begins with "<scheme>://" or "//" (protocol-relative URL).
  // RFC 3986 defines scheme name as a sequence of characters beginning with a letter and followed
  // by any combination of letters, digits, plus, period, or hyphen.
  return /^([a-z][a-z\d\+\-\.]*:)?\/\//i.test(url);
};

},{}],22:[function(require,module,exports){
'use strict';

/**
 * Determines whether the payload is an error thrown by Axios
 *
 * @param {*} payload The value to test
 * @returns {boolean} True if the payload is an error thrown by Axios, otherwise false
 */
module.exports = function isAxiosError(payload) {
  return (typeof payload === 'object') && (payload.isAxiosError === true);
};

},{}],23:[function(require,module,exports){
'use strict';

var utils = require('./../utils');

module.exports = (
  utils.isStandardBrowserEnv() ?

  // Standard browser envs have full support of the APIs needed to test
  // whether the request URL is of the same origin as current location.
    (function standardBrowserEnv() {
      var msie = /(msie|trident)/i.test(navigator.userAgent);
      var urlParsingNode = document.createElement('a');
      var originURL;

      /**
    * Parse a URL to discover it's components
    *
    * @param {String} url The URL to be parsed
    * @returns {Object}
    */
      function resolveURL(url) {
        var href = url;

        if (msie) {
        // IE needs attribute set twice to normalize properties
          urlParsingNode.setAttribute('href', href);
          href = urlParsingNode.href;
        }

        urlParsingNode.setAttribute('href', href);

        // urlParsingNode provides the UrlUtils interface - http://url.spec.whatwg.org/#urlutils
        return {
          href: urlParsingNode.href,
          protocol: urlParsingNode.protocol ? urlParsingNode.protocol.replace(/:$/, '') : '',
          host: urlParsingNode.host,
          search: urlParsingNode.search ? urlParsingNode.search.replace(/^\?/, '') : '',
          hash: urlParsingNode.hash ? urlParsingNode.hash.replace(/^#/, '') : '',
          hostname: urlParsingNode.hostname,
          port: urlParsingNode.port,
          pathname: (urlParsingNode.pathname.charAt(0) === '/') ?
            urlParsingNode.pathname :
            '/' + urlParsingNode.pathname
        };
      }

      originURL = resolveURL(window.location.href);

      /**
    * Determine if a URL shares the same origin as the current location
    *
    * @param {String} requestURL The URL to test
    * @returns {boolean} True if URL shares the same origin, otherwise false
    */
      return function isURLSameOrigin(requestURL) {
        var parsed = (utils.isString(requestURL)) ? resolveURL(requestURL) : requestURL;
        return (parsed.protocol === originURL.protocol &&
            parsed.host === originURL.host);
      };
    })() :

  // Non standard browser envs (web workers, react-native) lack needed support.
    (function nonStandardBrowserEnv() {
      return function isURLSameOrigin() {
        return true;
      };
    })()
);

},{"./../utils":28}],24:[function(require,module,exports){
'use strict';

var utils = require('../utils');

module.exports = function normalizeHeaderName(headers, normalizedName) {
  utils.forEach(headers, function processHeader(value, name) {
    if (name !== normalizedName && name.toUpperCase() === normalizedName.toUpperCase()) {
      headers[normalizedName] = value;
      delete headers[name];
    }
  });
};

},{"../utils":28}],25:[function(require,module,exports){
'use strict';

var utils = require('./../utils');

// Headers whose duplicates are ignored by node
// c.f. https://nodejs.org/api/http.html#http_message_headers
var ignoreDuplicateOf = [
  'age', 'authorization', 'content-length', 'content-type', 'etag',
  'expires', 'from', 'host', 'if-modified-since', 'if-unmodified-since',
  'last-modified', 'location', 'max-forwards', 'proxy-authorization',
  'referer', 'retry-after', 'user-agent'
];

/**
 * Parse headers into an object
 *
 * ```
 * Date: Wed, 27 Aug 2014 08:58:49 GMT
 * Content-Type: application/json
 * Connection: keep-alive
 * Transfer-Encoding: chunked
 * ```
 *
 * @param {String} headers Headers needing to be parsed
 * @returns {Object} Headers parsed into an object
 */
module.exports = function parseHeaders(headers) {
  var parsed = {};
  var key;
  var val;
  var i;

  if (!headers) { return parsed; }

  utils.forEach(headers.split('\n'), function parser(line) {
    i = line.indexOf(':');
    key = utils.trim(line.substr(0, i)).toLowerCase();
    val = utils.trim(line.substr(i + 1));

    if (key) {
      if (parsed[key] && ignoreDuplicateOf.indexOf(key) >= 0) {
        return;
      }
      if (key === 'set-cookie') {
        parsed[key] = (parsed[key] ? parsed[key] : []).concat([val]);
      } else {
        parsed[key] = parsed[key] ? parsed[key] + ', ' + val : val;
      }
    }
  });

  return parsed;
};

},{"./../utils":28}],26:[function(require,module,exports){
'use strict';

/**
 * Syntactic sugar for invoking a function and expanding an array for arguments.
 *
 * Common use case would be to use `Function.prototype.apply`.
 *
 *  ```js
 *  function f(x, y, z) {}
 *  var args = [1, 2, 3];
 *  f.apply(null, args);
 *  ```
 *
 * With `spread` this example can be re-written.
 *
 *  ```js
 *  spread(function(x, y, z) {})([1, 2, 3]);
 *  ```
 *
 * @param {Function} callback
 * @returns {Function}
 */
module.exports = function spread(callback) {
  return function wrap(arr) {
    return callback.apply(null, arr);
  };
};

},{}],27:[function(require,module,exports){
'use strict';

var pkg = require('./../../package.json');

var validators = {};

// eslint-disable-next-line func-names
['object', 'boolean', 'number', 'function', 'string', 'symbol'].forEach(function(type, i) {
  validators[type] = function validator(thing) {
    return typeof thing === type || 'a' + (i < 1 ? 'n ' : ' ') + type;
  };
});

var deprecatedWarnings = {};
var currentVerArr = pkg.version.split('.');

/**
 * Compare package versions
 * @param {string} version
 * @param {string?} thanVersion
 * @returns {boolean}
 */
function isOlderVersion(version, thanVersion) {
  var pkgVersionArr = thanVersion ? thanVersion.split('.') : currentVerArr;
  var destVer = version.split('.');
  for (var i = 0; i < 3; i++) {
    if (pkgVersionArr[i] > destVer[i]) {
      return true;
    } else if (pkgVersionArr[i] < destVer[i]) {
      return false;
    }
  }
  return false;
}

/**
 * Transitional option validator
 * @param {function|boolean?} validator
 * @param {string?} version
 * @param {string} message
 * @returns {function}
 */
validators.transitional = function transitional(validator, version, message) {
  var isDeprecated = version && isOlderVersion(version);

  function formatMessage(opt, desc) {
    return '[Axios v' + pkg.version + '] Transitional option \'' + opt + '\'' + desc + (message ? '. ' + message : '');
  }

  // eslint-disable-next-line func-names
  return function(value, opt, opts) {
    if (validator === false) {
      throw new Error(formatMessage(opt, ' has been removed in ' + version));
    }

    if (isDeprecated && !deprecatedWarnings[opt]) {
      deprecatedWarnings[opt] = true;
      // eslint-disable-next-line no-console
      console.warn(
        formatMessage(
          opt,
          ' has been deprecated since v' + version + ' and will be removed in the near future'
        )
      );
    }

    return validator ? validator(value, opt, opts) : true;
  };
};

/**
 * Assert object's properties type
 * @param {object} options
 * @param {object} schema
 * @param {boolean?} allowUnknown
 */

function assertOptions(options, schema, allowUnknown) {
  if (typeof options !== 'object') {
    throw new TypeError('options must be an object');
  }
  var keys = Object.keys(options);
  var i = keys.length;
  while (i-- > 0) {
    var opt = keys[i];
    var validator = schema[opt];
    if (validator) {
      var value = options[opt];
      var result = value === undefined || validator(value, opt, options);
      if (result !== true) {
        throw new TypeError('option ' + opt + ' must be ' + result);
      }
      continue;
    }
    if (allowUnknown !== true) {
      throw Error('Unknown option ' + opt);
    }
  }
}

module.exports = {
  isOlderVersion: isOlderVersion,
  assertOptions: assertOptions,
  validators: validators
};

},{"./../../package.json":29}],28:[function(require,module,exports){
'use strict';

var bind = require('./helpers/bind');

// utils is a library of generic helper functions non-specific to axios

var toString = Object.prototype.toString;

/**
 * Determine if a value is an Array
 *
 * @param {Object} val The value to test
 * @returns {boolean} True if value is an Array, otherwise false
 */
function isArray(val) {
  return toString.call(val) === '[object Array]';
}

/**
 * Determine if a value is undefined
 *
 * @param {Object} val The value to test
 * @returns {boolean} True if the value is undefined, otherwise false
 */
function isUndefined(val) {
  return typeof val === 'undefined';
}

/**
 * Determine if a value is a Buffer
 *
 * @param {Object} val The value to test
 * @returns {boolean} True if value is a Buffer, otherwise false
 */
function isBuffer(val) {
  return val !== null && !isUndefined(val) && val.constructor !== null && !isUndefined(val.constructor)
    && typeof val.constructor.isBuffer === 'function' && val.constructor.isBuffer(val);
}

/**
 * Determine if a value is an ArrayBuffer
 *
 * @param {Object} val The value to test
 * @returns {boolean} True if value is an ArrayBuffer, otherwise false
 */
function isArrayBuffer(val) {
  return toString.call(val) === '[object ArrayBuffer]';
}

/**
 * Determine if a value is a FormData
 *
 * @param {Object} val The value to test
 * @returns {boolean} True if value is an FormData, otherwise false
 */
function isFormData(val) {
  return (typeof FormData !== 'undefined') && (val instanceof FormData);
}

/**
 * Determine if a value is a view on an ArrayBuffer
 *
 * @param {Object} val The value to test
 * @returns {boolean} True if value is a view on an ArrayBuffer, otherwise false
 */
function isArrayBufferView(val) {
  var result;
  if ((typeof ArrayBuffer !== 'undefined') && (ArrayBuffer.isView)) {
    result = ArrayBuffer.isView(val);
  } else {
    result = (val) && (val.buffer) && (val.buffer instanceof ArrayBuffer);
  }
  return result;
}

/**
 * Determine if a value is a String
 *
 * @param {Object} val The value to test
 * @returns {boolean} True if value is a String, otherwise false
 */
function isString(val) {
  return typeof val === 'string';
}

/**
 * Determine if a value is a Number
 *
 * @param {Object} val The value to test
 * @returns {boolean} True if value is a Number, otherwise false
 */
function isNumber(val) {
  return typeof val === 'number';
}

/**
 * Determine if a value is an Object
 *
 * @param {Object} val The value to test
 * @returns {boolean} True if value is an Object, otherwise false
 */
function isObject(val) {
  return val !== null && typeof val === 'object';
}

/**
 * Determine if a value is a plain Object
 *
 * @param {Object} val The value to test
 * @return {boolean} True if value is a plain Object, otherwise false
 */
function isPlainObject(val) {
  if (toString.call(val) !== '[object Object]') {
    return false;
  }

  var prototype = Object.getPrototypeOf(val);
  return prototype === null || prototype === Object.prototype;
}

/**
 * Determine if a value is a Date
 *
 * @param {Object} val The value to test
 * @returns {boolean} True if value is a Date, otherwise false
 */
function isDate(val) {
  return toString.call(val) === '[object Date]';
}

/**
 * Determine if a value is a File
 *
 * @param {Object} val The value to test
 * @returns {boolean} True if value is a File, otherwise false
 */
function isFile(val) {
  return toString.call(val) === '[object File]';
}

/**
 * Determine if a value is a Blob
 *
 * @param {Object} val The value to test
 * @returns {boolean} True if value is a Blob, otherwise false
 */
function isBlob(val) {
  return toString.call(val) === '[object Blob]';
}

/**
 * Determine if a value is a Function
 *
 * @param {Object} val The value to test
 * @returns {boolean} True if value is a Function, otherwise false
 */
function isFunction(val) {
  return toString.call(val) === '[object Function]';
}

/**
 * Determine if a value is a Stream
 *
 * @param {Object} val The value to test
 * @returns {boolean} True if value is a Stream, otherwise false
 */
function isStream(val) {
  return isObject(val) && isFunction(val.pipe);
}

/**
 * Determine if a value is a URLSearchParams object
 *
 * @param {Object} val The value to test
 * @returns {boolean} True if value is a URLSearchParams object, otherwise false
 */
function isURLSearchParams(val) {
  return typeof URLSearchParams !== 'undefined' && val instanceof URLSearchParams;
}

/**
 * Trim excess whitespace off the beginning and end of a string
 *
 * @param {String} str The String to trim
 * @returns {String} The String freed of excess whitespace
 */
function trim(str) {
  return str.trim ? str.trim() : str.replace(/^\s+|\s+$/g, '');
}

/**
 * Determine if we're running in a standard browser environment
 *
 * This allows axios to run in a web worker, and react-native.
 * Both environments support XMLHttpRequest, but not fully standard globals.
 *
 * web workers:
 *  typeof window -> undefined
 *  typeof document -> undefined
 *
 * react-native:
 *  navigator.product -> 'ReactNative'
 * nativescript
 *  navigator.product -> 'NativeScript' or 'NS'
 */
function isStandardBrowserEnv() {
  if (typeof navigator !== 'undefined' && (navigator.product === 'ReactNative' ||
                                           navigator.product === 'NativeScript' ||
                                           navigator.product === 'NS')) {
    return false;
  }
  return (
    typeof window !== 'undefined' &&
    typeof document !== 'undefined'
  );
}

/**
 * Iterate over an Array or an Object invoking a function for each item.
 *
 * If `obj` is an Array callback will be called passing
 * the value, index, and complete array for each item.
 *
 * If 'obj' is an Object callback will be called passing
 * the value, key, and complete object for each property.
 *
 * @param {Object|Array} obj The object to iterate
 * @param {Function} fn The callback to invoke for each item
 */
function forEach(obj, fn) {
  // Don't bother if no value provided
  if (obj === null || typeof obj === 'undefined') {
    return;
  }

  // Force an array if not already something iterable
  if (typeof obj !== 'object') {
    /*eslint no-param-reassign:0*/
    obj = [obj];
  }

  if (isArray(obj)) {
    // Iterate over array values
    for (var i = 0, l = obj.length; i < l; i++) {
      fn.call(null, obj[i], i, obj);
    }
  } else {
    // Iterate over object keys
    for (var key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        fn.call(null, obj[key], key, obj);
      }
    }
  }
}

/**
 * Accepts varargs expecting each argument to be an object, then
 * immutably merges the properties of each object and returns result.
 *
 * When multiple objects contain the same key the later object in
 * the arguments list will take precedence.
 *
 * Example:
 *
 * ```js
 * var result = merge({foo: 123}, {foo: 456});
 * console.log(result.foo); // outputs 456
 * ```
 *
 * @param {Object} obj1 Object to merge
 * @returns {Object} Result of all merge properties
 */
function merge(/* obj1, obj2, obj3, ... */) {
  var result = {};
  function assignValue(val, key) {
    if (isPlainObject(result[key]) && isPlainObject(val)) {
      result[key] = merge(result[key], val);
    } else if (isPlainObject(val)) {
      result[key] = merge({}, val);
    } else if (isArray(val)) {
      result[key] = val.slice();
    } else {
      result[key] = val;
    }
  }

  for (var i = 0, l = arguments.length; i < l; i++) {
    forEach(arguments[i], assignValue);
  }
  return result;
}

/**
 * Extends object a by mutably adding to it the properties of object b.
 *
 * @param {Object} a The object to be extended
 * @param {Object} b The object to copy properties from
 * @param {Object} thisArg The object to bind function to
 * @return {Object} The resulting value of object a
 */
function extend(a, b, thisArg) {
  forEach(b, function assignValue(val, key) {
    if (thisArg && typeof val === 'function') {
      a[key] = bind(val, thisArg);
    } else {
      a[key] = val;
    }
  });
  return a;
}

/**
 * Remove byte order marker. This catches EF BB BF (the UTF-8 BOM)
 *
 * @param {string} content with BOM
 * @return {string} content value without BOM
 */
function stripBOM(content) {
  if (content.charCodeAt(0) === 0xFEFF) {
    content = content.slice(1);
  }
  return content;
}

module.exports = {
  isArray: isArray,
  isArrayBuffer: isArrayBuffer,
  isBuffer: isBuffer,
  isFormData: isFormData,
  isArrayBufferView: isArrayBufferView,
  isString: isString,
  isNumber: isNumber,
  isObject: isObject,
  isPlainObject: isPlainObject,
  isUndefined: isUndefined,
  isDate: isDate,
  isFile: isFile,
  isBlob: isBlob,
  isFunction: isFunction,
  isStream: isStream,
  isURLSearchParams: isURLSearchParams,
  isStandardBrowserEnv: isStandardBrowserEnv,
  forEach: forEach,
  merge: merge,
  extend: extend,
  trim: trim,
  stripBOM: stripBOM
};

},{"./helpers/bind":17}],29:[function(require,module,exports){
module.exports={
  "name": "axios",
  "version": "0.21.4",
  "description": "Promise based HTTP client for the browser and node.js",
  "main": "index.js",
  "scripts": {
    "test": "grunt test",
    "start": "node ./sandbox/server.js",
    "build": "NODE_ENV=production grunt build",
    "preversion": "npm test",
    "version": "npm run build && grunt version && git add -A dist && git add CHANGELOG.md bower.json package.json",
    "postversion": "git push && git push --tags",
    "examples": "node ./examples/server.js",
    "coveralls": "cat coverage/lcov.info | ./node_modules/coveralls/bin/coveralls.js",
    "fix": "eslint --fix lib/**/*.js"
  },
  "repository": {
    "type": "git",
    "url": "https://github.com/axios/axios.git"
  },
  "keywords": [
    "xhr",
    "http",
    "ajax",
    "promise",
    "node"
  ],
  "author": "Matt Zabriskie",
  "license": "MIT",
  "bugs": {
    "url": "https://github.com/axios/axios/issues"
  },
  "homepage": "https://axios-http.com",
  "devDependencies": {
    "coveralls": "^3.0.0",
    "es6-promise": "^4.2.4",
    "grunt": "^1.3.0",
    "grunt-banner": "^0.6.0",
    "grunt-cli": "^1.2.0",
    "grunt-contrib-clean": "^1.1.0",
    "grunt-contrib-watch": "^1.0.0",
    "grunt-eslint": "^23.0.0",
    "grunt-karma": "^4.0.0",
    "grunt-mocha-test": "^0.13.3",
    "grunt-ts": "^6.0.0-beta.19",
    "grunt-webpack": "^4.0.2",
    "istanbul-instrumenter-loader": "^1.0.0",
    "jasmine-core": "^2.4.1",
    "karma": "^6.3.2",
    "karma-chrome-launcher": "^3.1.0",
    "karma-firefox-launcher": "^2.1.0",
    "karma-jasmine": "^1.1.1",
    "karma-jasmine-ajax": "^0.1.13",
    "karma-safari-launcher": "^1.0.0",
    "karma-sauce-launcher": "^4.3.6",
    "karma-sinon": "^1.0.5",
    "karma-sourcemap-loader": "^0.3.8",
    "karma-webpack": "^4.0.2",
    "load-grunt-tasks": "^3.5.2",
    "minimist": "^1.2.0",
    "mocha": "^8.2.1",
    "sinon": "^4.5.0",
    "terser-webpack-plugin": "^4.2.3",
    "typescript": "^4.0.5",
    "url-search-params": "^0.10.0",
    "webpack": "^4.44.2",
    "webpack-dev-server": "^3.11.0"
  },
  "browser": {
    "./lib/adapters/http.js": "./lib/adapters/xhr.js"
  },
  "jsdelivr": "dist/axios.min.js",
  "unpkg": "dist/axios.min.js",
  "typings": "./index.d.ts",
  "dependencies": {
    "follow-redirects": "^1.14.0"
  },
  "bundlesize": [
    {
      "path": "./dist/axios.min.js",
      "threshold": "5kB"
    }
  ]
}

},{}],30:[function(require,module,exports){

},{}],31:[function(require,module,exports){
/* jshint esversion: 6 */
/* jslint node: true */
'use strict';

module.exports = function serialize (object) {
  if (object === null || typeof object !== 'object' || object.toJSON != null) {
    return JSON.stringify(object);
  }

  if (Array.isArray(object)) {
    return '[' + object.reduce((t, cv, ci) => {
      const comma = ci === 0 ? '' : ',';
      const value = cv === undefined || typeof cv === 'symbol' ? null : cv;
      return t + comma + serialize(value);
    }, '') + ']';
  }

  return '{' + Object.keys(object).sort().reduce((t, cv, ci) => {
    if (object[cv] === undefined ||
        typeof object[cv] === 'symbol') {
      return t;
    }
    const comma = t.length === 0 ? '' : ',';
    return t + comma + serialize(cv) + ':' + serialize(object[cv]);
  }, '') + '}';
};

},{}],32:[function(require,module,exports){
/**
 * Returns a Hard Copy (copy by Value) of the given JSON input
 *
 * @param jsonInput {any} - the input
 * @return {any} - the hard copy of the input
 */
const jhcpy = (jsonInput) => {
  return JSON.parse(JSON.stringify(jsonInput));
};

const getLanguageString = (valuesArray, language = undefined) => {
  if (!Array.isArray(valuesArray)) {
    throw new Error("Given valuesArray parameter is not an array, as expected");
  }
  if (language) {
    const entryForGivenLanguage = valuesArray.find(
      (el) => el["@language"] === language
    );
    if (entryForGivenLanguage && entryForGivenLanguage["@value"]) {
      return entryForGivenLanguage["@value"];
    }
  } else {
    // return the first value found
    if (valuesArray[0] && valuesArray[0]["@value"]) {
      return valuesArray[0]["@value"];
    }
  }
  return undefined;
};

const reorderNodeBasedOnNodeTermArray = (dsNode, nodeTermArray) => {
  // always use first the terms used in nodeTermArray, then add any terms that are not listed there
  const dsNodeCopy = jhcpy(dsNode);
  // delete all used terms
  for (const p of Object.keys(dsNode)) {
    delete dsNode[p];
  }
  // add all known terms by order
  for (const t of nodeTermArray) {
    const term = t.term;
    if (dsNodeCopy[term] !== undefined) {
      dsNode[term] = dsNodeCopy[term];
    }
  }
  // add all unknown terms by order of their appearance in the original object
  for (const p of Object.keys(dsNodeCopy)) {
    const standardTerm = nodeTermArray.find((el) => el.term === p);
    if (standardTerm === undefined) {
      dsNode[p] = dsNodeCopy[p];
    }
  }
};

// checks if a given input is really an object
const isObject = (val) => {
  return val instanceof Object && !(val instanceof Array);
};

module.exports = {
  jhcpy,
  getLanguageString,
  reorderNodeBasedOnNodeTermArray,
  isObject,
};

},{}],33:[function(require,module,exports){
const DsUtilitiesBase = require("./versions/DsUtilitiesBase.js");
const DsUtilitiesV5 = require("./versions/DsUtilitiesV5.js");
const DsUtilitiesV7 = require("./versions/DsUtilitiesV7.js");
const myDsUtilitiesForCheck = new DsUtilitiesBase();
const availableDsUtilitiesVersions = ["5.0", "7.0"];

/**
 * Returns a new and corresponding DsUtilities instance for the given ds specification version (e.g. "5.0")
 *
 * @param {string} dsSpecVersion - the given DS specification version
 * @return {DsUtilitiesV7|DsUtilitiesV5} a corresponding DsUtilities instance for the given version
 */
const getDsUtilitiesForDsSpecVersion = (dsSpecVersion) => {
  if (!availableDsUtilitiesVersions.includes(dsSpecVersion)) {
    throw new Error(
      "The given DS Specification Version " +
        dsSpecVersion +
        " is unknown to DsUtilities."
    );
  }
  switch (dsSpecVersion) {
    case "5.0":
      return new DsUtilitiesV5();
    case "7.0":
      return new DsUtilitiesV7();
  }
};

/**
 *  Returns a new and corresponding DsUtilities instance for the given domain specification
 *
 * @param {object} ds - the given DS
 * @return {DsUtilitiesV7|DsUtilitiesV5} a corresponding DsUtilities instance for the given DS
 */
const getDsUtilitiesForDs = (ds) => {
  const dsSpecVersion = myDsUtilitiesForCheck.getDsSpecificationVersion(ds);
  return getDsUtilitiesForDsSpecVersion(dsSpecVersion);
};

module.exports = {
  getDsUtilitiesForDsSpecVersion,
  getDsUtilitiesForDs,
};

},{"./versions/DsUtilitiesBase.js":34,"./versions/DsUtilitiesV5.js":35,"./versions/DsUtilitiesV7.js":36}],34:[function(require,module,exports){
/**
 * This is the super class for all DsUtilities classes
 * It includes functions that are shared by all DsUtilities classes
 */
const fBase = require("./functions/functionsBase.js");

class DsUtilitiesBase {
  constructor() {
    // the dsUtilitiesVersion specifies the version of a DsUtilities Class, which is exactly the same as the corresponding DS specification version
    // DsUtilitiesBase is a super-class for all DsUtilities versions, therefore, it has no corresponding Ds specification version
    this.dsUtilitiesVersion = undefined;
    // functions that handle the structure of DS
    this.getDsSpecificationVersion = fBase.getDsSpecificationVersion;
    // functions for the handling of DS Paths, e.g. "$.schema:address/schema:PostalAddress"
    // this.initDsPathForDsRoot = initDsPathForDsRoot; todo this should also be version specific
    // this.initDsPathForInternalReference = initDsPathForInternalReference; // from DS-V7 upwards
    // this.addPropertyToDsPath = addPropertyToDsPath;
    // this.addRangeToDsPath = addRangeToDsPath;
    // functions that ease the UI interaction with DS
    this.prettyPrintCompactedIRI = fBase.prettyPrintCompactedIRI;
    this.extractSdoVersionNumber = fBase.extractSdoVersionNumber;
  }
}

module.exports = DsUtilitiesBase;

},{"./functions/functionsBase.js":39}],35:[function(require,module,exports){
const DsUtilitiesBase = require("./DsUtilitiesBase.js");
const fV5 = require("./functions/functionsV5.js");

/**
 * A DsUtilities instance that offers an API for DS-V5
 * @class
 */
class DsUtilitiesV5 extends DsUtilitiesBase {
  constructor() {
    super();
    this.dsUtilitiesVersion = "5.0";
    // functions that handle the structure of DS
    this.getDsRootNode = fV5.getDsRootNodeV5;
    this.getDsStandardContext = fV5.getDsStandardContextV5;
    this.getDsId = fV5.getDsIdV5;
    // this.reorderDsNode = reorderDsNodeV5;
    // functions for the handling of DS Paths, e.g. "$.schema:address/schema:PostalAddress"
    // this.getDsNodeForPath = getDsNodeForPathV5; // e.g. "$.schema:address/schema:PostalAddress"
    // functions that ease the UI interaction with DS
    this.getDsName = fV5.getDsNameV5;
    this.getDsDescription = fV5.getDsDescriptionV5;
    this.getDsAuthorName = fV5.getDsAuthorV5;
    this.getDsSchemaVersion = fV5.getDsSchemaVersionV5;
    this.getDsVersion = fV5.getDsVersionV5;
    this.getDsExternalVocabularies = fV5.getDsExternalVocabulariesV5;
    this.getDsTargetClasses = fV5.getDsTargetClassesV5;
  }
}

module.exports = DsUtilitiesV5;

},{"./DsUtilitiesBase.js":34,"./functions/functionsV5.js":40}],36:[function(require,module,exports){
const DsUtilitiesBase = require("./DsUtilitiesBase.js");
const fV7 = require("./functions/functionsV7.js");

/**
 * A DsUtilities instance that offers an API for DS-V7
 * @class
 */
class DsUtilitiesV7 extends DsUtilitiesBase {
  constructor() {
    super();
    this.dsUtilitiesVersion = "7.0";
    // functions that handle the structure of DS
    this.getDsRootNode = fV7.getDsRootNodeV7;
    this.getDsStandardContext = fV7.getDsStandardContextV7;
    this.getDsId = fV7.getDsIdV7;
    this.reorderDs = fV7.reorderDsV7;
    this.reorderDsNode = fV7.reorderDsNodeV7;
    this.generateInnerNodeId = fV7.generateInnerNodeIdV7;
    // functions for the handling of DS Paths, e.g. "$.schema:address/schema:PostalAddress"
    this.dsPathInit = fV7.dsPathInitV7;
    this.dsPathAddition = fV7.dsPathAdditionV7;
    this.dsPathGetNode = fV7.dsPathGetNodeV7;
    this.dsPathIdentifyNodeType = fV7.dsPathIdentifyNodeTypeV7;
    // functions that ease the UI interaction with DS
    this.getDsName = fV7.getDsNameV7;
    this.getDsDescription = fV7.getDsDescriptionV7;
    this.getDsAuthorName = fV7.getDsAuthorNameV7;
    this.getDsSchemaVersion = fV7.getDsSchemaVersionV7;
    this.getDsVersion = fV7.getDsVersionV7;
    this.getDsExternalVocabularies = fV7.getDsExternalVocabulariesV7;
    this.getDsTargetClasses = fV7.getDsTargetClassesV7;
  }
}

module.exports = DsUtilitiesV7;

},{"./DsUtilitiesBase.js":34,"./functions/functionsV7.js":41}],37:[function(require,module,exports){
/*
 * This file contains data describing the components and structure used by Domain Specifications in DS-V5
 */

// These are the terms used by a DS Object for DS-V5, listed in the recommended order as they should be listed in their lexical representation
const nodeTermsDsObject = [
  {
    term: "@context",
    required: true,
    valueType: "object",
  },
  {
    term: "@graph",
    required: true,
    valueType: "array",
  },
  {
    term: "@id",
    required: true,
    valueType: "string",
  },
];

const dsNodePropertyOrder = [
  "@context",
  "@graph",
  "@id",
  "@type",
  "@language",
  "@value",
  "sh:targetClass",
  "sh:targetObjectsOf",
  "sh:targetSubjectsOf",
  "sh:class",
  "sh:datatype",
  "schema:name",
  "schema:description",
  "schema:author",
  "rdfs:comment",
  "schema:version",
  "schema:schemaVersion",
  "ds:usedVocabularies",
  "sh:closed",
  "sh:order",
  "sh:path",
  "sh:minCount",
  "sh:maxCount",
  "sh:equals",
  "sh:disjoint",
  "sh:lessThan",
  "sh:lessThanOrEquals",
  "sh:defaultValue",
  "ds:defaultLanguage",
  "sh:minExclusive",
  "sh:minInclusive",
  "sh:maxExclusive",
  "sh:maxInclusive",
  "sh:minLength",
  "sh:maxLength",
  "sh:pattern",
  "sh:flag",
  "sh:languageIn",
  "ds:hasLanguage",
  "sh:uniqueLang",
  "sh:in",
  "sh:hasValue",
  "sh:property",
  "sh:or",
  "sh:node",
];

const standardContext = {
  rdf: "http://www.w3.org/1999/02/22-rdf-syntax-ns#",
  rdfs: "http://www.w3.org/2000/01/rdf-schema#",
  sh: "http://www.w3.org/ns/shacl#",
  xsd: "http://www.w3.org/2001/XMLSchema#",
  schema: "http://schema.org/",
  ds: "http://vocab.sti2.at/ds/",
  "ds:usedVocabularies": {
    "@id": "ds:usedVocabularies",
    "@type": "@id",
  },
  "sh:targetClass": {
    "@id": "sh:targetClass",
    "@type": "@id",
  },
  "sh:property": {
    "@id": "sh:property",
  },
  "sh:path": {
    "@id": "sh:path",
    "@type": "@id",
  },
  "sh:datatype": {
    "@id": "sh:datatype",
    "@type": "@id",
  },
  "sh:node": {
    "@id": "sh:node",
  },
  "sh:class": {
    "@id": "sh:class",
    "@type": "@id",
  },
  "sh:or": {
    "@id": "sh:or",
    "@container": "@list",
  },
  "sh:in": {
    "@id": "sh:in",
    "@container": "@list",
  },
  "sh:languageIn": {
    "@id": "sh:languageIn",
    "@container": "@list",
  },
  "sh:equals": {
    "@id": "sh:equals",
    "@type": "@id",
  },
  "sh:disjoint": {
    "@id": "sh:disjoint",
    "@type": "@id",
  },
  "sh:lessThan": {
    "@id": "sh:lessThan",
    "@type": "@id",
  },
  "sh:lessThanOrEquals": {
    "@id": "sh:lessThanOrEquals",
    "@type": "@id",
  },
};

module.exports = {
  nodeTermsDsObject,
  dsNodePropertyOrder,
  standardContext,
};

},{}],38:[function(require,module,exports){
/*
 * This file contains data describing the components and structure used by Domain Specifications in DS-V7
 */

// These are the terms used by a DS Object for DS-V7
// Listed in the recommended order as they should be listed in their lexical representation
const nodeTermsDsObject = [
  {
    term: "@context",
    required: true,
    valueType: "object",
  },
  {
    term: "@graph",
    required: true,
    valueType: "array",
  },
];

// These are the terms used by the @context for DS-V7
// Listed in the recommended order as they should be listed in their lexical representation
// This list is dynamically built out of the standard @context
const nodeTermsContext = () => {
  const result = [];
  for (const t of Object.keys(standardContext)) {
    const entry = {
      term: t,
      required: true,
    };
    if (typeof standardContext[t] === "string") {
      entry.valueType = "string";
      entry.value = standardContext[t];
    } else {
      entry.valueType = "object";
    }
    result.push(entry);
  }
  return result;
};

//   {
//     term: "@context",
//     required: true,
//     valueType: "object",
//   },
//   {
//     term: "@graph",
//     required: true,
//     valueType: "array",
//   },
// ];

// These are the terms used by a DS Root node for DS-V7
// Listed in the recommended order as they should be listed in their lexical representation
const nodeTermsRootNode = [
  {
    term: "@id",
    required: true,
    valueType: "string",
  },
  {
    term: "@type",
    required: true,
    valueType: "string",
    value: "ds:DomainSpecification",
  },
  {
    term: "ds:subDSOf",
    required: false,
    valueType: "string",
  },
  {
    term: "sh:targetClass",
    required: false,
    valueType: "array",
  },
  {
    term: "sh:targetObjectsOf",
    required: false,
    valueType: "string",
  },
  {
    term: "sh:targetSubjectsOf",
    required: false,
    valueType: "string",
  },
  {
    term: "sh:class",
    required: false,
    valueType: "array",
  },
  {
    term: "schema:name",
    required: false,
    valueType: "array",
  },
  {
    term: "schema:description",
    required: false,
    valueType: "array",
  },
  {
    term: "schema:author",
    required: false,
    valueType: "object",
  },
  {
    term: "ds:version",
    required: true,
    valueType: "string",
  },
  {
    term: "schema:version",
    required: false,
    valueType: "string",
  },
  {
    term: "schema:schemaVersion",
    required: true,
    valueType: "string",
  },
  {
    term: "ds:usedVocabulary",
    required: false,
    valueType: "array",
  },
  {
    term: "sh:closed",
    required: false,
    valueType: "boolean",
  },
  {
    term: "sh:property",
    required: true,
    valueType: "array",
  },
];

// These are the terms used by a property node for DS-V7
// Listed in the recommended order as they should be listed in their lexical representation
const nodeTermsPropertyNode = [
  {
    term: "@type",
    required: true,
    valueType: "string",
    value: "sh:PropertyShape",
  },
  {
    term: "sh:order",
    required: false,
    valueType: "integer",
  },
  {
    term: "sh:path",
    required: true,
    valueType: "string",
  },
  {
    term: "rdfs:comment",
    required: false,
    valueType: "array",
  },
  {
    term: "sh:minCount",
    required: false,
    valueType: "integer",
  },
  {
    term: "sh:maxCount",
    required: false,
    valueType: "integer",
  },
  {
    term: "sh:equals",
    required: false,
    valueType: "array",
  },
  {
    term: "sh:disjoint",
    required: false,
    valueType: "array",
  },
  {
    term: "sh:lessThan",
    required: false,
    valueType: "array",
  },
  {
    term: "sh:lessThanOrEquals",
    required: false,
    valueType: "array",
  },
  {
    term: "sh:or",
    required: true,
    valueType: "array",
  },
];

// These are the terms used by a Class node for DS-V7
// Listed in the recommended order as they should be listed in their lexical representation
const nodeTermsClassNode = [
  {
    term: "@id",
    required: true,
    valueType: "string",
  },
  {
    term: "@type",
    required: true,
    valueType: "string",
    value: "sh:NodeShape",
  },
  {
    term: "sh:class",
    required: true,
    valueType: "array",
  },
  {
    term: "sh:closed",
    required: false,
    valueType: "boolean",
  },
  {
    term: "sh:property",
    required: false,
    valueType: "array",
  },
];

// These are the terms used by an enumeration node for DS-V7
// Listed in the recommended order as they should be listed in their lexical representation
const nodeTermsEnumerationNode = [
  {
    term: "@id",
    required: true,
    valueType: "string",
  },
  {
    term: "@type",
    required: true,
    valueType: "string",
    value: "sh:NodeShape",
  },
  {
    term: "sh:class",
    required: true,
    valueType: "array",
  },
  {
    term: "sh:in",
    required: false,
    valueType: "array",
  },
];

// These are the terms used by a data type node for DS-V7
// Listed in the recommended order as they should be listed in their lexical representation
const nodeTermsDataTypeNode = [
  {
    term: "sh:datatype",
    required: true,
    valueType: "string",
  },
  {
    term: "sh:defaultValue",
    required: false,
    valueType: "any",
  },
  {
    term: "ds:defaultLanguage",
    required: false,
    valueType: "string",
  },
  {
    term: "sh:minExclusive",
    required: false,
    valueType: "any",
  },
  {
    term: "sh:minInclusive",
    required: false,
    valueType: "any",
  },
  {
    term: "sh:maxExclusive",
    required: false,
    valueType: "any",
  },
  {
    term: "sh:maxInclusive",
    required: false,
    valueType: "any",
  },
  {
    term: "sh:minLength",
    required: false,
    valueType: "integer",
  },
  {
    term: "sh:maxLength",
    required: false,
    valueType: "integer",
  },
  {
    term: "sh:pattern",
    required: false,
    valueType: "array",
  },
  {
    term: "sh:flag",
    required: false,
    valueType: "string",
  },
  {
    term: "sh:languageIn",
    required: false,
    valueType: "array",
  },
  {
    term: "ds:hasLanguage",
    required: false,
    valueType: "array",
  },
  {
    term: "sh:uniqueLang",
    required: false,
    valueType: "boolean",
  },
  {
    term: "sh:in",
    required: false,
    valueType: "array",
  },
  {
    term: "sh:hasValue",
    required: false,
    valueType: "array",
  },
];

// These are the terms used by a language tagged value for DS-V7 (e.g. value of schema:name)
// Listed in the recommended order as they should be listed in their lexical representation
const nodeTermsLanguageTaggedValue = [
  {
    term: "@language",
    required: true,
    valueType: "string",
  },
  {
    term: "@value",
    required: true,
    valueType: "string",
  },
];

const standardContext = {
  ds: "https://vocab.sti2.at/ds/",
  rdf: "http://www.w3.org/1999/02/22-rdf-syntax-ns#",
  rdfs: "http://www.w3.org/2000/01/rdf-schema#",
  schema: "https://schema.org/",
  sh: "http://www.w3.org/ns/shacl#",
  xsd: "http://www.w3.org/2001/XMLSchema#",
  "ds:subDSOf": {
    "@type": "@id",
  },
  "ds:usedVocabulary": {
    "@type": "@id",
  },
  "sh:targetClass": {
    "@type": "@id",
  },
  "sh:targetObjectsOf": {
    "@type": "@id",
  },
  "sh:targetSubjectsOf": {
    "@type": "@id",
  },
  "sh:class": {
    "@type": "@id",
  },
  "sh:path": {
    "@type": "@id",
  },
  "sh:datatype": {
    "@type": "@id",
  },
  "sh:equals": {
    "@type": "@id",
  },
  "sh:disjoint": {
    "@type": "@id",
  },
  "sh:lessThan": {
    "@type": "@id",
  },
  "sh:lessThanOrEquals": {
    "@type": "@id",
  },
  "sh:in": {
    "@container": "@list",
  },
  "sh:languageIn": {
    "@container": "@list",
  },
  "sh:or": {
    "@container": "@list",
  },
};

module.exports = {
  nodeTermsDsObject,
  nodeTermsContext,
  nodeTermsRootNode,
  nodeTermsPropertyNode,
  nodeTermsClassNode,
  nodeTermsEnumerationNode,
  nodeTermsDataTypeNode,
  nodeTermsLanguageTaggedValue,
  standardContext,
};

},{}],39:[function(require,module,exports){
/*
 * This file contains the functions used by DsUtilitiesBase
 */

/*
 * ===========================================
 * functions that handle the structure of DS
 * ===========================================
 */

/**
 * Returns the used DS specification version used in the given DS.
 *
 * @param ds {object} - The input DS
 * @return {string} - The detected DS specification version used
 */
const getDsSpecificationVersion = (ds) => {
  if (!Array.isArray(ds["@graph"])) {
    throw new Error(
      "The given DS has no @graph array, which is expected for any DS version."
    );
  }
  // check if the version is "7.0" or later
  try {
    // expected root node format for DS-V7 and later
    const rootNode = ds["@graph"].find(
      (el) => el["@type"] === "ds:DomainSpecification"
    );
    if (rootNode) {
      return rootNode["ds:version"];
    }
  } catch (e) {
    // DS is not from 7.0 or later
  }
  // check if the version used is "5.0"
  try {
    // expected root node format for DS-V5
    const rootNode = ds["@graph"].find(
      (el) =>
        Array.isArray(el["@type"]) &&
        el["@type"].includes("sh:NodeShape") &&
        el["@type"].includes("schema:CreativeWork")
    );
    if (rootNode) {
      return "5.0";
    }
  } catch (e) {
    // DS is not from 5.0
  }
  // throw an error if the version could not been determined
  throw new Error(
    "The DS specification version for the given DS could not been determined - the DS has an unexpected structure."
  );
};

/*
 * ===========================================
 * functions that ease the UI interaction with DS
 * ===========================================
 */

/**
 * Returns the "pretty" version of a compacted IRI (single IRI or array of IRIs).
 * If the IRI belongs to schema.org, then the IRI is returned without the vocabulary indicator (schema:)
 *
 * @param iri {string|string[]} - the input IRI or array of IRIs
 * @return {string}
 */
const prettyPrintCompactedIRI = (iri) => {
  if (Array.isArray(iri)) {
    let result = "";
    for (let i = 0; i < iri.length; i++) {
      result += prettyPrintCompactedIRI(iri[i]);
      if (i + 1 < iri.length) {
        result += " + ";
      }
    }
    return result;
  } else {
    if (iri.startsWith("schema:")) {
      return iri.substring("schema:".length);
    }
    return iri;
  }
};

/**
 * Extracts the indicated schema.org version of a given URL. This functions accepts URLs with following formats
 * https://schema.org/docs/releases.html#v10.0
 * https://schema.org/version/3.4/
 * @param schemaVersionValue {string} - a URL specifying a version of schema.org
 * @return {string} - the version as a simple string
 */
const extractSdoVersionNumber = (schemaVersionValue) => {
  if (schemaVersionValue.includes("schema.org/docs/")) {
    let versionRegex = /.*schema\.org\/docs\/releases\.html#v([0-9.]+)(\/)?/g;
    let match = versionRegex.exec(schemaVersionValue);
    if (match && match[1]) {
      return match[1];
    }
  } else if (schemaVersionValue.includes("schema.org/version/")) {
    let versionRegex = /.*schema\.org\/version\/([0-9.]+)(\/)?/g;
    let match = versionRegex.exec(schemaVersionValue);
    if (match && match[1]) {
      return match[1];
    }
  }
  throw new Error(
    "The given url did not fit the expected format for a schema.org version url."
  );
};

module.exports = {
  getDsSpecificationVersion,
  prettyPrintCompactedIRI,
  extractSdoVersionNumber,
};

},{}],40:[function(require,module,exports){
/**
 * @file This file contains the functions used by DsUtilitiesV5
 */

/*
 * ===========================================
 * functions that handle the structure of DS
 * ===========================================
 */

const helper = require("./../../helperFunctions.js");
const data = require("./../data/dataV5.js");
const { extractSdoVersionNumber } = require("./functionsBase.js");
/**
 * Returns the root node of the given DS.
 *
 * @param ds {object} - The input DS
 * @return {object} - The detected root node of the DS
 */
const getDsRootNodeV5 = (ds) => {
  if (!ds["@graph"]) {
    throw new Error(
      "The given DS has no @graph array, which is mandatory for a DS in DS-V5 format."
    );
  }
  const rootNode = ds["@graph"].find(
    (el) =>
      Array.isArray(el["@type"]) &&
      el["@type"].includes("sh:NodeShape") &&
      el["@type"].includes("schema:CreativeWork")
  );
  if (!rootNode) {
    throw new Error(
      "The given DS has no identifiable root node in DS-V5 format."
    );
  }
  return rootNode;
};

/**
 * Returns the standard @context for DS-V5
 *
 * @return {object} - the standard @context for DS-V5
 */
const getDsStandardContextV5 = () => {
  return helper.jhcpy(data.standardContext);
};

/**
 * Returns the @id of the given DS (for DS-V5 this @id is found in the outermost object).
 * A DS @id is mandatory for DS-V5.
 *
 * @param ds {object} - the input DS
 * @return {string} - the @id of the given DS
 */
const getDsIdV5 = (ds) => {
  if (!ds["@id"]) {
    throw new Error(
      "The given DS has no @id, which is mandatory for a DS in DS-V5 format."
    );
  }
  return ds["@id"];
};

/**
 * Returns the name (schema:name) of the given DS.
 * schema:name is optional in DS-V5.
 *
 * @param ds {object} - the input DS
 * @return {?string} the name of the given DS
 */
const getDsNameV5 = (ds) => {
  const rootNode = getDsRootNodeV5(ds);
  if (rootNode["schema:name"]) {
    return rootNode["schema:name"];
  }
  return undefined;
};

/**
 * Returns the description (schema:description) of the given DS.
 * schema:description is optional in DS-V5.
 *
 * @param ds {object} - the input DS
 * @return {?string} the description of the given DS
 */
const getDsDescriptionV5 = (ds) => {
  const rootNode = getDsRootNodeV5(ds);
  if (rootNode["schema:description"]) {
    return rootNode["schema:description"];
  }
  return undefined;
};

/**
 * Returns the author name (schema:author -> schema:name) of the given DS.
 * schema:author is optional in DS-V5.
 *
 * @param ds {object} - the input DS
 * @return {?string} the author name of the given DS
 */
const getDsAuthorV5 = (ds) => {
  const rootNode = getDsRootNodeV5(ds);
  if (rootNode["schema:author"] && rootNode["schema:author"]["schema:name"]) {
    return rootNode["schema:author"]["schema:name"];
  }
  return undefined;
};

/**
 * Returns the used schema.org version (schema:schemaVersion) of the given DS.
 * schema:schemaVersion is mandatory in DS-V5.
 *
 * @param ds {object} - the input DS
 * @return {string} the schema.org version identifier as simple string, e.g. "11.0"
 */
const getDsSchemaVersionV5 = (ds) => {
  const rootNode = getDsRootNodeV5(ds);
  if (!rootNode["schema:schemaVersion"]) {
    throw new Error(
      "The given DS has no schema:schemaVersion for its root node, which is mandatory for a DS in DS-V5 format."
    );
  }
  return extractSdoVersionNumber(rootNode["schema:schemaVersion"]);
};

/**
 * Returns the version (schema:version) of the given DS.
 * schema:version is optional in DS-V5.
 *
 * @param ds {object} - the input DS
 * @return {?string} the ds version as simple string, e.g. "1.04"
 */
const getDsVersionV5 = (ds) => {
  const rootNode = getDsRootNodeV5(ds);
  if (rootNode["schema:version"]) {
    return rootNode["schema:version"];
  }
  return undefined;
};

/**
 * Returns the used external vocabularies (ds:usedVocabularies) of the given DS.
 * ds:usedVocabularies is optional in DS-V5.
 *
 * @param ds {object} - the input DS
 * @return {string[]} array with the used external vocabularies (empty if none)
 */
const getDsExternalVocabulariesV5 = (ds) => {
  const rootNode = getDsRootNodeV5(ds);
  if (rootNode["ds:usedVocabularies"]) {
    return rootNode["ds:usedVocabularies"];
  }
  return []; // instead of undefined, send an empty array for convenience
};

/**
 * Returns the target classes (sh:targetClass) of the given DS.
 * sh:targetClass is optional in DS-V5.
 *
 * @param ds {object} - the input DS
 * @return {string[]} array with the target classes
 */
const getDsTargetClassesV5 = (ds) => {
  const rootNode = getDsRootNodeV5(ds);
  if (!rootNode["sh:targetClass"]) {
    throw new Error(
      "The given DS has no sh:targetClass in its root node, which is mandatory for a DS in DS-V5 format."
    );
  }
  // return targetClass always as array for convenience
  if (!Array.isArray(rootNode["sh:targetClass"])) {
    return [rootNode["sh:targetClass"]];
  }
  return rootNode["sh:targetClass"];
};

module.exports = {
  getDsRootNodeV5,
  getDsStandardContextV5,
  getDsIdV5,
  getDsNameV5,
  getDsDescriptionV5,
  getDsAuthorV5,
  getDsSchemaVersionV5,
  getDsVersionV5,
  getDsExternalVocabulariesV5,
  getDsTargetClassesV5,
};

},{"./../../helperFunctions.js":32,"./../data/dataV5.js":37,"./functionsBase.js":39}],41:[function(require,module,exports){
/**
 * @file This file contains the functions used by DsUtilitiesV7
 */

const helper = require("./../../helperFunctions.js");
const data = require("./../data/dataV7.js");
const { customAlphabet } = require("nanoid");
const { isObject } = require("../../helperFunctions.js");

/*
 * ===========================================
 * functions that handle the structure of DS
 * ===========================================
 */

/**
 * Returns the root node of the given DS
 *
 * @param ds {object} - The input DS
 * @return {object} The detected root node of the DS
 */
const getDsRootNodeV7 = (ds) => {
  if (!ds["@graph"]) {
    throw new Error(
      "The given DS has no @graph array, which is mandatory for a DS in DS-V7 format."
    );
  }
  const rootNode = ds["@graph"].find(
    (el) => el["@type"] === "ds:DomainSpecification"
  );
  if (!rootNode) {
    throw new Error(
      "The given DS has no identifiable root node in DS-V7 format."
    );
  }
  return rootNode;
};

/**
 * Returns the standard @context for DS-V7
 *
 * @return {object} the standard @context for DS-V7
 */
const getDsStandardContextV7 = () => {
  return helper.jhcpy(data.standardContext);
};

/**
 * Returns the @id of the given DS (for DS-V7 this @id is found in the root node).
 * A DS @id is mandatory for DS-V7.
 *
 * @param ds  {object} - the input DS
 * @return {string} the @id of the given DS
 */
const getDsIdV7 = (ds) => {
  const rootNode = getDsRootNodeV7(ds);
  if (!rootNode["@id"]) {
    throw new Error(
      "The given DS has no @id for its root node, which is mandatory for a DS in DS-V7 format."
    );
  }
  return rootNode["@id"];
};

/**
 * Reorders all nodes of the given DS according to the DS specification for DS-V7
 *
 * @param ds  {object} - the input DS
 */
const reorderDsV7 = (ds) => {
  if (!isObject(ds)) {
    throw new Error("The given input was not an object, as required.");
  }
  // reorder the meta values (language-tagged strings) in a given array
  const reorderMetaValues = (valuesArray) => {
    for (const valObj of valuesArray) {
      helper.reorderNodeBasedOnNodeTermArray(
        valObj,
        data.nodeTermsLanguageTaggedValue
      );
    }
  };
  const reorderClassNode = (classNode) => {
    reorderDsNodeV7(classNode);
    if (classNode["schema:name"]) {
      reorderMetaValues(classNode["schema:name"]);
    }
    if (classNode["schema:description"]) {
      reorderMetaValues(classNode["schema:description"]);
    }
    if (classNode["sh:property"]) {
      for (const propertyNode of classNode["sh:property"]) {
        reorderPropertyNode(propertyNode);
      }
    }
  };
  const reorderPropertyNode = (propertyNode) => {
    reorderDsNodeV7(propertyNode);
    if (propertyNode["rdfs:comment"]) {
      reorderMetaValues(propertyNode["rdfs:comment"]);
    }
    for (const rangeNode of propertyNode["sh:or"]) {
      reorderDsNodeV7(rangeNode);
      if (rangeNode["sh:node"]) {
        reorderClassNode(rangeNode["sh:node"]);
      }
    }
  };
  // reorder DS object
  helper.reorderNodeBasedOnNodeTermArray(ds, data.nodeTermsDsObject);
  // reorder context
  helper.reorderNodeBasedOnNodeTermArray(
    ds["@context"],
    data.nodeTermsContext()
  );
  // reorder graph nodes (root node + internal references)
  // root node should be the first in the @graph array
  const indexOfRootNode = ds["@graph"].findIndex(
    (el) => el["@type"] === "ds:DomainSpecification"
  );
  if (indexOfRootNode !== 0) {
    ds["@graph"] = [
      ds["@graph"][indexOfRootNode],
      ...ds["@graph"].slice(0, indexOfRootNode),
      ...ds["@graph"].slice(indexOfRootNode + 1),
    ];
  }
  for (const graphNode of ds["@graph"]) {
    reorderClassNode(graphNode);
  }
};

/**
 * Reorders the given DS node according to the DS specification for DS-V7. The corresponding node type is detected automatically.
 *
 * @param dsNode
 */
const reorderDsNodeV7 = (dsNode) => {
  // automatically detect the dsNode type
  // ds object, context, root node, property node, class node, datatype node, enumeration node
  if (!isObject(dsNode)) {
    throw new Error("The given input was not an object, as required.");
  }
  if (dsNode["@type"]) {
    switch (dsNode["@type"]) {
      // root node
      case "ds:DomainSpecification":
        helper.reorderNodeBasedOnNodeTermArray(dsNode, data.nodeTermsRootNode);
        break;
      // property node
      case "sh:PropertyShape":
        helper.reorderNodeBasedOnNodeTermArray(
          dsNode,
          data.nodeTermsPropertyNode
        );
        break;
      // class node / enumeration node
      case "sh:NodeShape":
        if (dsNode["sh:in"]) {
          helper.reorderNodeBasedOnNodeTermArray(
            dsNode,
            data.nodeTermsEnumerationNode
          );
        } else {
          // class node (restricted, standard class, standard enumeration)
          helper.reorderNodeBasedOnNodeTermArray(
            dsNode,
            data.nodeTermsClassNode
          );
        }
        break;
    }
  } else if (dsNode["@context"]) {
    // ds object
    helper.reorderNodeBasedOnNodeTermArray(dsNode, data.nodeTermsDsObject);
  } else if (dsNode.ds && dsNode.schema && dsNode.sh) {
    // context
    helper.reorderNodeBasedOnNodeTermArray(dsNode, data.nodeTermsContext());
  } else if (dsNode["sh:datatype"]) {
    // datatype node
    helper.reorderNodeBasedOnNodeTermArray(dsNode, data.nodeTermsDataTypeNode);
  } else if (dsNode["sh:node"]) {
    // wrapper for class node / enumeration node - typically no term would be added here
  } else if (dsNode["@value"]) {
    // a language tagged-value
    helper.reorderNodeBasedOnNodeTermArray(
      dsNode,
      data.nodeTermsLanguageTaggedValue
    );
  }
};

/**
 * Creates a new fragment id according to the DS-V7 specification.
 * See https://gitbook.semantify.it/domainspecifications/ds-v7/devnotes#3-generating-ids-for-inner-nodeshape
 * It is possible to pass the current DS, this way it is ensured that the generated fragment id has not been used yet in the given DS
 *
 * @param {object} ds - the input DS (optional)
 * @return {string} returns a new the fragment id
 */
const generateInnerNodeIdV7 = (ds = undefined) => {
  let dsId;
  let newId;
  if (ds) {
    dsId = getDsIdV7(ds);
  }
  const nanoid = customAlphabet(
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz",
    5
  );
  do {
    newId = nanoid();
  } while (ds !== undefined && JSON.stringify(ds).includes(dsId + "#" + newId));
  return newId;
};

/*
 * ===========================================
 * functions for the handling of DS Paths
 * ===========================================
 */

const NODE_TYPE_ROOT = "RootNode";
const NODE_TYPE_PROPERTY = "Property";
const NODE_TYPE_CLASS = "Class";
const NODE_TYPE_ENUMERATION = "Enumeration";
const NODE_TYPE_DATATYPE = "DataType";
const NODE_TYPE_REF_ROOT = "RootReference";
const NODE_TYPE_REF_INTERNAL = "InternalReference";
const NODE_TYPE_REF_EXTERNAL = "ExternalReference";
const NODE_TYPE_REF_INTERNAL_EXTERNAL = "InternalExternalReference";
const NODE_TYPE_DEF_INTERNAL = "InternalReferenceDefinition";
const NODE_TYPE_DEF_EXTERNAL = "ExternalReferenceDefinition";
const NODE_TYPE_DEF_INTERNAL_EXTERNAL = "InternalExternalReferenceDefinition";
// "@context" is a special dsPath that points to the @context object of the DS

/**
 * Initializes a DS Path string, based on the given inputs
 *
 * @param [nodeType=RootNode] {string} - the type of the initial token, "RootNode" being the standard. Other possibilities are: "InternalReferenceDefinition", "ExternalReferenceDefinition", "InternalExternalReferenceDefinition"
 * @param [nodeId] {string} - the id of the node which starts the DS path (e.g. "https://semantify.it/ds/_1hRVOT8Q"). Can be left blank in case of "RootNode".
 * @return {string} - the generated DS Path
 */
const dsPathInitV7 = (nodeType = NODE_TYPE_ROOT, nodeId = undefined) => {
  switch (nodeType) {
    case NODE_TYPE_ROOT:
      return "$";
    case NODE_TYPE_DEF_INTERNAL:
      return "#" + nodeId.split("#")[1]; // nodeId = @id of the internal node, e.g. "https://semantify.it/ds/_1hRVOT8Q#sXZwe"
    case NODE_TYPE_DEF_EXTERNAL:
      return nodeId.split("/").pop(); // nodeId = @id of the external node, e.g. "https://semantify.it/ds/_1hRVOT8Q"
    case NODE_TYPE_DEF_INTERNAL_EXTERNAL:
      return nodeId.split("/").pop(); // nodeId = @id of the internal node from an external reference, e.g. "https://semantify.it/ds/_1hRVOT8Q#sXZwe"
    default:
      throw new Error("Unknown node type to initialize a DS Path: " + nodeType);
  }
};

/**
 * Appends a new token to a given DS Path. The inputs and additions depend on the token type to be added.
 *
 * @param dsPath {string} - the given DS Path to augment
 * @param additionType {string} - the kind of addition to be added
 * @param [inputForPath] {string|string[]} - input that depends on the given additionType, which is used for the dsPath addition
 * @return {string} - the resulting DS Path
 */
const dsPathAdditionV7 = (dsPath, additionType, inputForPath = undefined) => {
  // Property
  if (additionType === NODE_TYPE_PROPERTY) {
    return dsPath + "." + inputForPath; // inputForPath = IRI of Property, e.g. schema:url
  }
  // DataType
  if (additionType === NODE_TYPE_DATATYPE) {
    return dsPath + "/" + inputForPath; // inputForPath = IRI of DataType, e.g. xsd:string
  }
  // Class/Enumeration
  if (
    additionType === NODE_TYPE_CLASS ||
    additionType === NODE_TYPE_ENUMERATION
  ) {
    return dsPath + "/" + inputForPath.join(","); // inputForPath = sh:class array, e.g. ["schema:Room", "schema:Product"]
  }
  // Reference - Root Node
  if (additionType === NODE_TYPE_REF_ROOT) {
    return dsPath + "/@$"; // inputForPath is not needed
  }
  // Reference - Internal reference
  if (additionType === NODE_TYPE_REF_INTERNAL) {
    return dsPath + "/@#" + inputForPath.split("#")[1]; // inputForPath = @id of the internal node, e.g. "https://semantify.it/ds/_1hRVOT8Q#sXZwe"
  }
  // Reference - External reference
  if (additionType === NODE_TYPE_REF_EXTERNAL) {
    return dsPath + "/@" + inputForPath.split("/").pop(); // inputForPath = @id of the external node, e.g. "https://semantify.it/ds/_1hRVOT8Q"
  }
  // Reference - Internal node of an External reference
  if (additionType === NODE_TYPE_REF_INTERNAL_EXTERNAL) {
    return dsPath + "/@" + inputForPath.split("/").pop(); // inputForPath = @id of the internal node from an external reference, e.g. "https://semantify.it/ds/_1hRVOT8Q#sXZwe"
  }
};

/**
 * Returns a node within the given DS based on the given ds-path.
 *
 * @param ds {object} - The input DS
 * @param dsPath {string} - The input ds-path
 * @return {object} - The node at the given ds-path
 */
const dsPathGetNodeV7 = (ds, dsPath) => {
  // helper function to check if a given class combination array matches another class combination array
  function checkClassMatch(arr1, arr2) {
    return (
      !arr1.find((el) => !arr2.includes(el)) &&
      !arr2.find((el) => !arr1.includes(el))
    );
  }

  //  helper function - actDsObj is an array of ranges
  function getRangeNode(actDsObj, actRestPath, ds) {
    const rootNode = getDsRootNodeV7(ds);
    const pathTokens = actRestPath.split(".");
    const rangeToken = pathTokens[0];
    let actRange;
    let referencedNode;
    // reference node
    if (rangeToken.startsWith("@")) {
      if (rangeToken === "@$") {
        // root node reference
        actRange = actDsObj.find(
          (el) => el["sh:node"] && el["sh:node"]["@id"] === rootNode["@id"]
        );
        referencedNode = rootNode;
      } else if (rangeToken.startsWith("@#")) {
        // internal node reference
        actRange = actDsObj.find(
          (el) =>
            el["sh:node"] &&
            el["sh:node"]["@id"] === rootNode["@id"] + rangeToken.substring(1)
        );
        if (actRange) {
          referencedNode = ds["@graph"].find(
            (el) => el["@id"] === actRange["sh:node"]["@id"]
          );
        }
      } else {
        // external (internal) node reference
        actRange = actDsObj.find(
          (el) =>
            el["sh:node"] &&
            el["sh:node"]["@id"].endsWith(rangeToken.substring(1))
        );
        if (actRange) {
          referencedNode = ds["@graph"].find(
            (el) => el["@id"] === actRange["sh:node"]["@id"]
          );
        }
      }
    } else {
      actRange = actDsObj.find(
        (el) =>
          el["sh:datatype"] === pathTokens[0] ||
          (el["sh:node"] &&
            el["sh:node"]["sh:class"] &&
            checkClassMatch(
              el["sh:node"]["sh:class"],
              pathTokens[0].split(",")
            )) ||
          (el["sh:node"] &&
            el["sh:node"]["@id"].endsWith(pathTokens[0].substring(1)))
      );
    }
    if (!actRange) {
      throw new Error(
        "Could not find a fitting range-node for path-token " + pathTokens[0]
      );
    }
    if (pathTokens.length === 1) {
      if (actRange["sh:node"]) {
        return actRange["sh:node"];
      } else {
        return actRange;
      }
    } else {
      if (referencedNode) {
        return getPropertyNode(
          referencedNode["sh:property"],
          actRestPath.substring(pathTokens[0].length + 1),
          ds
        );
      } else {
        return getPropertyNode(
          actRange["sh:node"]["sh:property"],
          actRestPath.substring(pathTokens[0].length + 1),
          ds
        );
      }
    }
  }

  // helper function
  function getPropertyNode(actDsObj, actRestPath, ds) {
    const pathTokens = actRestPath.split("/");
    const actProp = actDsObj.find((el) => el["sh:path"] === pathTokens[0]);
    if (!actProp) {
      throw new Error(
        "Could not find a fitting property-node for path-token " + pathTokens[0]
      );
    }
    if (pathTokens.length === 1) {
      return actProp;
    } else {
      // check next token -> range
      return getRangeNode(
        actProp["sh:or"],
        actRestPath.substring(pathTokens[0].length + 1),
        ds
      );
    }
  }

  if (dsPath === "@context") {
    // special case for @context
    if (!ds["@context"]) {
      throw new Error(
        "The given DS has no @context, which is mandatory for a DS in DS-V7 format."
      );
    }
    return ds["@context"];
  } else if (dsPath.startsWith("$")) {
    // normal DS root
    const dsRoot = getDsRootNodeV7(ds);
    if (dsPath === "$") {
      return dsRoot;
    } else {
      return getPropertyNode(dsRoot["sh:property"], dsPath.substring(2), ds);
    }
  } else {
    // could be:
    // Internal reference definition
    // External reference definition
    // Internal node of an External reference
    const pathTokens = dsPath.split(".");
    const referenceDefinition = ds["@graph"].find((el) =>
      el["@id"].endsWith(pathTokens[0])
    );
    if (!referenceDefinition) {
      throw new Error(
        "Could not find a fitting reference definition for path-token " +
          pathTokens[0]
      );
    }
    if (pathTokens.length === 1) {
      return referenceDefinition;
    } else {
      return getPropertyNode(
        referenceDefinition["sh:property"],
        dsPath.substring(pathTokens[0].length + 1),
        ds
      );
    }
  }
};

/**
 * Returns the type/role of the given DS Node within the given DS
 *
 * @param dsNode {object?} - the input DS Node
 * @param ds {object} - the input DS
 * @return {string} the type of the given node
 */
const dsPathIdentifyNodeTypeV7 = (dsNode, ds) => {
  const rootNode = getDsRootNodeV7(ds);
  // if there is only 1 attribute that is @id, then this is a reference node
  if (dsNode["@id"] && Object.keys(dsNode).length === 1) {
    if (dsNode["@id"] === rootNode["@id"]) {
      return NODE_TYPE_REF_ROOT;
    } else if (dsNode["@id"].startsWith(rootNode["@id"])) {
      return NODE_TYPE_REF_INTERNAL;
    } else if (dsNode["@id"].charAt(dsNode["@id"].length - 6) === "#") {
      return NODE_TYPE_REF_INTERNAL_EXTERNAL;
    } else {
      return NODE_TYPE_REF_EXTERNAL;
    }
  }
  // nodes in @graph array
  if (dsNode["@type"] === "ds:DomainSpecification") {
    return NODE_TYPE_ROOT; // root node
  } else if (
    dsNode["@type"] === "sh:NodeShape" &&
    ds["@graph"].find((el) => el["@id"] === dsNode["@id"]) !== undefined
  ) {
    // a reference definition
    if (dsNode["@id"].startsWith(rootNode["@id"])) {
      return NODE_TYPE_DEF_INTERNAL;
    } else if (dsNode["@id"].charAt(dsNode["@id"].length - 6) === "#") {
      return NODE_TYPE_DEF_INTERNAL_EXTERNAL;
    } else {
      return NODE_TYPE_DEF_EXTERNAL;
    }
  }
  // other nodes
  if (dsNode["@type"] === "sh:PropertyShape") {
    return NODE_TYPE_PROPERTY;
  }
  if (dsNode["sh:datatype"] !== undefined) {
    return NODE_TYPE_DATATYPE;
  }
  if (dsNode["@type"] === "sh:NodeShape" && dsNode["sh:in"] !== undefined) {
    return NODE_TYPE_ENUMERATION;
  } else if (
    dsNode["@type"] === "sh:NodeShape" &&
    dsNode["sh:property"] !== undefined
  ) {
    return NODE_TYPE_CLASS;
  } else if (
    dsNode["@type"] === "sh:NodeShape" &&
    dsNode["sh:class"] !== undefined
  ) {
    // this could be a standard class or a standard enumeration, we can not tell for sure without SDO Adapter
    return NODE_TYPE_CLASS;
  }
};

/*
 * ===========================================
 * functions that ease the UI interaction with DS
 * ===========================================
 */

/**
 * Returns the name (schema:name) of the given DS.
 * schema:name is optional in DS-V7.
 *
 * @param ds {object} - the input DS
 * @param language {string?} - the wished language for the name (optional)
 * @return {?string} the name of the given DS
 */
const getDsNameV7 = (ds, language = undefined) => {
  const rootNode = getDsRootNodeV7(ds);
  if (rootNode["schema:name"]) {
    return helper.getLanguageString(rootNode["schema:name"], language);
  }
  return undefined;
};

/**
 * Returns the description (schema:description) of the given DS.
 * schema:description is optional in DS-V7.
 *
 * @param ds {object} - the input DS
 * @param language {string?} - the wished language for the description (optional)
 * @return {?string} the description of the given DS
 */
const getDsDescriptionV7 = (ds, language = undefined) => {
  const rootNode = getDsRootNodeV7(ds);
  if (rootNode["schema:description"]) {
    return helper.getLanguageString(rootNode["schema:description"], language);
  }
  return undefined;
};

/**
 * Returns the author name (schema:author -> schema:name) of the given DS.
 * schema:author is optional in DS-V7.
 *
 * @param ds {object} - the input DS
 * @return {?string} the author name of the given DS
 */
const getDsAuthorNameV7 = (ds) => {
  const rootNode = getDsRootNodeV7(ds);
  if (rootNode["schema:author"] && rootNode["schema:author"]["schema:name"]) {
    return rootNode["schema:author"]["schema:name"];
  }
  return undefined;
};

/**
 * Returns the used schema.org version (schema:schemaVersion) of the given DS.
 * schema:schemaVersion is mandatory in DS-V7.
 *
 * @param ds {object} - the input DS
 * @return {string} the schema.org version identifier as simple string, e.g. "11.0"
 */
const getDsSchemaVersionV7 = (ds) => {
  const rootNode = getDsRootNodeV7(ds);
  if (!rootNode["schema:schemaVersion"]) {
    throw new Error(
      "The given DS has no schema:schemaVersion for its root node, which is mandatory for a DS in DS-V7 format."
    );
  }
  return rootNode["schema:schemaVersion"];
};

/**
 * Returns the used ds version (schema:version) of the given DS.
 * schema:version is optional in DS-V7.
 *
 * @param ds {object} - the input DS
 * @return {?string} the ds version as simple string, e.g. "1.04"
 */
const getDsVersionV7 = (ds) => {
  const rootNode = getDsRootNodeV7(ds);
  if (rootNode["schema:version"]) {
    return rootNode["schema:version"];
  }
  return undefined;
};

/**
 * Returns the used external vocabularies (ds:usedVocabulary) of the given DS.
 * ds:usedVocabulary is optional in DS-V7.
 *
 * @param ds {object} - the input DS
 * @return {string[]} array with the used external vocabularies (empty if none)
 */
const getDsExternalVocabulariesV7 = (ds) => {
  const rootNode = getDsRootNodeV7(ds);
  if (rootNode["ds:usedVocabulary"]) {
    return rootNode["ds:usedVocabulary"];
  }
  return []; // instead of undefined, send an empty array for convenience
};

/**
 * Returns the target classes (sh:targetClass) of the given DS.
 * sh:targetClass is optional in DS-V7.
 *
 * @param ds {object} - the input DS
 * @return {string[]} array with the target classes (empty if none)
 */
const getDsTargetClassesV7 = (ds) => {
  const rootNode = getDsRootNodeV7(ds);
  if (rootNode["sh:targetClass"]) {
    return rootNode["sh:targetClass"];
  }
  return []; // instead of undefined, send an empty array for convenience
};

module.exports = {
  getDsRootNodeV7,
  getDsStandardContextV7,
  getDsIdV7,
  reorderDsV7,
  reorderDsNodeV7,
  generateInnerNodeIdV7,
  dsPathInitV7,
  dsPathAdditionV7,
  dsPathGetNodeV7,
  dsPathIdentifyNodeTypeV7,
  getDsNameV7,
  getDsDescriptionV7,
  getDsAuthorNameV7,
  getDsSchemaVersionV7,
  getDsVersionV7,
  getDsExternalVocabulariesV7,
  getDsTargetClassesV7,
};

},{"../../helperFunctions.js":32,"./../../helperFunctions.js":32,"./../data/dataV7.js":38,"nanoid":66}],42:[function(require,module,exports){
(function (global, factory) {
	typeof exports === 'object' && typeof module !== 'undefined' ? module.exports = factory() :
	typeof define === 'function' && define.amd ? define(factory) :
	(global.jsonFormatHighlight = factory());
}(this, (function () { 'use strict';

var defaultColors = {
  keyColor: 'dimgray',
  numberColor: 'lightskyblue',
  stringColor: 'lightcoral',
  trueColor: 'lightseagreen',
  falseColor: '#f66578',
  nullColor: 'cornflowerblue'
};

var entityMap = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
  '`': '&#x60;',
  '=': '&#x3D;'
};

function escapeHtml(html) {
  return String(html).replace(/[&<>"'`=]/g, function (s) {
    return entityMap[s];
  });
}

function index (json, colorOptions) {
  if ( colorOptions === void 0 ) colorOptions = {};

  var valueType = typeof json;
  if (valueType !== 'string') {
    json = JSON.stringify(json, null, 2) || valueType;
  }
  var colors = Object.assign({}, defaultColors, colorOptions);
  json = json.replace(/&/g, '&').replace(/</g, '<').replace(/>/g, '>');
  return json.replace(/("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+]?\d+)?)/g, function (match) {
    var color = colors.numberColor;
    var style = '';
    if (/^"/.test(match)) {
      if (/:$/.test(match)) {
        color = colors.keyColor;
      } else {
        color = colors.stringColor;
        match = '"' + escapeHtml(match.substr(1, match.length - 2)) + '"';
        style = 'word-wrap:break-word;white-space:pre-wrap;';
      }
    } else {
      color = /true/.test(match) ? colors.trueColor : /false/.test(match) ? colors.falseColor : /null/.test(match) ? colors.nullColor : color;
    }
    return ("<span style=\"" + style + "color:" + color + "\">" + match + "</span>");
  });
}

return index;

})));

},{}],43:[function(require,module,exports){
/*
 * Copyright (c) 2019 Digital Bazaar, Inc. All rights reserved.
 */
'use strict';

const {
  isArray: _isArray,
  isObject: _isObject,
  isString: _isString,
} = require('./types');
const {
  asArray: _asArray
} = require('./util');
const {prependBase} = require('./url');
const JsonLdError = require('./JsonLdError');
const ResolvedContext = require('./ResolvedContext');

const MAX_CONTEXT_URLS = 10;

module.exports = class ContextResolver {
  /**
   * Creates a ContextResolver.
   *
   * @param sharedCache a shared LRU cache with `get` and `set` APIs.
   */
  constructor({sharedCache}) {
    this.perOpCache = new Map();
    this.sharedCache = sharedCache;
  }

  async resolve({
    activeCtx, context, documentLoader, base, cycles = new Set()
  }) {
    // process `@context`
    if(context && _isObject(context) && context['@context']) {
      context = context['@context'];
    }

    // context is one or more contexts
    context = _asArray(context);

    // resolve each context in the array
    const allResolved = [];
    for(const ctx of context) {
      if(_isString(ctx)) {
        // see if `ctx` has been resolved before...
        let resolved = this._get(ctx);
        if(!resolved) {
          // not resolved yet, resolve
          resolved = await this._resolveRemoteContext(
            {activeCtx, url: ctx, documentLoader, base, cycles});
        }

        // add to output and continue
        if(_isArray(resolved)) {
          allResolved.push(...resolved);
        } else {
          allResolved.push(resolved);
        }
        continue;
      }
      if(ctx === null) {
        // handle `null` context, nothing to cache
        allResolved.push(new ResolvedContext({document: null}));
        continue;
      }
      if(!_isObject(ctx)) {
        _throwInvalidLocalContext(context);
      }
      // context is an object, get/create `ResolvedContext` for it
      const key = JSON.stringify(ctx);
      let resolved = this._get(key);
      if(!resolved) {
        // create a new static `ResolvedContext` and cache it
        resolved = new ResolvedContext({document: ctx});
        this._cacheResolvedContext({key, resolved, tag: 'static'});
      }
      allResolved.push(resolved);
    }

    return allResolved;
  }

  _get(key) {
    // get key from per operation cache; no `tag` is used with this cache so
    // any retrieved context will always be the same during a single operation
    let resolved = this.perOpCache.get(key);
    if(!resolved) {
      // see if the shared cache has a `static` entry for this URL
      const tagMap = this.sharedCache.get(key);
      if(tagMap) {
        resolved = tagMap.get('static');
        if(resolved) {
          this.perOpCache.set(key, resolved);
        }
      }
    }
    return resolved;
  }

  _cacheResolvedContext({key, resolved, tag}) {
    this.perOpCache.set(key, resolved);
    if(tag !== undefined) {
      let tagMap = this.sharedCache.get(key);
      if(!tagMap) {
        tagMap = new Map();
        this.sharedCache.set(key, tagMap);
      }
      tagMap.set(tag, resolved);
    }
    return resolved;
  }

  async _resolveRemoteContext({activeCtx, url, documentLoader, base, cycles}) {
    // resolve relative URL and fetch context
    url = prependBase(base, url);
    const {context, remoteDoc} = await this._fetchContext(
      {activeCtx, url, documentLoader, cycles});

    // update base according to remote document and resolve any relative URLs
    base = remoteDoc.documentUrl || url;
    _resolveContextUrls({context, base});

    // resolve, cache, and return context
    const resolved = await this.resolve(
      {activeCtx, context, documentLoader, base, cycles});
    this._cacheResolvedContext({key: url, resolved, tag: remoteDoc.tag});
    return resolved;
  }

  async _fetchContext({activeCtx, url, documentLoader, cycles}) {
    // check for max context URLs fetched during a resolve operation
    if(cycles.size > MAX_CONTEXT_URLS) {
      throw new JsonLdError(
        'Maximum number of @context URLs exceeded.',
        'jsonld.ContextUrlError',
        {
          code: activeCtx.processingMode === 'json-ld-1.0' ?
            'loading remote context failed' :
            'context overflow',
          max: MAX_CONTEXT_URLS
        });
    }

    // check for context URL cycle
    // shortcut to avoid extra work that would eventually hit the max above
    if(cycles.has(url)) {
      throw new JsonLdError(
        'Cyclical @context URLs detected.',
        'jsonld.ContextUrlError',
        {
          code: activeCtx.processingMode === 'json-ld-1.0' ?
            'recursive context inclusion' :
            'context overflow',
          url
        });
    }

    // track cycles
    cycles.add(url);

    let context;
    let remoteDoc;

    try {
      remoteDoc = await documentLoader(url);
      context = remoteDoc.document || null;
      // parse string context as JSON
      if(_isString(context)) {
        context = JSON.parse(context);
      }
    } catch(e) {
      throw new JsonLdError(
        'Dereferencing a URL did not result in a valid JSON-LD object. ' +
        'Possible causes are an inaccessible URL perhaps due to ' +
        'a same-origin policy (ensure the server uses CORS if you are ' +
        'using client-side JavaScript), too many redirects, a ' +
        'non-JSON response, or more than one HTTP Link Header was ' +
        'provided for a remote context.',
        'jsonld.InvalidUrl',
        {code: 'loading remote context failed', url, cause: e});
    }

    // ensure ctx is an object
    if(!_isObject(context)) {
      throw new JsonLdError(
        'Dereferencing a URL did not result in a JSON object. The ' +
        'response was valid JSON, but it was not a JSON object.',
        'jsonld.InvalidUrl', {code: 'invalid remote context', url});
    }

    // use empty context if no @context key is present
    if(!('@context' in context)) {
      context = {'@context': {}};
    } else {
      context = {'@context': context['@context']};
    }

    // append @context URL to context if given
    if(remoteDoc.contextUrl) {
      if(!_isArray(context['@context'])) {
        context['@context'] = [context['@context']];
      }
      context['@context'].push(remoteDoc.contextUrl);
    }

    return {context, remoteDoc};
  }
};

function _throwInvalidLocalContext(ctx) {
  throw new JsonLdError(
    'Invalid JSON-LD syntax; @context must be an object.',
    'jsonld.SyntaxError', {
      code: 'invalid local context', context: ctx
    });
}

/**
 * Resolve all relative `@context` URLs in the given context by inline
 * replacing them with absolute URLs.
 *
 * @param context the context.
 * @param base the base IRI to use to resolve relative IRIs.
 */
function _resolveContextUrls({context, base}) {
  if(!context) {
    return;
  }

  const ctx = context['@context'];

  if(_isString(ctx)) {
    context['@context'] = prependBase(base, ctx);
    return;
  }

  if(_isArray(ctx)) {
    for(let i = 0; i < ctx.length; ++i) {
      const element = ctx[i];
      if(_isString(element)) {
        ctx[i] = prependBase(base, element);
        continue;
      }
      if(_isObject(element)) {
        _resolveContextUrls({context: {'@context': element}, base});
      }
    }
    return;
  }

  if(!_isObject(ctx)) {
    // no @context URLs can be found in non-object
    return;
  }

  // ctx is an object, resolve any context URLs in terms
  for(const term in ctx) {
    _resolveContextUrls({context: ctx[term], base});
  }
}

},{"./JsonLdError":44,"./ResolvedContext":48,"./types":62,"./url":63,"./util":64}],44:[function(require,module,exports){
/*
 * Copyright (c) 2017 Digital Bazaar, Inc. All rights reserved.
 */
'use strict';

module.exports = class JsonLdError extends Error {
  /**
   * Creates a JSON-LD Error.
   *
   * @param msg the error message.
   * @param type the error type.
   * @param details the error details.
   */
  constructor(
    message = 'An unspecified JSON-LD error occurred.',
    name = 'jsonld.Error',
    details = {}) {
    super(message);
    this.name = name;
    this.message = message;
    this.details = details;
  }
};

},{}],45:[function(require,module,exports){
/*
 * Copyright (c) 2017 Digital Bazaar, Inc. All rights reserved.
 */
'use strict';

module.exports = jsonld => {
  class JsonLdProcessor {
    toString() {
      return '[object JsonLdProcessor]';
    }
  }
  Object.defineProperty(JsonLdProcessor, 'prototype', {
    writable: false,
    enumerable: false
  });
  Object.defineProperty(JsonLdProcessor.prototype, 'constructor', {
    writable: true,
    enumerable: false,
    configurable: true,
    value: JsonLdProcessor
  });

  // The Web IDL test harness will check the number of parameters defined in
  // the functions below. The number of parameters must exactly match the
  // required (non-optional) parameters of the JsonLdProcessor interface as
  // defined here:
  // https://www.w3.org/TR/json-ld-api/#the-jsonldprocessor-interface

  JsonLdProcessor.compact = function(input, ctx) {
    if(arguments.length < 2) {
      return Promise.reject(
        new TypeError('Could not compact, too few arguments.'));
    }
    return jsonld.compact(input, ctx);
  };
  JsonLdProcessor.expand = function(input) {
    if(arguments.length < 1) {
      return Promise.reject(
        new TypeError('Could not expand, too few arguments.'));
    }
    return jsonld.expand(input);
  };
  JsonLdProcessor.flatten = function(input) {
    if(arguments.length < 1) {
      return Promise.reject(
        new TypeError('Could not flatten, too few arguments.'));
    }
    return jsonld.flatten(input);
  };

  return JsonLdProcessor;
};

},{}],46:[function(require,module,exports){
/*
 * Copyright (c) 2017 Digital Bazaar, Inc. All rights reserved.
 */
'use strict';

// TODO: move `NQuads` to its own package
module.exports = require('rdf-canonize').NQuads;

},{"rdf-canonize":69}],47:[function(require,module,exports){
/*
 * Copyright (c) 2017-2019 Digital Bazaar, Inc. All rights reserved.
 */
'use strict';

module.exports = class RequestQueue {
  /**
   * Creates a simple queue for requesting documents.
   */
  constructor() {
    this._requests = {};
  }

  wrapLoader(loader) {
    const self = this;
    self._loader = loader;
    return function(/* url */) {
      return self.add.apply(self, arguments);
    };
  }

  async add(url) {
    let promise = this._requests[url];
    if(promise) {
      // URL already queued, wait for it to load
      return Promise.resolve(promise);
    }

    // queue URL and load it
    promise = this._requests[url] = this._loader(url);

    try {
      return await promise;
    } finally {
      delete this._requests[url];
    }
  }
};

},{}],48:[function(require,module,exports){
/*
 * Copyright (c) 2019 Digital Bazaar, Inc. All rights reserved.
 */
'use strict';

const LRU = require('lru-cache');

const MAX_ACTIVE_CONTEXTS = 10;

module.exports = class ResolvedContext {
  /**
   * Creates a ResolvedContext.
   *
   * @param document the context document.
   */
  constructor({document}) {
    this.document = document;
    // TODO: enable customization of processed context cache
    // TODO: limit based on size of processed contexts vs. number of them
    this.cache = new LRU({max: MAX_ACTIVE_CONTEXTS});
  }

  getProcessed(activeCtx) {
    return this.cache.get(activeCtx);
  }

  setProcessed(activeCtx, processedCtx) {
    this.cache.set(activeCtx, processedCtx);
  }
};

},{"lru-cache":65}],49:[function(require,module,exports){
/*
 * Copyright (c) 2017 Digital Bazaar, Inc. All rights reserved.
 */
'use strict';

const JsonLdError = require('./JsonLdError');

const {
  isArray: _isArray,
  isObject: _isObject,
  isString: _isString,
  isUndefined: _isUndefined
} = require('./types');

const {
  isList: _isList,
  isValue: _isValue,
  isGraph: _isGraph,
  isSimpleGraph: _isSimpleGraph,
  isSubjectReference: _isSubjectReference
} = require('./graphTypes');

const {
  expandIri: _expandIri,
  getContextValue: _getContextValue,
  isKeyword: _isKeyword,
  process: _processContext,
  processingMode: _processingMode
} = require('./context');

const {
  removeBase: _removeBase,
  prependBase: _prependBase
} = require('./url');

const {
  addValue: _addValue,
  asArray: _asArray,
  compareShortestLeast: _compareShortestLeast
} = require('./util');

const api = {};
module.exports = api;

/**
 * Recursively compacts an element using the given active context. All values
 * must be in expanded form before this method is called.
 *
 * @param activeCtx the active context to use.
 * @param activeProperty the compacted property associated with the element
 *          to compact, null for none.
 * @param element the element to compact.
 * @param options the compaction options.
 * @param compactionMap the compaction map to use.
 *
 * @return a promise that resolves to the compacted value.
 */
api.compact = async ({
  activeCtx,
  activeProperty = null,
  element,
  options = {},
  compactionMap = () => undefined
}) => {
  // recursively compact array
  if(_isArray(element)) {
    let rval = [];
    for(let i = 0; i < element.length; ++i) {
      // compact, dropping any null values unless custom mapped
      let compacted = await api.compact({
        activeCtx,
        activeProperty,
        element: element[i],
        options,
        compactionMap
      });
      if(compacted === null) {
        compacted = await compactionMap({
          unmappedValue: element[i],
          activeCtx,
          activeProperty,
          parent: element,
          index: i,
          options
        });
        if(compacted === undefined) {
          continue;
        }
      }
      rval.push(compacted);
    }
    if(options.compactArrays && rval.length === 1) {
      // use single element if no container is specified
      const container = _getContextValue(
        activeCtx, activeProperty, '@container') || [];
      if(container.length === 0) {
        rval = rval[0];
      }
    }
    return rval;
  }

  // use any scoped context on activeProperty
  const ctx = _getContextValue(activeCtx, activeProperty, '@context');
  if(!_isUndefined(ctx)) {
    activeCtx = await _processContext({
      activeCtx,
      localCtx: ctx,
      propagate: true,
      overrideProtected: true,
      options
    });
  }

  // recursively compact object
  if(_isObject(element)) {
    if(options.link && '@id' in element &&
      options.link.hasOwnProperty(element['@id'])) {
      // check for a linked element to reuse
      const linked = options.link[element['@id']];
      for(let i = 0; i < linked.length; ++i) {
        if(linked[i].expanded === element) {
          return linked[i].compacted;
        }
      }
    }

    // do value compaction on @values and subject references
    if(_isValue(element) || _isSubjectReference(element)) {
      const rval =
        api.compactValue({activeCtx, activeProperty, value: element, options});
      if(options.link && _isSubjectReference(element)) {
        // store linked element
        if(!(options.link.hasOwnProperty(element['@id']))) {
          options.link[element['@id']] = [];
        }
        options.link[element['@id']].push({expanded: element, compacted: rval});
      }
      return rval;
    }

    // if expanded property is @list and we're contained within a list
    // container, recursively compact this item to an array
    if(_isList(element)) {
      const container = _getContextValue(
        activeCtx, activeProperty, '@container') || [];
      if(container.includes('@list')) {
        return api.compact({
          activeCtx,
          activeProperty,
          element: element['@list'],
          options,
          compactionMap
        });
      }
    }

    // FIXME: avoid misuse of active property as an expanded property?
    const insideReverse = (activeProperty === '@reverse');

    const rval = {};

    // original context before applying property-scoped and local contexts
    const inputCtx = activeCtx;

    // revert to previous context, if there is one,
    // and element is not a value object or a node reference
    if(!_isValue(element) && !_isSubjectReference(element)) {
      activeCtx = activeCtx.revertToPreviousContext();
    }

    // apply property-scoped context after reverting term-scoped context
    const propertyScopedCtx =
      _getContextValue(inputCtx, activeProperty, '@context');
    if(!_isUndefined(propertyScopedCtx)) {
      activeCtx = await _processContext({
        activeCtx,
        localCtx: propertyScopedCtx,
        propagate: true,
        overrideProtected: true,
        options
      });
    }

    if(options.link && '@id' in element) {
      // store linked element
      if(!options.link.hasOwnProperty(element['@id'])) {
        options.link[element['@id']] = [];
      }
      options.link[element['@id']].push({expanded: element, compacted: rval});
    }

    // apply any context defined on an alias of @type
    // if key is @type and any compacted value is a term having a local
    // context, overlay that context
    let types = element['@type'] || [];
    if(types.length > 1) {
      types = Array.from(types).sort();
    }
    // find all type-scoped contexts based on current context, prior to
    // updating it
    const typeContext = activeCtx;
    for(const type of types) {
      const compactedType = api.compactIri(
        {activeCtx: typeContext, iri: type, relativeTo: {vocab: true}});

      // Use any type-scoped context defined on this value
      const ctx = _getContextValue(inputCtx, compactedType, '@context');
      if(!_isUndefined(ctx)) {
        activeCtx = await _processContext({
          activeCtx,
          localCtx: ctx,
          options,
          propagate: false
        });
      }
    }

    // process element keys in order
    const keys = Object.keys(element).sort();
    for(const expandedProperty of keys) {
      const expandedValue = element[expandedProperty];

      // compact @id
      if(expandedProperty === '@id') {
        let compactedValue = _asArray(expandedValue).map(
          expandedIri => api.compactIri({
            activeCtx,
            iri: expandedIri,
            relativeTo: {vocab: false},
            base: options.base
          }));
        if(compactedValue.length === 1) {
          compactedValue = compactedValue[0];
        }

        // use keyword alias and add value
        const alias = api.compactIri(
          {activeCtx, iri: '@id', relativeTo: {vocab: true}});

        rval[alias] = compactedValue;
        continue;
      }

      // compact @type(s)
      if(expandedProperty === '@type') {
        // resolve type values against previous context
        let compactedValue = _asArray(expandedValue).map(
          expandedIri => api.compactIri({
            activeCtx: inputCtx,
            iri: expandedIri,
            relativeTo: {vocab: true}
          }));
        if(compactedValue.length === 1) {
          compactedValue = compactedValue[0];
        }

        // use keyword alias and add value
        const alias = api.compactIri(
          {activeCtx, iri: '@type', relativeTo: {vocab: true}});
        const container = _getContextValue(
          activeCtx, alias, '@container') || [];

        // treat as array for @type if @container includes @set
        const typeAsSet =
          container.includes('@set') &&
          _processingMode(activeCtx, 1.1);
        const isArray =
          typeAsSet || (_isArray(compactedValue) && expandedValue.length === 0);
        _addValue(rval, alias, compactedValue, {propertyIsArray: isArray});
        continue;
      }

      // handle @reverse
      if(expandedProperty === '@reverse') {
        // recursively compact expanded value
        const compactedValue = await api.compact({
          activeCtx,
          activeProperty: '@reverse',
          element: expandedValue,
          options,
          compactionMap
        });

        // handle double-reversed properties
        for(const compactedProperty in compactedValue) {
          if(activeCtx.mappings.has(compactedProperty) &&
            activeCtx.mappings.get(compactedProperty).reverse) {
            const value = compactedValue[compactedProperty];
            const container = _getContextValue(
              activeCtx, compactedProperty, '@container') || [];
            const useArray = (
              container.includes('@set') || !options.compactArrays);
            _addValue(
              rval, compactedProperty, value, {propertyIsArray: useArray});
            delete compactedValue[compactedProperty];
          }
        }

        if(Object.keys(compactedValue).length > 0) {
          // use keyword alias and add value
          const alias = api.compactIri({
            activeCtx,
            iri: expandedProperty,
            relativeTo: {vocab: true}
          });
          _addValue(rval, alias, compactedValue);
        }

        continue;
      }

      if(expandedProperty === '@preserve') {
        // compact using activeProperty
        const compactedValue = await api.compact({
          activeCtx,
          activeProperty,
          element: expandedValue,
          options,
          compactionMap
        });

        if(!(_isArray(compactedValue) && compactedValue.length === 0)) {
          _addValue(rval, expandedProperty, compactedValue);
        }
        continue;
      }

      // handle @index property
      if(expandedProperty === '@index') {
        // drop @index if inside an @index container
        const container = _getContextValue(
          activeCtx, activeProperty, '@container') || [];
        if(container.includes('@index')) {
          continue;
        }

        // use keyword alias and add value
        const alias = api.compactIri({
          activeCtx,
          iri: expandedProperty,
          relativeTo: {vocab: true}
        });
        _addValue(rval, alias, expandedValue);
        continue;
      }

      // skip array processing for keywords that aren't
      // @graph, @list, or @included
      if(expandedProperty !== '@graph' && expandedProperty !== '@list' &&
        expandedProperty !== '@included' &&
        _isKeyword(expandedProperty)) {
        // use keyword alias and add value as is
        const alias = api.compactIri({
          activeCtx,
          iri: expandedProperty,
          relativeTo: {vocab: true}
        });
        _addValue(rval, alias, expandedValue);
        continue;
      }

      // Note: expanded value must be an array due to expansion algorithm.
      if(!_isArray(expandedValue)) {
        throw new JsonLdError(
          'JSON-LD expansion error; expanded value must be an array.',
          'jsonld.SyntaxError');
      }

      // preserve empty arrays
      if(expandedValue.length === 0) {
        const itemActiveProperty = api.compactIri({
          activeCtx,
          iri: expandedProperty,
          value: expandedValue,
          relativeTo: {vocab: true},
          reverse: insideReverse
        });
        const nestProperty = activeCtx.mappings.has(itemActiveProperty) ?
          activeCtx.mappings.get(itemActiveProperty)['@nest'] : null;
        let nestResult = rval;
        if(nestProperty) {
          _checkNestProperty(activeCtx, nestProperty, options);
          if(!_isObject(rval[nestProperty])) {
            rval[nestProperty] = {};
          }
          nestResult = rval[nestProperty];
        }
        _addValue(
          nestResult, itemActiveProperty, expandedValue, {
            propertyIsArray: true
          });
      }

      // recusively process array values
      for(const expandedItem of expandedValue) {
        // compact property and get container type
        const itemActiveProperty = api.compactIri({
          activeCtx,
          iri: expandedProperty,
          value: expandedItem,
          relativeTo: {vocab: true},
          reverse: insideReverse
        });

        // if itemActiveProperty is a @nest property, add values to nestResult,
        // otherwise rval
        const nestProperty = activeCtx.mappings.has(itemActiveProperty) ?
          activeCtx.mappings.get(itemActiveProperty)['@nest'] : null;
        let nestResult = rval;
        if(nestProperty) {
          _checkNestProperty(activeCtx, nestProperty, options);
          if(!_isObject(rval[nestProperty])) {
            rval[nestProperty] = {};
          }
          nestResult = rval[nestProperty];
        }

        const container = _getContextValue(
          activeCtx, itemActiveProperty, '@container') || [];

        // get simple @graph or @list value if appropriate
        const isGraph = _isGraph(expandedItem);
        const isList = _isList(expandedItem);
        let inner;
        if(isList) {
          inner = expandedItem['@list'];
        } else if(isGraph) {
          inner = expandedItem['@graph'];
        }

        // recursively compact expanded item
        let compactedItem = await api.compact({
          activeCtx,
          activeProperty: itemActiveProperty,
          element: (isList || isGraph) ? inner : expandedItem,
          options,
          compactionMap
        });

        // handle @list
        if(isList) {
          // ensure @list value is an array
          if(!_isArray(compactedItem)) {
            compactedItem = [compactedItem];
          }

          if(!container.includes('@list')) {
            // wrap using @list alias
            compactedItem = {
              [api.compactIri({
                activeCtx,
                iri: '@list',
                relativeTo: {vocab: true}
              })]: compactedItem
            };

            // include @index from expanded @list, if any
            if('@index' in expandedItem) {
              compactedItem[api.compactIri({
                activeCtx,
                iri: '@index',
                relativeTo: {vocab: true}
              })] = expandedItem['@index'];
            }
          } else {
            _addValue(nestResult, itemActiveProperty, compactedItem, {
              valueIsArray: true,
              allowDuplicate: true
            });
            continue;
          }
        }

        // Graph object compaction cases
        if(isGraph) {
          if(container.includes('@graph') && (container.includes('@id') ||
            container.includes('@index') && _isSimpleGraph(expandedItem))) {
            // get or create the map object
            let mapObject;
            if(nestResult.hasOwnProperty(itemActiveProperty)) {
              mapObject = nestResult[itemActiveProperty];
            } else {
              nestResult[itemActiveProperty] = mapObject = {};
            }

            // index on @id or @index or alias of @none
            const key = (container.includes('@id') ?
              expandedItem['@id'] : expandedItem['@index']) ||
              api.compactIri({activeCtx, iri: '@none',
                relativeTo: {vocab: true}});
            // add compactedItem to map, using value of `@id` or a new blank
            // node identifier

            _addValue(
              mapObject, key, compactedItem, {
                propertyIsArray:
                  (!options.compactArrays || container.includes('@set'))
              });
          } else if(container.includes('@graph') &&
            _isSimpleGraph(expandedItem)) {
            // container includes @graph but not @id or @index and value is a
            // simple graph object add compact value
            // if compactedItem contains multiple values, it is wrapped in
            // `@included`
            if(_isArray(compactedItem) && compactedItem.length > 1) {
              compactedItem = {'@included': compactedItem};
            }
            _addValue(
              nestResult, itemActiveProperty, compactedItem, {
                propertyIsArray:
                  (!options.compactArrays || container.includes('@set'))
              });
          } else {
            // wrap using @graph alias, remove array if only one item and
            // compactArrays not set
            if(_isArray(compactedItem) && compactedItem.length === 1 &&
              options.compactArrays) {
              compactedItem = compactedItem[0];
            }
            compactedItem = {
              [api.compactIri({
                activeCtx,
                iri: '@graph',
                relativeTo: {vocab: true}
              })]: compactedItem
            };

            // include @id from expanded graph, if any
            if('@id' in expandedItem) {
              compactedItem[api.compactIri({
                activeCtx,
                iri: '@id',
                relativeTo: {vocab: true}
              })] = expandedItem['@id'];
            }

            // include @index from expanded graph, if any
            if('@index' in expandedItem) {
              compactedItem[api.compactIri({
                activeCtx,
                iri: '@index',
                relativeTo: {vocab: true}
              })] = expandedItem['@index'];
            }
            _addValue(
              nestResult, itemActiveProperty, compactedItem, {
                propertyIsArray:
                  (!options.compactArrays || container.includes('@set'))
              });
          }
        } else if(container.includes('@language') ||
          container.includes('@index') || container.includes('@id') ||
          container.includes('@type')) {
          // handle language and index maps
          // get or create the map object
          let mapObject;
          if(nestResult.hasOwnProperty(itemActiveProperty)) {
            mapObject = nestResult[itemActiveProperty];
          } else {
            nestResult[itemActiveProperty] = mapObject = {};
          }

          let key;
          if(container.includes('@language')) {
          // if container is a language map, simplify compacted value to
          // a simple string
            if(_isValue(compactedItem)) {
              compactedItem = compactedItem['@value'];
            }
            key = expandedItem['@language'];
          } else if(container.includes('@index')) {
            const indexKey = _getContextValue(
              activeCtx, itemActiveProperty, '@index') || '@index';
            const containerKey = api.compactIri(
              {activeCtx, iri: indexKey, relativeTo: {vocab: true}});
            if(indexKey === '@index') {
              key = expandedItem['@index'];
              delete compactedItem[containerKey];
            } else {
              let others;
              [key, ...others] = _asArray(compactedItem[indexKey] || []);
              if(!_isString(key)) {
                // Will use @none if it isn't a string.
                key = null;
              } else {
                switch(others.length) {
                  case 0:
                    delete compactedItem[indexKey];
                    break;
                  case 1:
                    compactedItem[indexKey] = others[0];
                    break;
                  default:
                    compactedItem[indexKey] = others;
                    break;
                }
              }
            }
          } else if(container.includes('@id')) {
            const idKey = api.compactIri({activeCtx, iri: '@id',
              relativeTo: {vocab: true}});
            key = compactedItem[idKey];
            delete compactedItem[idKey];
          } else if(container.includes('@type')) {
            const typeKey = api.compactIri({
              activeCtx,
              iri: '@type',
              relativeTo: {vocab: true}
            });
            let types;
            [key, ...types] = _asArray(compactedItem[typeKey] || []);
            switch(types.length) {
              case 0:
                delete compactedItem[typeKey];
                break;
              case 1:
                compactedItem[typeKey] = types[0];
                break;
              default:
                compactedItem[typeKey] = types;
                break;
            }

            // If compactedItem contains a single entry
            // whose key maps to @id, recompact without @type
            if(Object.keys(compactedItem).length === 1 &&
              '@id' in expandedItem) {
              compactedItem = await api.compact({
                activeCtx,
                activeProperty: itemActiveProperty,
                element: {'@id': expandedItem['@id']},
                options,
                compactionMap
              });
            }
          }

          // if compacting this value which has no key, index on @none
          if(!key) {
            key = api.compactIri({activeCtx, iri: '@none',
              relativeTo: {vocab: true}});
          }
          // add compact value to map object using key from expanded value
          // based on the container type
          _addValue(
            mapObject, key, compactedItem, {
              propertyIsArray: container.includes('@set')
            });
        } else {
          // use an array if: compactArrays flag is false,
          // @container is @set or @list , value is an empty
          // array, or key is @graph
          const isArray = (!options.compactArrays ||
            container.includes('@set') || container.includes('@list') ||
            (_isArray(compactedItem) && compactedItem.length === 0) ||
            expandedProperty === '@list' || expandedProperty === '@graph');

          // add compact value
          _addValue(
            nestResult, itemActiveProperty, compactedItem,
            {propertyIsArray: isArray});
        }
      }
    }

    return rval;
  }

  // only primitives remain which are already compact
  return element;
};

/**
 * Compacts an IRI or keyword into a term or prefix if it can be. If the
 * IRI has an associated value it may be passed.
 *
 * @param activeCtx the active context to use.
 * @param iri the IRI to compact.
 * @param value the value to check or null.
 * @param relativeTo options for how to compact IRIs:
 *          vocab: true to split after @vocab, false not to.
 * @param reverse true if a reverse property is being compacted, false if not.
 * @param base the absolute URL to use for compacting document-relative IRIs.
 *
 * @return the compacted term, prefix, keyword alias, or the original IRI.
 */
api.compactIri = ({
  activeCtx,
  iri,
  value = null,
  relativeTo = {vocab: false},
  reverse = false,
  base = null
}) => {
  // can't compact null
  if(iri === null) {
    return iri;
  }

  // if context is from a property term scoped context composed with a
  // type-scoped context, then use the previous context instead
  if(activeCtx.isPropertyTermScoped && activeCtx.previousContext) {
    activeCtx = activeCtx.previousContext;
  }

  const inverseCtx = activeCtx.getInverse();

  // if term is a keyword, it may be compacted to a simple alias
  if(_isKeyword(iri) &&
    iri in inverseCtx &&
    '@none' in inverseCtx[iri] &&
    '@type' in inverseCtx[iri]['@none'] &&
    '@none' in inverseCtx[iri]['@none']['@type']) {
    return inverseCtx[iri]['@none']['@type']['@none'];
  }

  // use inverse context to pick a term if iri is relative to vocab
  if(relativeTo.vocab && iri in inverseCtx) {
    const defaultLanguage = activeCtx['@language'] || '@none';

    // prefer @index if available in value
    const containers = [];
    if(_isObject(value) && '@index' in value && !('@graph' in value)) {
      containers.push('@index', '@index@set');
    }

    // if value is a preserve object, use its value
    if(_isObject(value) && '@preserve' in value) {
      value = value['@preserve'][0];
    }

    // prefer most specific container including @graph, prefering @set
    // variations
    if(_isGraph(value)) {
      // favor indexmap if the graph is indexed
      if('@index' in value) {
        containers.push(
          '@graph@index', '@graph@index@set', '@index', '@index@set');
      }
      // favor idmap if the graph is has an @id
      if('@id' in value) {
        containers.push(
          '@graph@id', '@graph@id@set');
      }
      containers.push('@graph', '@graph@set', '@set');
      // allow indexmap if the graph is not indexed
      if(!('@index' in value)) {
        containers.push(
          '@graph@index', '@graph@index@set', '@index', '@index@set');
      }
      // allow idmap if the graph does not have an @id
      if(!('@id' in value)) {
        containers.push('@graph@id', '@graph@id@set');
      }
    } else if(_isObject(value) && !_isValue(value)) {
      containers.push('@id', '@id@set', '@type', '@set@type');
    }

    // defaults for term selection based on type/language
    let typeOrLanguage = '@language';
    let typeOrLanguageValue = '@null';

    if(reverse) {
      typeOrLanguage = '@type';
      typeOrLanguageValue = '@reverse';
      containers.push('@set');
    } else if(_isList(value)) {
      // choose the most specific term that works for all elements in @list
      // only select @list containers if @index is NOT in value
      if(!('@index' in value)) {
        containers.push('@list');
      }
      const list = value['@list'];
      if(list.length === 0) {
        // any empty list can be matched against any term that uses the
        // @list container regardless of @type or @language
        typeOrLanguage = '@any';
        typeOrLanguageValue = '@none';
      } else {
        let commonLanguage = (list.length === 0) ? defaultLanguage : null;
        let commonType = null;
        for(let i = 0; i < list.length; ++i) {
          const item = list[i];
          let itemLanguage = '@none';
          let itemType = '@none';
          if(_isValue(item)) {
            if('@direction' in item) {
              const lang = (item['@language'] || '').toLowerCase();
              const dir = item['@direction'];
              itemLanguage = `${lang}_${dir}`;
            } else if('@language' in item) {
              itemLanguage = item['@language'].toLowerCase();
            } else if('@type' in item) {
              itemType = item['@type'];
            } else {
              // plain literal
              itemLanguage = '@null';
            }
          } else {
            itemType = '@id';
          }
          if(commonLanguage === null) {
            commonLanguage = itemLanguage;
          } else if(itemLanguage !== commonLanguage && _isValue(item)) {
            commonLanguage = '@none';
          }
          if(commonType === null) {
            commonType = itemType;
          } else if(itemType !== commonType) {
            commonType = '@none';
          }
          // there are different languages and types in the list, so choose
          // the most generic term, no need to keep iterating the list
          if(commonLanguage === '@none' && commonType === '@none') {
            break;
          }
        }
        commonLanguage = commonLanguage || '@none';
        commonType = commonType || '@none';
        if(commonType !== '@none') {
          typeOrLanguage = '@type';
          typeOrLanguageValue = commonType;
        } else {
          typeOrLanguageValue = commonLanguage;
        }
      }
    } else {
      if(_isValue(value)) {
        if('@language' in value && !('@index' in value)) {
          containers.push('@language', '@language@set');
          typeOrLanguageValue = value['@language'];
          const dir = value['@direction'];
          if(dir) {
            typeOrLanguageValue = `${typeOrLanguageValue}_${dir}`;
          }
        } else if('@direction' in value && !('@index' in value)) {
          typeOrLanguageValue = `_${value['@direction']}`;
        } else if('@type' in value) {
          typeOrLanguage = '@type';
          typeOrLanguageValue = value['@type'];
        }
      } else {
        typeOrLanguage = '@type';
        typeOrLanguageValue = '@id';
      }
      containers.push('@set');
    }

    // do term selection
    containers.push('@none');

    // an index map can be used to index values using @none, so add as a low
    // priority
    if(_isObject(value) && !('@index' in value)) {
      // allow indexing even if no @index present
      containers.push('@index', '@index@set');
    }

    // values without type or language can use @language map
    if(_isValue(value) && Object.keys(value).length === 1) {
      // allow indexing even if no @index present
      containers.push('@language', '@language@set');
    }

    const term = _selectTerm(
      activeCtx, iri, value, containers, typeOrLanguage, typeOrLanguageValue);
    if(term !== null) {
      return term;
    }
  }

  // no term match, use @vocab if available
  if(relativeTo.vocab) {
    if('@vocab' in activeCtx) {
      // determine if vocab is a prefix of the iri
      const vocab = activeCtx['@vocab'];
      if(iri.indexOf(vocab) === 0 && iri !== vocab) {
        // use suffix as relative iri if it is not a term in the active context
        const suffix = iri.substr(vocab.length);
        if(!activeCtx.mappings.has(suffix)) {
          return suffix;
        }
      }
    }
  }

  // no term or @vocab match, check for possible CURIEs
  let choice = null;
  // TODO: make FastCurieMap a class with a method to do this lookup
  const partialMatches = [];
  let iriMap = activeCtx.fastCurieMap;
  // check for partial matches of against `iri`, which means look until
  // iri.length - 1, not full length
  const maxPartialLength = iri.length - 1;
  for(let i = 0; i < maxPartialLength && iri[i] in iriMap; ++i) {
    iriMap = iriMap[iri[i]];
    if('' in iriMap) {
      partialMatches.push(iriMap[''][0]);
    }
  }
  // check partial matches in reverse order to prefer longest ones first
  for(let i = partialMatches.length - 1; i >= 0; --i) {
    const entry = partialMatches[i];
    const terms = entry.terms;
    for(const term of terms) {
      // a CURIE is usable if:
      // 1. it has no mapping, OR
      // 2. value is null, which means we're not compacting an @value, AND
      //   the mapping matches the IRI
      const curie = term + ':' + iri.substr(entry.iri.length);
      const isUsableCurie = (activeCtx.mappings.get(term)._prefix &&
        (!activeCtx.mappings.has(curie) ||
        (value === null && activeCtx.mappings.get(curie)['@id'] === iri)));

      // select curie if it is shorter or the same length but lexicographically
      // less than the current choice
      if(isUsableCurie && (choice === null ||
        _compareShortestLeast(curie, choice) < 0)) {
        choice = curie;
      }
    }
  }

  // return chosen curie
  if(choice !== null) {
    return choice;
  }

  // If iri could be confused with a compact IRI using a term in this context,
  // signal an error
  for(const [term, td] of activeCtx.mappings) {
    if(td && td._prefix && iri.startsWith(term + ':')) {
      throw new JsonLdError(
        `Absolute IRI "${iri}" confused with prefix "${term}".`,
        'jsonld.SyntaxError',
        {code: 'IRI confused with prefix', context: activeCtx});
    }
  }

  // compact IRI relative to base
  if(!relativeTo.vocab) {
    if('@base' in activeCtx) {
      if(!activeCtx['@base']) {
        // The None case preserves rval as potentially relative
        return iri;
      } else {
        return _removeBase(_prependBase(base, activeCtx['@base']), iri);
      }
    } else {
      return _removeBase(base, iri);
    }
  }

  // return IRI as is
  return iri;
};

/**
 * Performs value compaction on an object with '@value' or '@id' as the only
 * property.
 *
 * @param activeCtx the active context.
 * @param activeProperty the active property that points to the value.
 * @param value the value to compact.
 * @param {Object} [options] - processing options.
 *
 * @return the compaction result.
 */
api.compactValue = ({activeCtx, activeProperty, value, options}) => {
  // value is a @value
  if(_isValue(value)) {
    // get context rules
    const type = _getContextValue(activeCtx, activeProperty, '@type');
    const language = _getContextValue(activeCtx, activeProperty, '@language');
    const direction = _getContextValue(activeCtx, activeProperty, '@direction');
    const container =
      _getContextValue(activeCtx, activeProperty, '@container') || [];

    // whether or not the value has an @index that must be preserved
    const preserveIndex = '@index' in value && !container.includes('@index');

    // if there's no @index to preserve ...
    if(!preserveIndex && type !== '@none') {
      // matching @type or @language specified in context, compact value
      if(value['@type'] === type) {
        return value['@value'];
      }
      if('@language' in value && value['@language'] === language &&
         '@direction' in value && value['@direction'] === direction) {
        return value['@value'];
      }
      if('@language' in value && value['@language'] === language) {
        return value['@value'];
      }
      if('@direction' in value && value['@direction'] === direction) {
        return value['@value'];
      }
    }

    // return just the value of @value if all are true:
    // 1. @value is the only key or @index isn't being preserved
    // 2. there is no default language or @value is not a string or
    //   the key has a mapping with a null @language
    const keyCount = Object.keys(value).length;
    const isValueOnlyKey = (keyCount === 1 ||
      (keyCount === 2 && '@index' in value && !preserveIndex));
    const hasDefaultLanguage = ('@language' in activeCtx);
    const isValueString = _isString(value['@value']);
    const hasNullMapping = (activeCtx.mappings.has(activeProperty) &&
      activeCtx.mappings.get(activeProperty)['@language'] === null);
    if(isValueOnlyKey &&
      type !== '@none' &&
      (!hasDefaultLanguage || !isValueString || hasNullMapping)) {
      return value['@value'];
    }

    const rval = {};

    // preserve @index
    if(preserveIndex) {
      rval[api.compactIri({
        activeCtx,
        iri: '@index',
        relativeTo: {vocab: true}
      })] = value['@index'];
    }

    if('@type' in value) {
      // compact @type IRI
      rval[api.compactIri({
        activeCtx,
        iri: '@type',
        relativeTo: {vocab: true}
      })] = api.compactIri(
        {activeCtx, iri: value['@type'], relativeTo: {vocab: true}});
    } else if('@language' in value) {
      // alias @language
      rval[api.compactIri({
        activeCtx,
        iri: '@language',
        relativeTo: {vocab: true}
      })] = value['@language'];
    }

    if('@direction' in value) {
      // alias @direction
      rval[api.compactIri({
        activeCtx,
        iri: '@direction',
        relativeTo: {vocab: true}
      })] = value['@direction'];
    }

    // alias @value
    rval[api.compactIri({
      activeCtx,
      iri: '@value',
      relativeTo: {vocab: true}
    })] = value['@value'];

    return rval;
  }

  // value is a subject reference
  const expandedProperty = _expandIri(activeCtx, activeProperty, {vocab: true},
    options);
  const type = _getContextValue(activeCtx, activeProperty, '@type');
  const compacted = api.compactIri({
    activeCtx,
    iri: value['@id'],
    relativeTo: {vocab: type === '@vocab'},
    base: options.base});

  // compact to scalar
  if(type === '@id' || type === '@vocab' || expandedProperty === '@graph') {
    return compacted;
  }

  return {
    [api.compactIri({
      activeCtx,
      iri: '@id',
      relativeTo: {vocab: true}
    })]: compacted
  };
};

/**
 * Picks the preferred compaction term from the given inverse context entry.
 *
 * @param activeCtx the active context.
 * @param iri the IRI to pick the term for.
 * @param value the value to pick the term for.
 * @param containers the preferred containers.
 * @param typeOrLanguage either '@type' or '@language'.
 * @param typeOrLanguageValue the preferred value for '@type' or '@language'.
 *
 * @return the preferred term.
 */
function _selectTerm(
  activeCtx, iri, value, containers, typeOrLanguage, typeOrLanguageValue) {
  if(typeOrLanguageValue === null) {
    typeOrLanguageValue = '@null';
  }

  // preferences for the value of @type or @language
  const prefs = [];

  // determine prefs for @id based on whether or not value compacts to a term
  if((typeOrLanguageValue === '@id' || typeOrLanguageValue === '@reverse') &&
    _isObject(value) && '@id' in value) {
    // prefer @reverse first
    if(typeOrLanguageValue === '@reverse') {
      prefs.push('@reverse');
    }
    // try to compact value to a term
    const term = api.compactIri(
      {activeCtx, iri: value['@id'], relativeTo: {vocab: true}});
    if(activeCtx.mappings.has(term) &&
      activeCtx.mappings.get(term) &&
      activeCtx.mappings.get(term)['@id'] === value['@id']) {
      // prefer @vocab
      prefs.push.apply(prefs, ['@vocab', '@id']);
    } else {
      // prefer @id
      prefs.push.apply(prefs, ['@id', '@vocab']);
    }
  } else {
    prefs.push(typeOrLanguageValue);

    // consider direction only
    const langDir = prefs.find(el => el.includes('_'));
    if(langDir) {
      // consider _dir portion
      prefs.push(langDir.replace(/^[^_]+_/, '_'));
    }
  }
  prefs.push('@none');

  const containerMap = activeCtx.inverse[iri];
  for(const container of containers) {
    // if container not available in the map, continue
    if(!(container in containerMap)) {
      continue;
    }

    const typeOrLanguageValueMap = containerMap[container][typeOrLanguage];
    for(const pref of prefs) {
      // if type/language option not available in the map, continue
      if(!(pref in typeOrLanguageValueMap)) {
        continue;
      }

      // select term
      return typeOrLanguageValueMap[pref];
    }
  }

  return null;
}

/**
 * The value of `@nest` in the term definition must either be `@nest`, or a term
 * which resolves to `@nest`.
 *
 * @param activeCtx the active context.
 * @param nestProperty a term in the active context or `@nest`.
 * @param {Object} [options] - processing options.
 */
function _checkNestProperty(activeCtx, nestProperty, options) {
  if(_expandIri(activeCtx, nestProperty, {vocab: true}, options) !== '@nest') {
    throw new JsonLdError(
      'JSON-LD compact error; nested property must have an @nest value ' +
      'resolving to @nest.',
      'jsonld.SyntaxError', {code: 'invalid @nest value'});
  }
}

},{"./JsonLdError":44,"./context":51,"./graphTypes":57,"./types":62,"./url":63,"./util":64}],50:[function(require,module,exports){
/*
 * Copyright (c) 2017 Digital Bazaar, Inc. All rights reserved.
 */
'use strict';

const RDF = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#';
const XSD = 'http://www.w3.org/2001/XMLSchema#';

module.exports = {
  // TODO: Deprecated and will be removed later. Use LINK_HEADER_CONTEXT.
  LINK_HEADER_REL: 'http://www.w3.org/ns/json-ld#context',

  LINK_HEADER_CONTEXT: 'http://www.w3.org/ns/json-ld#context',

  RDF,
  RDF_LIST: RDF + 'List',
  RDF_FIRST: RDF + 'first',
  RDF_REST: RDF + 'rest',
  RDF_NIL: RDF + 'nil',
  RDF_TYPE: RDF + 'type',
  RDF_PLAIN_LITERAL: RDF + 'PlainLiteral',
  RDF_XML_LITERAL: RDF + 'XMLLiteral',
  RDF_JSON_LITERAL: RDF + 'JSON',
  RDF_OBJECT: RDF + 'object',
  RDF_LANGSTRING: RDF + 'langString',

  XSD,
  XSD_BOOLEAN: XSD + 'boolean',
  XSD_DOUBLE: XSD + 'double',
  XSD_INTEGER: XSD + 'integer',
  XSD_STRING: XSD + 'string',
};

},{}],51:[function(require,module,exports){
/*
 * Copyright (c) 2017-2019 Digital Bazaar, Inc. All rights reserved.
 */
'use strict';

const util = require('./util');
const JsonLdError = require('./JsonLdError');

const {
  isArray: _isArray,
  isObject: _isObject,
  isString: _isString,
  isUndefined: _isUndefined
} = require('./types');

const {
  isAbsolute: _isAbsoluteIri,
  isRelative: _isRelativeIri,
  prependBase
} = require('./url');

const {
  asArray: _asArray,
  compareShortestLeast: _compareShortestLeast
} = require('./util');

const INITIAL_CONTEXT_CACHE = new Map();
const INITIAL_CONTEXT_CACHE_MAX_SIZE = 10000;
const KEYWORD_PATTERN = /^@[a-zA-Z]+$/;

const api = {};
module.exports = api;

/**
 * Processes a local context and returns a new active context.
 *
 * @param activeCtx the current active context.
 * @param localCtx the local context to process.
 * @param options the context processing options.
 * @param propagate `true` if `false`, retains any previously defined term,
 *   which can be rolled back when the descending into a new node object.
 * @param overrideProtected `false` allows protected terms to be modified.
 *
 * @return a Promise that resolves to the new active context.
 */
api.process = async ({
  activeCtx, localCtx, options,
  propagate = true,
  overrideProtected = false,
  cycles = new Set()
}) => {
  // normalize local context to an array of @context objects
  if(_isObject(localCtx) && '@context' in localCtx &&
    _isArray(localCtx['@context'])) {
    localCtx = localCtx['@context'];
  }
  const ctxs = _asArray(localCtx);

  // no contexts in array, return current active context w/o changes
  if(ctxs.length === 0) {
    return activeCtx;
  }

  // resolve contexts
  const resolved = await options.contextResolver.resolve({
    activeCtx,
    context: localCtx,
    documentLoader: options.documentLoader,
    base: options.base
  });

  // override propagate if first resolved context has `@propagate`
  if(_isObject(resolved[0].document) &&
    typeof resolved[0].document['@propagate'] === 'boolean') {
    // retrieve early, error checking done later
    propagate = resolved[0].document['@propagate'];
  }

  // process each context in order, update active context
  // on each iteration to ensure proper caching
  let rval = activeCtx;

  // track the previous context
  // if not propagating, make sure rval has a previous context
  if(!propagate && !rval.previousContext) {
    // clone `rval` context before updating
    rval = rval.clone();
    rval.previousContext = activeCtx;
  }

  for(const resolvedContext of resolved) {
    let {document: ctx} = resolvedContext;

    // update active context to one computed from last iteration
    activeCtx = rval;

    // reset to initial context
    if(ctx === null) {
      // We can't nullify if there are protected terms and we're
      // not allowing overrides (e.g. processing a property term scoped context)
      if(!overrideProtected &&
        Object.keys(activeCtx.protected).length !== 0) {
        const protectedMode = (options && options.protectedMode) || 'error';
        if(protectedMode === 'error') {
          throw new JsonLdError(
            'Tried to nullify a context with protected terms outside of ' +
            'a term definition.',
            'jsonld.SyntaxError',
            {code: 'invalid context nullification'});
        } else if(protectedMode === 'warn') {
          // FIXME: remove logging and use a handler
          console.warn('WARNING: invalid context nullification');

          // get processed context from cache if available
          const processed = resolvedContext.getProcessed(activeCtx);
          if(processed) {
            rval = activeCtx = processed;
            continue;
          }

          const oldActiveCtx = activeCtx;
          // copy all protected term definitions to fresh initial context
          rval = activeCtx = api.getInitialContext(options).clone();
          for(const [term, _protected] of
            Object.entries(oldActiveCtx.protected)) {
            if(_protected) {
              activeCtx.mappings[term] =
                util.clone(oldActiveCtx.mappings[term]);
            }
          }
          activeCtx.protected = util.clone(oldActiveCtx.protected);

          // cache processed result
          resolvedContext.setProcessed(oldActiveCtx, rval);
          continue;
        }
        throw new JsonLdError(
          'Invalid protectedMode.',
          'jsonld.SyntaxError',
          {code: 'invalid protected mode', context: localCtx, protectedMode});
      }
      rval = activeCtx = api.getInitialContext(options).clone();
      continue;
    }

    // get processed context from cache if available
    const processed = resolvedContext.getProcessed(activeCtx);
    if(processed) {
      rval = activeCtx = processed;
      continue;
    }

    // dereference @context key if present
    if(_isObject(ctx) && '@context' in ctx) {
      ctx = ctx['@context'];
    }

    // context must be an object by now, all URLs retrieved before this call
    if(!_isObject(ctx)) {
      throw new JsonLdError(
        'Invalid JSON-LD syntax; @context must be an object.',
        'jsonld.SyntaxError', {code: 'invalid local context', context: ctx});
    }

    // TODO: there is likely a `previousContext` cloning optimization that
    // could be applied here (no need to copy it under certain conditions)

    // clone context before updating it
    rval = rval.clone();

    // define context mappings for keys in local context
    const defined = new Map();

    // handle @version
    if('@version' in ctx) {
      if(ctx['@version'] !== 1.1) {
        throw new JsonLdError(
          'Unsupported JSON-LD version: ' + ctx['@version'],
          'jsonld.UnsupportedVersion',
          {code: 'invalid @version value', context: ctx});
      }
      if(activeCtx.processingMode &&
        activeCtx.processingMode === 'json-ld-1.0') {
        throw new JsonLdError(
          '@version: ' + ctx['@version'] + ' not compatible with ' +
          activeCtx.processingMode,
          'jsonld.ProcessingModeConflict',
          {code: 'processing mode conflict', context: ctx});
      }
      rval.processingMode = 'json-ld-1.1';
      rval['@version'] = ctx['@version'];
      defined.set('@version', true);
    }

    // if not set explicitly, set processingMode to "json-ld-1.1"
    rval.processingMode =
      rval.processingMode || activeCtx.processingMode;

    // handle @base
    if('@base' in ctx) {
      let base = ctx['@base'];

      if(base === null || _isAbsoluteIri(base)) {
        // no action
      } else if(_isRelativeIri(base)) {
        base = prependBase(rval['@base'], base);
      } else {
        throw new JsonLdError(
          'Invalid JSON-LD syntax; the value of "@base" in a ' +
          '@context must be an absolute IRI, a relative IRI, or null.',
          'jsonld.SyntaxError', {code: 'invalid base IRI', context: ctx});
      }

      rval['@base'] = base;
      defined.set('@base', true);
    }

    // handle @vocab
    if('@vocab' in ctx) {
      const value = ctx['@vocab'];
      if(value === null) {
        delete rval['@vocab'];
      } else if(!_isString(value)) {
        throw new JsonLdError(
          'Invalid JSON-LD syntax; the value of "@vocab" in a ' +
          '@context must be a string or null.',
          'jsonld.SyntaxError', {code: 'invalid vocab mapping', context: ctx});
      } else if(!_isAbsoluteIri(value) && api.processingMode(rval, 1.0)) {
        throw new JsonLdError(
          'Invalid JSON-LD syntax; the value of "@vocab" in a ' +
          '@context must be an absolute IRI.',
          'jsonld.SyntaxError', {code: 'invalid vocab mapping', context: ctx});
      } else {
        rval['@vocab'] = _expandIri(rval, value, {vocab: true, base: true},
          undefined, undefined, options);
      }
      defined.set('@vocab', true);
    }

    // handle @language
    if('@language' in ctx) {
      const value = ctx['@language'];
      if(value === null) {
        delete rval['@language'];
      } else if(!_isString(value)) {
        throw new JsonLdError(
          'Invalid JSON-LD syntax; the value of "@language" in a ' +
          '@context must be a string or null.',
          'jsonld.SyntaxError',
          {code: 'invalid default language', context: ctx});
      } else {
        rval['@language'] = value.toLowerCase();
      }
      defined.set('@language', true);
    }

    // handle @direction
    if('@direction' in ctx) {
      const value = ctx['@direction'];
      if(activeCtx.processingMode === 'json-ld-1.0') {
        throw new JsonLdError(
          'Invalid JSON-LD syntax; @direction not compatible with ' +
          activeCtx.processingMode,
          'jsonld.SyntaxError',
          {code: 'invalid context member', context: ctx});
      }
      if(value === null) {
        delete rval['@direction'];
      } else if(value !== 'ltr' && value !== 'rtl') {
        throw new JsonLdError(
          'Invalid JSON-LD syntax; the value of "@direction" in a ' +
          '@context must be null, "ltr", or "rtl".',
          'jsonld.SyntaxError',
          {code: 'invalid base direction', context: ctx});
      } else {
        rval['@direction'] = value;
      }
      defined.set('@direction', true);
    }

    // handle @propagate
    // note: we've already extracted it, here we just do error checking
    if('@propagate' in ctx) {
      const value = ctx['@propagate'];
      if(activeCtx.processingMode === 'json-ld-1.0') {
        throw new JsonLdError(
          'Invalid JSON-LD syntax; @propagate not compatible with ' +
          activeCtx.processingMode,
          'jsonld.SyntaxError',
          {code: 'invalid context entry', context: ctx});
      }
      if(typeof value !== 'boolean') {
        throw new JsonLdError(
          'Invalid JSON-LD syntax; @propagate value must be a boolean.',
          'jsonld.SyntaxError',
          {code: 'invalid @propagate value', context: localCtx});
      }
      defined.set('@propagate', true);
    }

    // handle @import
    if('@import' in ctx) {
      const value = ctx['@import'];
      if(activeCtx.processingMode === 'json-ld-1.0') {
        throw new JsonLdError(
          'Invalid JSON-LD syntax; @import not compatible with ' +
          activeCtx.processingMode,
          'jsonld.SyntaxError',
          {code: 'invalid context entry', context: ctx});
      }
      if(!_isString(value)) {
        throw new JsonLdError(
          'Invalid JSON-LD syntax; @import must be a string.',
          'jsonld.SyntaxError',
          {code: 'invalid @import value', context: localCtx});
      }

      // resolve contexts
      const resolvedImport = await options.contextResolver.resolve({
        activeCtx,
        context: value,
        documentLoader: options.documentLoader,
        base: options.base
      });
      if(resolvedImport.length !== 1) {
        throw new JsonLdError(
          'Invalid JSON-LD syntax; @import must reference a single context.',
          'jsonld.SyntaxError',
          {code: 'invalid remote context', context: localCtx});
      }
      const processedImport = resolvedImport[0].getProcessed(activeCtx);
      if(processedImport) {
        // Note: if the same context were used in this active context
        // as a reference context, then processed_input might not
        // be a dict.
        ctx = processedImport;
      } else {
        const importCtx = resolvedImport[0].document;
        if('@import' in importCtx) {
          throw new JsonLdError(
            'Invalid JSON-LD syntax: ' +
            'imported context must not include @import.',
            'jsonld.SyntaxError',
            {code: 'invalid context entry', context: localCtx});
        }

        // merge ctx into importCtx and replace rval with the result
        for(const key in importCtx) {
          if(!ctx.hasOwnProperty(key)) {
            ctx[key] = importCtx[key];
          }
        }

        // Note: this could potenially conflict if the import
        // were used in the same active context as a referenced
        // context and an import. In this case, we
        // could override the cached result, but seems unlikely.
        resolvedImport[0].setProcessed(activeCtx, ctx);
      }

      defined.set('@import', true);
    }

    // handle @protected; determine whether this sub-context is declaring
    // all its terms to be "protected" (exceptions can be made on a
    // per-definition basis)
    defined.set('@protected', ctx['@protected'] || false);

    // process all other keys
    for(const key in ctx) {
      api.createTermDefinition({
        activeCtx: rval,
        localCtx: ctx,
        term: key,
        defined,
        options,
        overrideProtected
      });

      if(_isObject(ctx[key]) && '@context' in ctx[key]) {
        const keyCtx = ctx[key]['@context'];
        let process = true;
        if(_isString(keyCtx)) {
          const url = prependBase(options.base, keyCtx);
          // track processed contexts to avoid scoped context recursion
          if(cycles.has(url)) {
            process = false;
          } else {
            cycles.add(url);
          }
        }
        // parse context to validate
        if(process) {
          try {
            await api.process({
              activeCtx: rval.clone(),
              localCtx: ctx[key]['@context'],
              overrideProtected: true,
              options,
              cycles
            });
          } catch(e) {
            throw new JsonLdError(
              'Invalid JSON-LD syntax; invalid scoped context.',
              'jsonld.SyntaxError',
              {
                code: 'invalid scoped context',
                context: ctx[key]['@context'],
                term: key
              });
          }
        }
      }
    }

    // cache processed result
    resolvedContext.setProcessed(activeCtx, rval);
  }

  return rval;
};

/**
 * Creates a term definition during context processing.
 *
 * @param activeCtx the current active context.
 * @param localCtx the local context being processed.
 * @param term the term in the local context to define the mapping for.
 * @param defined a map of defining/defined keys to detect cycles and prevent
 *          double definitions.
 * @param {Object} [options] - creation options.
 * @param {string} [options.protectedMode="error"] - "error" to throw error
 *   on `@protected` constraint violation, "warn" to allow violations and
 *   signal a warning.
 * @param overrideProtected `false` allows protected terms to be modified.
 */
api.createTermDefinition = ({
  activeCtx,
  localCtx,
  term,
  defined,
  options,
  overrideProtected = false,
}) => {
  if(defined.has(term)) {
    // term already defined
    if(defined.get(term)) {
      return;
    }
    // cycle detected
    throw new JsonLdError(
      'Cyclical context definition detected.',
      'jsonld.CyclicalContext',
      {code: 'cyclic IRI mapping', context: localCtx, term});
  }

  // now defining term
  defined.set(term, false);

  // get context term value
  let value;
  if(localCtx.hasOwnProperty(term)) {
    value = localCtx[term];
  }

  if(term === '@type' &&
     _isObject(value) &&
     (value['@container'] || '@set') === '@set' &&
     api.processingMode(activeCtx, 1.1)) {

    const validKeys = ['@container', '@id', '@protected'];
    const keys = Object.keys(value);
    if(keys.length === 0 || keys.some(k => !validKeys.includes(k))) {
      throw new JsonLdError(
        'Invalid JSON-LD syntax; keywords cannot be overridden.',
        'jsonld.SyntaxError',
        {code: 'keyword redefinition', context: localCtx, term});
    }
  } else if(api.isKeyword(term)) {
    throw new JsonLdError(
      'Invalid JSON-LD syntax; keywords cannot be overridden.',
      'jsonld.SyntaxError',
      {code: 'keyword redefinition', context: localCtx, term});
  } else if(term.match(KEYWORD_PATTERN)) {
    // FIXME: remove logging and use a handler
    console.warn('WARNING: terms beginning with "@" are reserved' +
      ' for future use and ignored', {term});
    return;
  } else if(term === '') {
    throw new JsonLdError(
      'Invalid JSON-LD syntax; a term cannot be an empty string.',
      'jsonld.SyntaxError',
      {code: 'invalid term definition', context: localCtx});
  }

  // keep reference to previous mapping for potential `@protected` check
  const previousMapping = activeCtx.mappings.get(term);

  // remove old mapping
  if(activeCtx.mappings.has(term)) {
    activeCtx.mappings.delete(term);
  }

  // convert short-hand value to object w/@id
  let simpleTerm = false;
  if(_isString(value) || value === null) {
    simpleTerm = true;
    value = {'@id': value};
  }

  if(!_isObject(value)) {
    throw new JsonLdError(
      'Invalid JSON-LD syntax; @context term values must be ' +
      'strings or objects.',
      'jsonld.SyntaxError',
      {code: 'invalid term definition', context: localCtx});
  }

  // create new mapping
  const mapping = {};
  activeCtx.mappings.set(term, mapping);
  mapping.reverse = false;

  // make sure term definition only has expected keywords
  const validKeys = ['@container', '@id', '@language', '@reverse', '@type'];

  // JSON-LD 1.1 support
  if(api.processingMode(activeCtx, 1.1)) {
    validKeys.push(
      '@context', '@direction', '@index', '@nest', '@prefix', '@protected');
  }

  for(const kw in value) {
    if(!validKeys.includes(kw)) {
      throw new JsonLdError(
        'Invalid JSON-LD syntax; a term definition must not contain ' + kw,
        'jsonld.SyntaxError',
        {code: 'invalid term definition', context: localCtx});
    }
  }

  // always compute whether term has a colon as an optimization for
  // _compactIri
  const colon = term.indexOf(':');
  mapping._termHasColon = (colon > 0);

  if('@reverse' in value) {
    if('@id' in value) {
      throw new JsonLdError(
        'Invalid JSON-LD syntax; a @reverse term definition must not ' +
        'contain @id.', 'jsonld.SyntaxError',
        {code: 'invalid reverse property', context: localCtx});
    }
    if('@nest' in value) {
      throw new JsonLdError(
        'Invalid JSON-LD syntax; a @reverse term definition must not ' +
        'contain @nest.', 'jsonld.SyntaxError',
        {code: 'invalid reverse property', context: localCtx});
    }
    const reverse = value['@reverse'];
    if(!_isString(reverse)) {
      throw new JsonLdError(
        'Invalid JSON-LD syntax; a @context @reverse value must be a string.',
        'jsonld.SyntaxError', {code: 'invalid IRI mapping', context: localCtx});
    }

    if(!api.isKeyword(reverse) && reverse.match(KEYWORD_PATTERN)) {
      // FIXME: remove logging and use a handler
      console.warn('WARNING: values beginning with "@" are reserved' +
        ' for future use and ignored', {reverse});
      if(previousMapping) {
        activeCtx.mappings.set(term, previousMapping);
      } else {
        activeCtx.mappings.delete(term);
      }
      return;
    }

    // expand and add @id mapping
    const id = _expandIri(
      activeCtx, reverse, {vocab: true, base: false}, localCtx, defined,
      options);
    if(!_isAbsoluteIri(id)) {
      throw new JsonLdError(
        'Invalid JSON-LD syntax; a @context @reverse value must be an ' +
        'absolute IRI or a blank node identifier.',
        'jsonld.SyntaxError', {code: 'invalid IRI mapping', context: localCtx});
    }

    mapping['@id'] = id;
    mapping.reverse = true;
  } else if('@id' in value) {
    let id = value['@id'];
    if(id && !_isString(id)) {
      throw new JsonLdError(
        'Invalid JSON-LD syntax; a @context @id value must be an array ' +
        'of strings or a string.',
        'jsonld.SyntaxError', {code: 'invalid IRI mapping', context: localCtx});
    }
    if(id === null) {
      // reserve a null term, which may be protected
      mapping['@id'] = null;
    } else if(!api.isKeyword(id) && id.match(KEYWORD_PATTERN)) {
      // FIXME: remove logging and use a handler
      console.warn('WARNING: values beginning with "@" are reserved' +
        ' for future use and ignored', {id});
      if(previousMapping) {
        activeCtx.mappings.set(term, previousMapping);
      } else {
        activeCtx.mappings.delete(term);
      }
      return;
    } else if(id !== term) {
      // expand and add @id mapping
      id = _expandIri(
        activeCtx, id, {vocab: true, base: false}, localCtx, defined, options);
      if(!_isAbsoluteIri(id) && !api.isKeyword(id)) {
        throw new JsonLdError(
          'Invalid JSON-LD syntax; a @context @id value must be an ' +
          'absolute IRI, a blank node identifier, or a keyword.',
          'jsonld.SyntaxError',
          {code: 'invalid IRI mapping', context: localCtx});
      }

      // if term has the form of an IRI it must map the same
      if(term.match(/(?::[^:])|\//)) {
        const termDefined = new Map(defined).set(term, true);
        const termIri = _expandIri(
          activeCtx, term, {vocab: true, base: false},
          localCtx, termDefined, options);
        if(termIri !== id) {
          throw new JsonLdError(
            'Invalid JSON-LD syntax; term in form of IRI must ' +
            'expand to definition.',
            'jsonld.SyntaxError',
            {code: 'invalid IRI mapping', context: localCtx});
        }
      }

      mapping['@id'] = id;
      // indicate if this term may be used as a compact IRI prefix
      mapping._prefix = (simpleTerm &&
        !mapping._termHasColon &&
        id.match(/[:\/\?#\[\]@]$/));
    }
  }

  if(!('@id' in mapping)) {
    // see if the term has a prefix
    if(mapping._termHasColon) {
      const prefix = term.substr(0, colon);
      if(localCtx.hasOwnProperty(prefix)) {
        // define parent prefix
        api.createTermDefinition({
          activeCtx, localCtx, term: prefix, defined, options
        });
      }

      if(activeCtx.mappings.has(prefix)) {
        // set @id based on prefix parent
        const suffix = term.substr(colon + 1);
        mapping['@id'] = activeCtx.mappings.get(prefix)['@id'] + suffix;
      } else {
        // term is an absolute IRI
        mapping['@id'] = term;
      }
    } else if(term === '@type') {
      // Special case, were we've previously determined that container is @set
      mapping['@id'] = term;
    } else {
      // non-IRIs *must* define @ids if @vocab is not available
      if(!('@vocab' in activeCtx)) {
        throw new JsonLdError(
          'Invalid JSON-LD syntax; @context terms must define an @id.',
          'jsonld.SyntaxError',
          {code: 'invalid IRI mapping', context: localCtx, term});
      }
      // prepend vocab to term
      mapping['@id'] = activeCtx['@vocab'] + term;
    }
  }

  // Handle term protection
  if(value['@protected'] === true ||
    (defined.get('@protected') === true && value['@protected'] !== false)) {
    activeCtx.protected[term] = true;
    mapping.protected = true;
  }

  // IRI mapping now defined
  defined.set(term, true);

  if('@type' in value) {
    let type = value['@type'];
    if(!_isString(type)) {
      throw new JsonLdError(
        'Invalid JSON-LD syntax; an @context @type value must be a string.',
        'jsonld.SyntaxError',
        {code: 'invalid type mapping', context: localCtx});
    }

    if((type === '@json' || type === '@none')) {
      if(api.processingMode(activeCtx, 1.0)) {
        throw new JsonLdError(
          'Invalid JSON-LD syntax; an @context @type value must not be ' +
          `"${type}" in JSON-LD 1.0 mode.`,
          'jsonld.SyntaxError',
          {code: 'invalid type mapping', context: localCtx});
      }
    } else if(type !== '@id' && type !== '@vocab') {
      // expand @type to full IRI
      type = _expandIri(
        activeCtx, type, {vocab: true, base: false}, localCtx, defined,
        options);
      if(!_isAbsoluteIri(type)) {
        throw new JsonLdError(
          'Invalid JSON-LD syntax; an @context @type value must be an ' +
          'absolute IRI.',
          'jsonld.SyntaxError',
          {code: 'invalid type mapping', context: localCtx});
      }
      if(type.indexOf('_:') === 0) {
        throw new JsonLdError(
          'Invalid JSON-LD syntax; an @context @type value must be an IRI, ' +
          'not a blank node identifier.',
          'jsonld.SyntaxError',
          {code: 'invalid type mapping', context: localCtx});
      }
    }

    // add @type to mapping
    mapping['@type'] = type;
  }

  if('@container' in value) {
    // normalize container to an array form
    const container = _isString(value['@container']) ?
      [value['@container']] : (value['@container'] || []);
    const validContainers = ['@list', '@set', '@index', '@language'];
    let isValid = true;
    const hasSet = container.includes('@set');

    // JSON-LD 1.1 support
    if(api.processingMode(activeCtx, 1.1)) {
      validContainers.push('@graph', '@id', '@type');

      // check container length
      if(container.includes('@list')) {
        if(container.length !== 1) {
          throw new JsonLdError(
            'Invalid JSON-LD syntax; @context @container with @list must ' +
            'have no other values',
            'jsonld.SyntaxError',
            {code: 'invalid container mapping', context: localCtx});
        }
      } else if(container.includes('@graph')) {
        if(container.some(key =>
          key !== '@graph' && key !== '@id' && key !== '@index' &&
          key !== '@set')) {
          throw new JsonLdError(
            'Invalid JSON-LD syntax; @context @container with @graph must ' +
            'have no other values other than @id, @index, and @set',
            'jsonld.SyntaxError',
            {code: 'invalid container mapping', context: localCtx});
        }
      } else {
        // otherwise, container may also include @set
        isValid &= container.length <= (hasSet ? 2 : 1);
      }

      if(container.includes('@type')) {
        // If mapping does not have an @type,
        // set it to @id
        mapping['@type'] = mapping['@type'] || '@id';

        // type mapping must be either @id or @vocab
        if(!['@id', '@vocab'].includes(mapping['@type'])) {
          throw new JsonLdError(
            'Invalid JSON-LD syntax; container: @type requires @type to be ' +
            '@id or @vocab.',
            'jsonld.SyntaxError',
            {code: 'invalid type mapping', context: localCtx});
        }
      }
    } else {
      // in JSON-LD 1.0, container must not be an array (it must be a string,
      // which is one of the validContainers)
      isValid &= !_isArray(value['@container']);

      // check container length
      isValid &= container.length <= 1;
    }

    // check against valid containers
    isValid &= container.every(c => validContainers.includes(c));

    // @set not allowed with @list
    isValid &= !(hasSet && container.includes('@list'));

    if(!isValid) {
      throw new JsonLdError(
        'Invalid JSON-LD syntax; @context @container value must be ' +
        'one of the following: ' + validContainers.join(', '),
        'jsonld.SyntaxError',
        {code: 'invalid container mapping', context: localCtx});
    }

    if(mapping.reverse &&
      !container.every(c => ['@index', '@set'].includes(c))) {
      throw new JsonLdError(
        'Invalid JSON-LD syntax; @context @container value for a @reverse ' +
        'type definition must be @index or @set.', 'jsonld.SyntaxError',
        {code: 'invalid reverse property', context: localCtx});
    }

    // add @container to mapping
    mapping['@container'] = container;
  }

  // property indexing
  if('@index' in value) {
    if(!('@container' in value) || !mapping['@container'].includes('@index')) {
      throw new JsonLdError(
        'Invalid JSON-LD syntax; @index without @index in @container: ' +
        `"${value['@index']}" on term "${term}".`, 'jsonld.SyntaxError',
        {code: 'invalid term definition', context: localCtx});
    }
    if(!_isString(value['@index']) || value['@index'].indexOf('@') === 0) {
      throw new JsonLdError(
        'Invalid JSON-LD syntax; @index must expand to an IRI: ' +
        `"${value['@index']}" on term "${term}".`, 'jsonld.SyntaxError',
        {code: 'invalid term definition', context: localCtx});
    }
    mapping['@index'] = value['@index'];
  }

  // scoped contexts
  if('@context' in value) {
    mapping['@context'] = value['@context'];
  }

  if('@language' in value && !('@type' in value)) {
    let language = value['@language'];
    if(language !== null && !_isString(language)) {
      throw new JsonLdError(
        'Invalid JSON-LD syntax; @context @language value must be ' +
        'a string or null.', 'jsonld.SyntaxError',
        {code: 'invalid language mapping', context: localCtx});
    }

    // add @language to mapping
    if(language !== null) {
      language = language.toLowerCase();
    }
    mapping['@language'] = language;
  }

  // term may be used as a prefix
  if('@prefix' in value) {
    if(term.match(/:|\//)) {
      throw new JsonLdError(
        'Invalid JSON-LD syntax; @context @prefix used on a compact IRI term',
        'jsonld.SyntaxError',
        {code: 'invalid term definition', context: localCtx});
    }
    if(api.isKeyword(mapping['@id'])) {
      throw new JsonLdError(
        'Invalid JSON-LD syntax; keywords may not be used as prefixes',
        'jsonld.SyntaxError',
        {code: 'invalid term definition', context: localCtx});
    }
    if(typeof value['@prefix'] === 'boolean') {
      mapping._prefix = value['@prefix'] === true;
    } else {
      throw new JsonLdError(
        'Invalid JSON-LD syntax; @context value for @prefix must be boolean',
        'jsonld.SyntaxError',
        {code: 'invalid @prefix value', context: localCtx});
    }
  }

  if('@direction' in value) {
    const direction = value['@direction'];
    if(direction !== null && direction !== 'ltr' && direction !== 'rtl') {
      throw new JsonLdError(
        'Invalid JSON-LD syntax; @direction value must be ' +
        'null, "ltr", or "rtl".',
        'jsonld.SyntaxError',
        {code: 'invalid base direction', context: localCtx});
    }
    mapping['@direction'] = direction;
  }

  if('@nest' in value) {
    const nest = value['@nest'];
    if(!_isString(nest) || (nest !== '@nest' && nest.indexOf('@') === 0)) {
      throw new JsonLdError(
        'Invalid JSON-LD syntax; @context @nest value must be ' +
        'a string which is not a keyword other than @nest.',
        'jsonld.SyntaxError',
        {code: 'invalid @nest value', context: localCtx});
    }
    mapping['@nest'] = nest;
  }

  // disallow aliasing @context and @preserve
  const id = mapping['@id'];
  if(id === '@context' || id === '@preserve') {
    throw new JsonLdError(
      'Invalid JSON-LD syntax; @context and @preserve cannot be aliased.',
      'jsonld.SyntaxError', {code: 'invalid keyword alias', context: localCtx});
  }

  // Check for overriding protected terms
  if(previousMapping && previousMapping.protected && !overrideProtected) {
    // force new term to continue to be protected and see if the mappings would
    // be equal
    activeCtx.protected[term] = true;
    mapping.protected = true;
    if(!_deepCompare(previousMapping, mapping)) {
      const protectedMode = (options && options.protectedMode) || 'error';
      if(protectedMode === 'error') {
        throw new JsonLdError(
          `Invalid JSON-LD syntax; tried to redefine "${term}" which is a ` +
          'protected term.',
          'jsonld.SyntaxError',
          {code: 'protected term redefinition', context: localCtx, term});
      } else if(protectedMode === 'warn') {
        // FIXME: remove logging and use a handler
        console.warn('WARNING: protected term redefinition', {term});
        return;
      }
      throw new JsonLdError(
        'Invalid protectedMode.',
        'jsonld.SyntaxError',
        {code: 'invalid protected mode', context: localCtx, term,
          protectedMode});
    }
  }
};

/**
 * Expands a string to a full IRI. The string may be a term, a prefix, a
 * relative IRI, or an absolute IRI. The associated absolute IRI will be
 * returned.
 *
 * @param activeCtx the current active context.
 * @param value the string to expand.
 * @param relativeTo options for how to resolve relative IRIs:
 *          base: true to resolve against the base IRI, false not to.
 *          vocab: true to concatenate after @vocab, false not to.
 * @param {Object} [options] - processing options.
 *
 * @return the expanded value.
 */
api.expandIri = (activeCtx, value, relativeTo, options) => {
  return _expandIri(activeCtx, value, relativeTo, undefined, undefined,
    options);
};

/**
 * Expands a string to a full IRI. The string may be a term, a prefix, a
 * relative IRI, or an absolute IRI. The associated absolute IRI will be
 * returned.
 *
 * @param activeCtx the current active context.
 * @param value the string to expand.
 * @param relativeTo options for how to resolve relative IRIs:
 *          base: true to resolve against the base IRI, false not to.
 *          vocab: true to concatenate after @vocab, false not to.
 * @param localCtx the local context being processed (only given if called
 *          during context processing).
 * @param defined a map for tracking cycles in context definitions (only given
 *          if called during context processing).
 * @param {Object} [options] - processing options.
 *
 * @return the expanded value.
 */
function _expandIri(activeCtx, value, relativeTo, localCtx, defined, options) {
  // already expanded
  if(value === null || !_isString(value) || api.isKeyword(value)) {
    return value;
  }

  // ignore non-keyword things that look like a keyword
  if(value.match(KEYWORD_PATTERN)) {
    return null;
  }

  // define term dependency if not defined
  if(localCtx && localCtx.hasOwnProperty(value) &&
    defined.get(value) !== true) {
    api.createTermDefinition({
      activeCtx, localCtx, term: value, defined, options
    });
  }

  relativeTo = relativeTo || {};
  if(relativeTo.vocab) {
    const mapping = activeCtx.mappings.get(value);

    // value is explicitly ignored with a null mapping
    if(mapping === null) {
      return null;
    }

    if(_isObject(mapping) && '@id' in mapping) {
      // value is a term
      return mapping['@id'];
    }
  }

  // split value into prefix:suffix
  const colon = value.indexOf(':');
  if(colon > 0) {
    const prefix = value.substr(0, colon);
    const suffix = value.substr(colon + 1);

    // do not expand blank nodes (prefix of '_') or already-absolute
    // IRIs (suffix of '//')
    if(prefix === '_' || suffix.indexOf('//') === 0) {
      return value;
    }

    // prefix dependency not defined, define it
    if(localCtx && localCtx.hasOwnProperty(prefix)) {
      api.createTermDefinition({
        activeCtx, localCtx, term: prefix, defined, options
      });
    }

    // use mapping if prefix is defined
    const mapping = activeCtx.mappings.get(prefix);
    if(mapping && mapping._prefix) {
      return mapping['@id'] + suffix;
    }

    // already absolute IRI
    if(_isAbsoluteIri(value)) {
      return value;
    }
  }

  // prepend vocab
  if(relativeTo.vocab && '@vocab' in activeCtx) {
    return activeCtx['@vocab'] + value;
  }

  // prepend base
  if(relativeTo.base && '@base' in activeCtx) {
    if(activeCtx['@base']) {
      // The null case preserves value as potentially relative
      return prependBase(prependBase(options.base, activeCtx['@base']), value);
    }
  } else if(relativeTo.base) {
    return prependBase(options.base, value);
  }

  return value;
}

/**
 * Gets the initial context.
 *
 * @param options the options to use:
 *          [base] the document base IRI.
 *
 * @return the initial context.
 */
api.getInitialContext = options => {
  const key = JSON.stringify({processingMode: options.processingMode});
  const cached = INITIAL_CONTEXT_CACHE.get(key);
  if(cached) {
    return cached;
  }

  const initialContext = {
    processingMode: options.processingMode,
    mappings: new Map(),
    inverse: null,
    getInverse: _createInverseContext,
    clone: _cloneActiveContext,
    revertToPreviousContext: _revertToPreviousContext,
    protected: {}
  };
  // TODO: consider using LRU cache instead
  if(INITIAL_CONTEXT_CACHE.size === INITIAL_CONTEXT_CACHE_MAX_SIZE) {
    // clear whole cache -- assumes scenario where the cache fills means
    // the cache isn't being used very efficiently anyway
    INITIAL_CONTEXT_CACHE.clear();
  }
  INITIAL_CONTEXT_CACHE.set(key, initialContext);
  return initialContext;

  /**
   * Generates an inverse context for use in the compaction algorithm, if
   * not already generated for the given active context.
   *
   * @return the inverse context.
   */
  function _createInverseContext() {
    const activeCtx = this;

    // lazily create inverse
    if(activeCtx.inverse) {
      return activeCtx.inverse;
    }
    const inverse = activeCtx.inverse = {};

    // variables for building fast CURIE map
    const fastCurieMap = activeCtx.fastCurieMap = {};
    const irisToTerms = {};

    // handle default language
    const defaultLanguage = (activeCtx['@language'] || '@none').toLowerCase();

    // handle default direction
    const defaultDirection = activeCtx['@direction'];

    // create term selections for each mapping in the context, ordered by
    // shortest and then lexicographically least
    const mappings = activeCtx.mappings;
    const terms = [...mappings.keys()].sort(_compareShortestLeast);
    for(const term of terms) {
      const mapping = mappings.get(term);
      if(mapping === null) {
        continue;
      }

      let container = mapping['@container'] || '@none';
      container = [].concat(container).sort().join('');

      if(mapping['@id'] === null) {
        continue;
      }
      // iterate over every IRI in the mapping
      const ids = _asArray(mapping['@id']);
      for(const iri of ids) {
        let entry = inverse[iri];
        const isKeyword = api.isKeyword(iri);

        if(!entry) {
          // initialize entry
          inverse[iri] = entry = {};

          if(!isKeyword && !mapping._termHasColon) {
            // init IRI to term map and fast CURIE prefixes
            irisToTerms[iri] = [term];
            const fastCurieEntry = {iri, terms: irisToTerms[iri]};
            if(iri[0] in fastCurieMap) {
              fastCurieMap[iri[0]].push(fastCurieEntry);
            } else {
              fastCurieMap[iri[0]] = [fastCurieEntry];
            }
          }
        } else if(!isKeyword && !mapping._termHasColon) {
          // add IRI to term match
          irisToTerms[iri].push(term);
        }

        // add new entry
        if(!entry[container]) {
          entry[container] = {
            '@language': {},
            '@type': {},
            '@any': {}
          };
        }
        entry = entry[container];
        _addPreferredTerm(term, entry['@any'], '@none');

        if(mapping.reverse) {
          // term is preferred for values using @reverse
          _addPreferredTerm(term, entry['@type'], '@reverse');
        } else if(mapping['@type'] === '@none') {
          _addPreferredTerm(term, entry['@any'], '@none');
          _addPreferredTerm(term, entry['@language'], '@none');
          _addPreferredTerm(term, entry['@type'], '@none');
        } else if('@type' in mapping) {
          // term is preferred for values using specific type
          _addPreferredTerm(term, entry['@type'], mapping['@type']);
        } else if('@language' in mapping && '@direction' in mapping) {
          // term is preferred for values using specific language and direction
          const language = mapping['@language'];
          const direction = mapping['@direction'];
          if(language && direction) {
            _addPreferredTerm(term, entry['@language'],
              `${language}_${direction}`.toLowerCase());
          } else if(language) {
            _addPreferredTerm(term, entry['@language'], language.toLowerCase());
          } else if(direction) {
            _addPreferredTerm(term, entry['@language'], `_${direction}`);
          } else {
            _addPreferredTerm(term, entry['@language'], '@null');
          }
        } else if('@language' in mapping) {
          _addPreferredTerm(term, entry['@language'],
            (mapping['@language'] || '@null').toLowerCase());
        } else if('@direction' in mapping) {
          if(mapping['@direction']) {
            _addPreferredTerm(term, entry['@language'],
              `_${mapping['@direction']}`);
          } else {
            _addPreferredTerm(term, entry['@language'], '@none');
          }
        } else if(defaultDirection) {
          _addPreferredTerm(term, entry['@language'], `_${defaultDirection}`);
          _addPreferredTerm(term, entry['@language'], '@none');
          _addPreferredTerm(term, entry['@type'], '@none');
        } else {
          // add entries for no type and no language
          _addPreferredTerm(term, entry['@language'], defaultLanguage);
          _addPreferredTerm(term, entry['@language'], '@none');
          _addPreferredTerm(term, entry['@type'], '@none');
        }
      }
    }

    // build fast CURIE map
    for(const key in fastCurieMap) {
      _buildIriMap(fastCurieMap, key, 1);
    }

    return inverse;
  }

  /**
   * Runs a recursive algorithm to build a lookup map for quickly finding
   * potential CURIEs.
   *
   * @param iriMap the map to build.
   * @param key the current key in the map to work on.
   * @param idx the index into the IRI to compare.
   */
  function _buildIriMap(iriMap, key, idx) {
    const entries = iriMap[key];
    const next = iriMap[key] = {};

    let iri;
    let letter;
    for(const entry of entries) {
      iri = entry.iri;
      if(idx >= iri.length) {
        letter = '';
      } else {
        letter = iri[idx];
      }
      if(letter in next) {
        next[letter].push(entry);
      } else {
        next[letter] = [entry];
      }
    }

    for(const key in next) {
      if(key === '') {
        continue;
      }
      _buildIriMap(next, key, idx + 1);
    }
  }

  /**
   * Adds the term for the given entry if not already added.
   *
   * @param term the term to add.
   * @param entry the inverse context typeOrLanguage entry to add to.
   * @param typeOrLanguageValue the key in the entry to add to.
   */
  function _addPreferredTerm(term, entry, typeOrLanguageValue) {
    if(!entry.hasOwnProperty(typeOrLanguageValue)) {
      entry[typeOrLanguageValue] = term;
    }
  }

  /**
   * Clones an active context, creating a child active context.
   *
   * @return a clone (child) of the active context.
   */
  function _cloneActiveContext() {
    const child = {};
    child.mappings = util.clone(this.mappings);
    child.clone = this.clone;
    child.inverse = null;
    child.getInverse = this.getInverse;
    child.protected = util.clone(this.protected);
    if(this.previousContext) {
      child.previousContext = this.previousContext.clone();
    }
    child.revertToPreviousContext = this.revertToPreviousContext;
    if('@base' in this) {
      child['@base'] = this['@base'];
    }
    if('@language' in this) {
      child['@language'] = this['@language'];
    }
    if('@vocab' in this) {
      child['@vocab'] = this['@vocab'];
    }
    return child;
  }

  /**
   * Reverts any type-scoped context in this active context to the previous
   * context.
   */
  function _revertToPreviousContext() {
    if(!this.previousContext) {
      return this;
    }
    return this.previousContext.clone();
  }
};

/**
 * Gets the value for the given active context key and type, null if none is
 * set or undefined if none is set and type is '@context'.
 *
 * @param ctx the active context.
 * @param key the context key.
 * @param [type] the type of value to get (eg: '@id', '@type'), if not
 *          specified gets the entire entry for a key, null if not found.
 *
 * @return the value, null, or undefined.
 */
api.getContextValue = (ctx, key, type) => {
  // invalid key
  if(key === null) {
    if(type === '@context') {
      return undefined;
    }
    return null;
  }

  // get specific entry information
  if(ctx.mappings.has(key)) {
    const entry = ctx.mappings.get(key);

    if(_isUndefined(type)) {
      // return whole entry
      return entry;
    }
    if(entry.hasOwnProperty(type)) {
      // return entry value for type
      return entry[type];
    }
  }

  // get default language
  if(type === '@language' && type in ctx) {
    return ctx[type];
  }

  // get default direction
  if(type === '@direction' && type in ctx) {
    return ctx[type];
  }

  if(type === '@context') {
    return undefined;
  }
  return null;
};

/**
 * Processing Mode check.
 *
 * @param activeCtx the current active context.
 * @param version the string or numeric version to check.
 *
 * @return boolean.
 */
api.processingMode = (activeCtx, version) => {
  if(version.toString() >= '1.1') {
    return !activeCtx.processingMode ||
      activeCtx.processingMode >= 'json-ld-' + version.toString();
  } else {
    return activeCtx.processingMode === 'json-ld-1.0';
  }
};

/**
 * Returns whether or not the given value is a keyword.
 *
 * @param v the value to check.
 *
 * @return true if the value is a keyword, false if not.
 */
api.isKeyword = v => {
  if(!_isString(v) || v[0] !== '@') {
    return false;
  }
  switch(v) {
    case '@base':
    case '@container':
    case '@context':
    case '@default':
    case '@direction':
    case '@embed':
    case '@explicit':
    case '@graph':
    case '@id':
    case '@included':
    case '@index':
    case '@json':
    case '@language':
    case '@list':
    case '@nest':
    case '@none':
    case '@omitDefault':
    case '@prefix':
    case '@preserve':
    case '@protected':
    case '@requireAll':
    case '@reverse':
    case '@set':
    case '@type':
    case '@value':
    case '@version':
    case '@vocab':
      return true;
  }
  return false;
};

function _deepCompare(x1, x2) {
  // compare `null` or primitive types directly
  if((!(x1 && typeof x1 === 'object')) ||
     (!(x2 && typeof x2 === 'object'))) {
    return x1 === x2;
  }
  // x1 and x2 are objects (also potentially arrays)
  const x1Array = Array.isArray(x1);
  if(x1Array !== Array.isArray(x2)) {
    return false;
  }
  if(x1Array) {
    if(x1.length !== x2.length) {
      return false;
    }
    for(let i = 0; i < x1.length; ++i) {
      if(!_deepCompare(x1[i], x2[i])) {
        return false;
      }
    }
    return true;
  }
  // x1 and x2 are non-array objects
  const k1s = Object.keys(x1);
  const k2s = Object.keys(x2);
  if(k1s.length !== k2s.length) {
    return false;
  }
  for(const k1 in x1) {
    let v1 = x1[k1];
    let v2 = x2[k1];
    // special case: `@container` can be in any order
    if(k1 === '@container') {
      if(Array.isArray(v1) && Array.isArray(v2)) {
        v1 = v1.slice().sort();
        v2 = v2.slice().sort();
      }
    }
    if(!_deepCompare(v1, v2)) {
      return false;
    }
  }
  return true;
}

},{"./JsonLdError":44,"./types":62,"./url":63,"./util":64}],52:[function(require,module,exports){
/*
 * Copyright (c) 2017 Digital Bazaar, Inc. All rights reserved.
 */
'use strict';

const {parseLinkHeader, buildHeaders} = require('../util');
const {LINK_HEADER_CONTEXT} = require('../constants');
const JsonLdError = require('../JsonLdError');
const RequestQueue = require('../RequestQueue');
const {prependBase} = require('../url');

const REGEX_LINK_HEADER = /(^|(\r\n))link:/i;

/**
 * Creates a built-in XMLHttpRequest document loader.
 *
 * @param options the options to use:
 *          secure: require all URLs to use HTTPS.
 *          headers: an object (map) of headers which will be passed as request
 *            headers for the requested document. Accept is not allowed.
 *          [xhr]: the XMLHttpRequest API to use.
 *
 * @return the XMLHttpRequest document loader.
 */
module.exports = ({
  secure,
  headers = {},
  xhr
} = {headers: {}}) => {
  headers = buildHeaders(headers);
  const queue = new RequestQueue();
  return queue.wrapLoader(loader);

  async function loader(url) {
    if(url.indexOf('http:') !== 0 && url.indexOf('https:') !== 0) {
      throw new JsonLdError(
        'URL could not be dereferenced; only "http" and "https" URLs are ' +
        'supported.',
        'jsonld.InvalidUrl', {code: 'loading document failed', url});
    }
    if(secure && url.indexOf('https') !== 0) {
      throw new JsonLdError(
        'URL could not be dereferenced; secure mode is enabled and ' +
        'the URL\'s scheme is not "https".',
        'jsonld.InvalidUrl', {code: 'loading document failed', url});
    }

    let req;
    try {
      req = await _get(xhr, url, headers);
    } catch(e) {
      throw new JsonLdError(
        'URL could not be dereferenced, an error occurred.',
        'jsonld.LoadDocumentError',
        {code: 'loading document failed', url, cause: e});
    }

    if(req.status >= 400) {
      throw new JsonLdError(
        'URL could not be dereferenced: ' + req.statusText,
        'jsonld.LoadDocumentError', {
          code: 'loading document failed',
          url,
          httpStatusCode: req.status
        });
    }

    let doc = {contextUrl: null, documentUrl: url, document: req.response};
    let alternate = null;

    // handle Link Header (avoid unsafe header warning by existence testing)
    const contentType = req.getResponseHeader('Content-Type');
    let linkHeader;
    if(REGEX_LINK_HEADER.test(req.getAllResponseHeaders())) {
      linkHeader = req.getResponseHeader('Link');
    }
    if(linkHeader && contentType !== 'application/ld+json') {
      // only 1 related link header permitted
      const linkHeaders = parseLinkHeader(linkHeader);
      const linkedContext = linkHeaders[LINK_HEADER_CONTEXT];
      if(Array.isArray(linkedContext)) {
        throw new JsonLdError(
          'URL could not be dereferenced, it has more than one ' +
          'associated HTTP Link Header.',
          'jsonld.InvalidUrl',
          {code: 'multiple context link headers', url});
      }
      if(linkedContext) {
        doc.contextUrl = linkedContext.target;
      }

      // "alternate" link header is a redirect
      alternate = linkHeaders['alternate'];
      if(alternate &&
        alternate.type == 'application/ld+json' &&
        !(contentType || '').match(/^application\/(\w*\+)?json$/)) {
        doc = await loader(prependBase(url, alternate.target));
      }
    }

    return doc;
  }
};

function _get(xhr, url, headers) {
  xhr = xhr || XMLHttpRequest;
  const req = new xhr();
  return new Promise((resolve, reject) => {
    req.onload = () => resolve(req);
    req.onerror = err => reject(err);
    req.open('GET', url, true);
    for(const k in headers) {
      req.setRequestHeader(k, headers[k]);
    }
    req.send();
  });
}

},{"../JsonLdError":44,"../RequestQueue":47,"../constants":50,"../url":63,"../util":64}],53:[function(require,module,exports){
/*
 * Copyright (c) 2017 Digital Bazaar, Inc. All rights reserved.
 */
'use strict';

const JsonLdError = require('./JsonLdError');

const {
  isArray: _isArray,
  isObject: _isObject,
  isEmptyObject: _isEmptyObject,
  isString: _isString,
  isUndefined: _isUndefined
} = require('./types');

const {
  isList: _isList,
  isValue: _isValue,
  isGraph: _isGraph,
  isSubject: _isSubject
} = require('./graphTypes');

const {
  expandIri: _expandIri,
  getContextValue: _getContextValue,
  isKeyword: _isKeyword,
  process: _processContext,
  processingMode: _processingMode
} = require('./context');

const {
  isAbsolute: _isAbsoluteIri
} = require('./url');

const {
  addValue: _addValue,
  asArray: _asArray,
  getValues: _getValues,
  validateTypeValue: _validateTypeValue
} = require('./util');

const api = {};
module.exports = api;
const REGEX_BCP47 = /^[a-zA-Z]{1,8}(-[a-zA-Z0-9]{1,8})*$/;

/**
 * Recursively expands an element using the given context. Any context in
 * the element will be removed. All context URLs must have been retrieved
 * before calling this method.
 *
 * @param activeCtx the context to use.
 * @param activeProperty the property for the element, null for none.
 * @param element the element to expand.
 * @param options the expansion options.
 * @param insideList true if the element is a list, false if not.
 * @param insideIndex true if the element is inside an index container,
 *          false if not.
 * @param typeScopedContext an optional type-scoped active context for
 *          expanding values of nodes that were expressed according to
 *          a type-scoped context.
 * @param expansionMap(info) a function that can be used to custom map
 *          unmappable values (or to throw an error when they are detected);
 *          if this function returns `undefined` then the default behavior
 *          will be used.
 *
 * @return a Promise that resolves to the expanded value.
 */
api.expand = async ({
  activeCtx,
  activeProperty = null,
  element,
  options = {},
  insideList = false,
  insideIndex = false,
  typeScopedContext = null,
  expansionMap = () => undefined
}) => {
  // nothing to expand
  if(element === null || element === undefined) {
    return null;
  }

  // disable framing if activeProperty is @default
  if(activeProperty === '@default') {
    options = Object.assign({}, options, {isFrame: false});
  }

  if(!_isArray(element) && !_isObject(element)) {
    // drop free-floating scalars that are not in lists unless custom mapped
    if(!insideList && (activeProperty === null ||
      _expandIri(activeCtx, activeProperty, {vocab: true},
        options) === '@graph')) {
      const mapped = await expansionMap({
        unmappedValue: element,
        activeCtx,
        activeProperty,
        options,
        insideList
      });
      if(mapped === undefined) {
        return null;
      }
      return mapped;
    }

    // expand element according to value expansion rules
    return _expandValue({activeCtx, activeProperty, value: element, options});
  }

  // recursively expand array
  if(_isArray(element)) {
    let rval = [];
    const container = _getContextValue(
      activeCtx, activeProperty, '@container') || [];
    insideList = insideList || container.includes('@list');
    for(let i = 0; i < element.length; ++i) {
      // expand element
      let e = await api.expand({
        activeCtx,
        activeProperty,
        element: element[i],
        options,
        expansionMap,
        insideIndex,
        typeScopedContext
      });
      if(insideList && _isArray(e)) {
        e = {'@list': e};
      }

      if(e === null) {
        e = await expansionMap({
          unmappedValue: element[i],
          activeCtx,
          activeProperty,
          parent: element,
          index: i,
          options,
          expandedParent: rval,
          insideList
        });
        if(e === undefined) {
          continue;
        }
      }

      if(_isArray(e)) {
        rval = rval.concat(e);
      } else {
        rval.push(e);
      }
    }
    return rval;
  }

  // recursively expand object:

  // first, expand the active property
  const expandedActiveProperty = _expandIri(
    activeCtx, activeProperty, {vocab: true}, options);

  // Get any property-scoped context for activeProperty
  const propertyScopedCtx =
    _getContextValue(activeCtx, activeProperty, '@context');

  // second, determine if any type-scoped context should be reverted; it
  // should only be reverted when the following are all true:
  // 1. `element` is not a value or subject reference
  // 2. `insideIndex` is false
  typeScopedContext = typeScopedContext ||
    (activeCtx.previousContext ? activeCtx : null);
  let keys = Object.keys(element).sort();
  let mustRevert = !insideIndex;
  if(mustRevert && typeScopedContext && keys.length <= 2 &&
    !keys.includes('@context')) {
    for(const key of keys) {
      const expandedProperty = _expandIri(
        typeScopedContext, key, {vocab: true}, options);
      if(expandedProperty === '@value') {
        // value found, ensure type-scoped context is used to expand it
        mustRevert = false;
        activeCtx = typeScopedContext;
        break;
      }
      if(expandedProperty === '@id' && keys.length === 1) {
        // subject reference found, do not revert
        mustRevert = false;
        break;
      }
    }
  }

  if(mustRevert) {
    // revert type scoped context
    activeCtx = activeCtx.revertToPreviousContext();
  }

  // apply property-scoped context after reverting term-scoped context
  if(!_isUndefined(propertyScopedCtx)) {
    activeCtx = await _processContext({
      activeCtx,
      localCtx: propertyScopedCtx,
      propagate: true,
      overrideProtected: true,
      options
    });
  }

  // if element has a context, process it
  if('@context' in element) {
    activeCtx = await _processContext(
      {activeCtx, localCtx: element['@context'], options});
  }

  // set the type-scoped context to the context on input, for use later
  typeScopedContext = activeCtx;

  // Remember the first key found expanding to @type
  let typeKey = null;

  // look for scoped contexts on `@type`
  for(const key of keys) {
    const expandedProperty = _expandIri(activeCtx, key, {vocab: true}, options);
    if(expandedProperty === '@type') {
      // set scoped contexts from @type
      // avoid sorting if possible
      typeKey = typeKey || key;
      const value = element[key];
      const types =
        Array.isArray(value) ?
          (value.length > 1 ? value.slice().sort() : value) : [value];
      for(const type of types) {
        const ctx = _getContextValue(typeScopedContext, type, '@context');
        if(!_isUndefined(ctx)) {
          activeCtx = await _processContext({
            activeCtx,
            localCtx: ctx,
            options,
            propagate: false
          });
        }
      }
    }
  }

  // process each key and value in element, ignoring @nest content
  let rval = {};
  await _expandObject({
    activeCtx,
    activeProperty,
    expandedActiveProperty,
    element,
    expandedParent: rval,
    options,
    insideList,
    typeKey,
    typeScopedContext,
    expansionMap});

  // get property count on expanded output
  keys = Object.keys(rval);
  let count = keys.length;

  if('@value' in rval) {
    // @value must only have @language or @type
    if('@type' in rval && ('@language' in rval || '@direction' in rval)) {
      throw new JsonLdError(
        'Invalid JSON-LD syntax; an element containing "@value" may not ' +
        'contain both "@type" and either "@language" or "@direction".',
        'jsonld.SyntaxError', {code: 'invalid value object', element: rval});
    }
    let validCount = count - 1;
    if('@type' in rval) {
      validCount -= 1;
    }
    if('@index' in rval) {
      validCount -= 1;
    }
    if('@language' in rval) {
      validCount -= 1;
    }
    if('@direction' in rval) {
      validCount -= 1;
    }
    if(validCount !== 0) {
      throw new JsonLdError(
        'Invalid JSON-LD syntax; an element containing "@value" may only ' +
        'have an "@index" property and either "@type" ' +
        'or either or both "@language" or "@direction".',
        'jsonld.SyntaxError', {code: 'invalid value object', element: rval});
    }
    const values = rval['@value'] === null ? [] : _asArray(rval['@value']);
    const types = _getValues(rval, '@type');

    // drop null @values unless custom mapped
    if(_processingMode(activeCtx, 1.1) && types.includes('@json') &&
      types.length === 1) {
      // Any value of @value is okay if @type: @json
    } else if(values.length === 0) {
      const mapped = await expansionMap({
        unmappedValue: rval,
        activeCtx,
        activeProperty,
        element,
        options,
        insideList
      });
      if(mapped !== undefined) {
        rval = mapped;
      } else {
        rval = null;
      }
    } else if(!values.every(v => (_isString(v) || _isEmptyObject(v))) &&
      '@language' in rval) {
      // if @language is present, @value must be a string
      throw new JsonLdError(
        'Invalid JSON-LD syntax; only strings may be language-tagged.',
        'jsonld.SyntaxError',
        {code: 'invalid language-tagged value', element: rval});
    } else if(!types.every(t =>
      (_isAbsoluteIri(t) && !(_isString(t) && t.indexOf('_:') === 0) ||
      _isEmptyObject(t)))) {
      throw new JsonLdError(
        'Invalid JSON-LD syntax; an element containing "@value" and "@type" ' +
        'must have an absolute IRI for the value of "@type".',
        'jsonld.SyntaxError', {code: 'invalid typed value', element: rval});
    }
  } else if('@type' in rval && !_isArray(rval['@type'])) {
    // convert @type to an array
    rval['@type'] = [rval['@type']];
  } else if('@set' in rval || '@list' in rval) {
    // handle @set and @list
    if(count > 1 && !(count === 2 && '@index' in rval)) {
      throw new JsonLdError(
        'Invalid JSON-LD syntax; if an element has the property "@set" ' +
        'or "@list", then it can have at most one other property that is ' +
        '"@index".', 'jsonld.SyntaxError',
        {code: 'invalid set or list object', element: rval});
    }
    // optimize away @set
    if('@set' in rval) {
      rval = rval['@set'];
      keys = Object.keys(rval);
      count = keys.length;
    }
  } else if(count === 1 && '@language' in rval) {
    // drop objects with only @language unless custom mapped
    const mapped = await expansionMap(rval, {
      unmappedValue: rval,
      activeCtx,
      activeProperty,
      element,
      options,
      insideList
    });
    if(mapped !== undefined) {
      rval = mapped;
    } else {
      rval = null;
    }
  }

  // drop certain top-level objects that do not occur in lists, unless custom
  // mapped
  if(_isObject(rval) &&
    !options.keepFreeFloatingNodes && !insideList &&
    (activeProperty === null || expandedActiveProperty === '@graph')) {
    // drop empty object, top-level @value/@list, or object with only @id
    if(count === 0 || '@value' in rval || '@list' in rval ||
      (count === 1 && '@id' in rval)) {
      const mapped = await expansionMap({
        unmappedValue: rval,
        activeCtx,
        activeProperty,
        element,
        options,
        insideList
      });
      if(mapped !== undefined) {
        rval = mapped;
      } else {
        rval = null;
      }
    }
  }

  return rval;
};

/**
 * Expand each key and value of element adding to result
 *
 * @param activeCtx the context to use.
 * @param activeProperty the property for the element.
 * @param expandedActiveProperty the expansion of activeProperty
 * @param element the element to expand.
 * @param expandedParent the expanded result into which to add values.
 * @param options the expansion options.
 * @param insideList true if the element is a list, false if not.
 * @param typeKey first key found expanding to @type.
 * @param typeScopedContext the context before reverting.
 * @param expansionMap(info) a function that can be used to custom map
 *          unmappable values (or to throw an error when they are detected);
 *          if this function returns `undefined` then the default behavior
 *          will be used.
 */
async function _expandObject({
  activeCtx,
  activeProperty,
  expandedActiveProperty,
  element,
  expandedParent,
  options = {},
  insideList,
  typeKey,
  typeScopedContext,
  expansionMap
}) {
  const keys = Object.keys(element).sort();
  const nests = [];
  let unexpandedValue;

  // Figure out if this is the type for a JSON literal
  const isJsonType = element[typeKey] &&
    _expandIri(activeCtx,
      (_isArray(element[typeKey]) ? element[typeKey][0] : element[typeKey]),
      {vocab: true}, options) === '@json';

  for(const key of keys) {
    let value = element[key];
    let expandedValue;

    // skip @context
    if(key === '@context') {
      continue;
    }

    // expand property
    let expandedProperty = _expandIri(activeCtx, key, {vocab: true}, options);

    // drop non-absolute IRI keys that aren't keywords unless custom mapped
    if(expandedProperty === null ||
      !(_isAbsoluteIri(expandedProperty) || _isKeyword(expandedProperty))) {
      // TODO: use `await` to support async
      expandedProperty = expansionMap({
        unmappedProperty: key,
        activeCtx,
        activeProperty,
        parent: element,
        options,
        insideList,
        value,
        expandedParent
      });
      if(expandedProperty === undefined) {
        continue;
      }
    }

    if(_isKeyword(expandedProperty)) {
      if(expandedActiveProperty === '@reverse') {
        throw new JsonLdError(
          'Invalid JSON-LD syntax; a keyword cannot be used as a @reverse ' +
          'property.', 'jsonld.SyntaxError',
          {code: 'invalid reverse property map', value});
      }
      if(expandedProperty in expandedParent &&
         expandedProperty !== '@included' &&
         expandedProperty !== '@type') {
        throw new JsonLdError(
          'Invalid JSON-LD syntax; colliding keywords detected.',
          'jsonld.SyntaxError',
          {code: 'colliding keywords', keyword: expandedProperty});
      }
    }

    // syntax error if @id is not a string
    if(expandedProperty === '@id') {
      if(!_isString(value)) {
        if(!options.isFrame) {
          throw new JsonLdError(
            'Invalid JSON-LD syntax; "@id" value must a string.',
            'jsonld.SyntaxError', {code: 'invalid @id value', value});
        }
        if(_isObject(value)) {
          // empty object is a wildcard
          if(!_isEmptyObject(value)) {
            throw new JsonLdError(
              'Invalid JSON-LD syntax; "@id" value an empty object or array ' +
              'of strings, if framing',
              'jsonld.SyntaxError', {code: 'invalid @id value', value});
          }
        } else if(_isArray(value)) {
          if(!value.every(v => _isString(v))) {
            throw new JsonLdError(
              'Invalid JSON-LD syntax; "@id" value an empty object or array ' +
              'of strings, if framing',
              'jsonld.SyntaxError', {code: 'invalid @id value', value});
          }
        } else {
          throw new JsonLdError(
            'Invalid JSON-LD syntax; "@id" value an empty object or array ' +
            'of strings, if framing',
            'jsonld.SyntaxError', {code: 'invalid @id value', value});
        }
      }

      _addValue(
        expandedParent, '@id',
        _asArray(value).map(v =>
          _isString(v) ? _expandIri(activeCtx, v, {base: true}, options) : v),
        {propertyIsArray: options.isFrame});
      continue;
    }

    if(expandedProperty === '@type') {
      // if framing, can be a default object, but need to expand
      // key to determine that
      if(_isObject(value)) {
        value = Object.fromEntries(Object.entries(value).map(([k, v]) => [
          _expandIri(typeScopedContext, k, {vocab: true}),
          _asArray(v).map(vv =>
            _expandIri(typeScopedContext, vv, {base: true, vocab: true})
          )
        ]));
      }
      _validateTypeValue(value, options.isFrame);
      _addValue(
        expandedParent, '@type',
        _asArray(value).map(v =>
          _isString(v) ?
            _expandIri(typeScopedContext, v,
              {base: true, vocab: true}, options) : v),
        {propertyIsArray: options.isFrame});
      continue;
    }

    // Included blocks are treated as an array of separate object nodes sharing
    // the same referencing active_property.
    // For 1.0, it is skipped as are other unknown keywords
    if(expandedProperty === '@included' && _processingMode(activeCtx, 1.1)) {
      const includedResult = _asArray(await api.expand({
        activeCtx,
        activeProperty,
        element: value,
        options,
        expansionMap
      }));

      // Expanded values must be node objects
      if(!includedResult.every(v => _isSubject(v))) {
        throw new JsonLdError(
          'Invalid JSON-LD syntax; ' +
          'values of @included must expand to node objects.',
          'jsonld.SyntaxError', {code: 'invalid @included value', value});
      }

      _addValue(
        expandedParent, '@included', includedResult, {propertyIsArray: true});
      continue;
    }

    // @graph must be an array or an object
    if(expandedProperty === '@graph' &&
      !(_isObject(value) || _isArray(value))) {
      throw new JsonLdError(
        'Invalid JSON-LD syntax; "@graph" value must not be an ' +
        'object or an array.',
        'jsonld.SyntaxError', {code: 'invalid @graph value', value});
    }

    if(expandedProperty === '@value') {
      // capture value for later
      // "colliding keywords" check prevents this from being set twice
      unexpandedValue = value;
      if(isJsonType && _processingMode(activeCtx, 1.1)) {
        // no coercion to array, and retain all values
        expandedParent['@value'] = value;
      } else {
        _addValue(
          expandedParent, '@value', value, {propertyIsArray: options.isFrame});
      }
      continue;
    }

    // @language must be a string
    // it should match BCP47
    if(expandedProperty === '@language') {
      if(value === null) {
        // drop null @language values, they expand as if they didn't exist
        continue;
      }
      if(!_isString(value) && !options.isFrame) {
        throw new JsonLdError(
          'Invalid JSON-LD syntax; "@language" value must be a string.',
          'jsonld.SyntaxError',
          {code: 'invalid language-tagged string', value});
      }
      // ensure language value is lowercase
      value = _asArray(value).map(v => _isString(v) ? v.toLowerCase() : v);

      // ensure language tag matches BCP47
      for(const lang of value) {
        if(_isString(lang) && !lang.match(REGEX_BCP47)) {
          console.warn(`@language must be valid BCP47: ${lang}`);
        }
      }

      _addValue(
        expandedParent, '@language', value, {propertyIsArray: options.isFrame});
      continue;
    }

    // @direction must be "ltr" or "rtl"
    if(expandedProperty === '@direction') {
      if(!_isString(value) && !options.isFrame) {
        throw new JsonLdError(
          'Invalid JSON-LD syntax; "@direction" value must be a string.',
          'jsonld.SyntaxError',
          {code: 'invalid base direction', value});
      }

      value = _asArray(value);

      // ensure direction is "ltr" or "rtl"
      for(const dir of value) {
        if(_isString(dir) && dir !== 'ltr' && dir !== 'rtl') {
          throw new JsonLdError(
            'Invalid JSON-LD syntax; "@direction" must be "ltr" or "rtl".',
            'jsonld.SyntaxError',
            {code: 'invalid base direction', value});
        }
      }

      _addValue(
        expandedParent, '@direction', value,
        {propertyIsArray: options.isFrame});
      continue;
    }

    // @index must be a string
    if(expandedProperty === '@index') {
      if(!_isString(value)) {
        throw new JsonLdError(
          'Invalid JSON-LD syntax; "@index" value must be a string.',
          'jsonld.SyntaxError',
          {code: 'invalid @index value', value});
      }
      _addValue(expandedParent, '@index', value);
      continue;
    }

    // @reverse must be an object
    if(expandedProperty === '@reverse') {
      if(!_isObject(value)) {
        throw new JsonLdError(
          'Invalid JSON-LD syntax; "@reverse" value must be an object.',
          'jsonld.SyntaxError', {code: 'invalid @reverse value', value});
      }

      expandedValue = await api.expand({
        activeCtx,
        activeProperty:
        '@reverse',
        element: value,
        options,
        expansionMap
      });
      // properties double-reversed
      if('@reverse' in expandedValue) {
        for(const property in expandedValue['@reverse']) {
          _addValue(
            expandedParent, property, expandedValue['@reverse'][property],
            {propertyIsArray: true});
        }
      }

      // FIXME: can this be merged with code below to simplify?
      // merge in all reversed properties
      let reverseMap = expandedParent['@reverse'] || null;
      for(const property in expandedValue) {
        if(property === '@reverse') {
          continue;
        }
        if(reverseMap === null) {
          reverseMap = expandedParent['@reverse'] = {};
        }
        _addValue(reverseMap, property, [], {propertyIsArray: true});
        const items = expandedValue[property];
        for(let ii = 0; ii < items.length; ++ii) {
          const item = items[ii];
          if(_isValue(item) || _isList(item)) {
            throw new JsonLdError(
              'Invalid JSON-LD syntax; "@reverse" value must not be a ' +
              '@value or an @list.', 'jsonld.SyntaxError',
              {code: 'invalid reverse property value', value: expandedValue});
          }
          _addValue(reverseMap, property, item, {propertyIsArray: true});
        }
      }

      continue;
    }

    // nested keys
    if(expandedProperty === '@nest') {
      nests.push(key);
      continue;
    }

    // use potential scoped context for key
    let termCtx = activeCtx;
    const ctx = _getContextValue(activeCtx, key, '@context');
    if(!_isUndefined(ctx)) {
      termCtx = await _processContext({
        activeCtx,
        localCtx: ctx,
        propagate: true,
        overrideProtected: true,
        options
      });
    }

    const container = _getContextValue(termCtx, key, '@container') || [];

    if(container.includes('@language') && _isObject(value)) {
      const direction = _getContextValue(termCtx, key, '@direction');
      // handle language map container (skip if value is not an object)
      expandedValue = _expandLanguageMap(termCtx, value, direction, options);
    } else if(container.includes('@index') && _isObject(value)) {
      // handle index container (skip if value is not an object)
      const asGraph = container.includes('@graph');
      const indexKey = _getContextValue(termCtx, key, '@index') || '@index';
      const propertyIndex = indexKey !== '@index' &&
        _expandIri(activeCtx, indexKey, {vocab: true}, options);

      expandedValue = await _expandIndexMap({
        activeCtx: termCtx,
        options,
        activeProperty: key,
        value,
        expansionMap,
        asGraph,
        indexKey,
        propertyIndex
      });
    } else if(container.includes('@id') && _isObject(value)) {
      // handle id container (skip if value is not an object)
      const asGraph = container.includes('@graph');
      expandedValue = await _expandIndexMap({
        activeCtx: termCtx,
        options,
        activeProperty: key,
        value,
        expansionMap,
        asGraph,
        indexKey: '@id'
      });
    } else if(container.includes('@type') && _isObject(value)) {
      // handle type container (skip if value is not an object)
      expandedValue = await _expandIndexMap({
        // since container is `@type`, revert type scoped context when expanding
        activeCtx: termCtx.revertToPreviousContext(),
        options,
        activeProperty: key,
        value,
        expansionMap,
        asGraph: false,
        indexKey: '@type'
      });
    } else {
      // recurse into @list or @set
      const isList = (expandedProperty === '@list');
      if(isList || expandedProperty === '@set') {
        let nextActiveProperty = activeProperty;
        if(isList && expandedActiveProperty === '@graph') {
          nextActiveProperty = null;
        }
        expandedValue = await api.expand({
          activeCtx: termCtx,
          activeProperty: nextActiveProperty,
          element: value,
          options,
          insideList: isList,
          expansionMap
        });
      } else if(
        _getContextValue(activeCtx, key, '@type') === '@json') {
        expandedValue = {
          '@type': '@json',
          '@value': value
        };
      } else {
        // recursively expand value with key as new active property
        expandedValue = await api.expand({
          activeCtx: termCtx,
          activeProperty: key,
          element: value,
          options,
          insideList: false,
          expansionMap
        });
      }
    }

    // drop null values if property is not @value
    if(expandedValue === null && expandedProperty !== '@value') {
      // TODO: use `await` to support async
      expandedValue = expansionMap({
        unmappedValue: value,
        expandedProperty,
        activeCtx: termCtx,
        activeProperty,
        parent: element,
        options,
        insideList,
        key,
        expandedParent
      });
      if(expandedValue === undefined) {
        continue;
      }
    }

    // convert expanded value to @list if container specifies it
    if(expandedProperty !== '@list' && !_isList(expandedValue) &&
      container.includes('@list')) {
      // ensure expanded value in @list is an array
      expandedValue = {'@list': _asArray(expandedValue)};
    }

    // convert expanded value to @graph if container specifies it
    // and value is not, itself, a graph
    // index cases handled above
    if(container.includes('@graph') &&
      !container.some(key => key === '@id' || key === '@index')) {
      // ensure expanded values are arrays
      expandedValue = _asArray(expandedValue)
        .map(v => ({'@graph': _asArray(v)}));
    }

    // FIXME: can this be merged with code above to simplify?
    // merge in reverse properties
    if(termCtx.mappings.has(key) && termCtx.mappings.get(key).reverse) {
      const reverseMap =
        expandedParent['@reverse'] = expandedParent['@reverse'] || {};
      expandedValue = _asArray(expandedValue);
      for(let ii = 0; ii < expandedValue.length; ++ii) {
        const item = expandedValue[ii];
        if(_isValue(item) || _isList(item)) {
          throw new JsonLdError(
            'Invalid JSON-LD syntax; "@reverse" value must not be a ' +
            '@value or an @list.', 'jsonld.SyntaxError',
            {code: 'invalid reverse property value', value: expandedValue});
        }
        _addValue(reverseMap, expandedProperty, item, {propertyIsArray: true});
      }
      continue;
    }

    // add value for property
    // special keywords handled above
    _addValue(expandedParent, expandedProperty, expandedValue, {
      propertyIsArray: true
    });
  }

  // @value must not be an object or an array (unless framing) or if @type is
  // @json
  if('@value' in expandedParent) {
    if(expandedParent['@type'] === '@json' && _processingMode(activeCtx, 1.1)) {
      // allow any value, to be verified when the object is fully expanded and
      // the @type is @json.
    } else if((_isObject(unexpandedValue) || _isArray(unexpandedValue)) &&
      !options.isFrame) {
      throw new JsonLdError(
        'Invalid JSON-LD syntax; "@value" value must not be an ' +
        'object or an array.',
        'jsonld.SyntaxError',
        {code: 'invalid value object value', value: unexpandedValue});
    }
  }

  // expand each nested key
  for(const key of nests) {
    const nestedValues = _isArray(element[key]) ? element[key] : [element[key]];
    for(const nv of nestedValues) {
      if(!_isObject(nv) || Object.keys(nv).some(k =>
        _expandIri(activeCtx, k, {vocab: true}, options) === '@value')) {
        throw new JsonLdError(
          'Invalid JSON-LD syntax; nested value must be a node object.',
          'jsonld.SyntaxError',
          {code: 'invalid @nest value', value: nv});
      }
      await _expandObject({
        activeCtx,
        activeProperty,
        expandedActiveProperty,
        element: nv,
        expandedParent,
        options,
        insideList,
        typeScopedContext,
        typeKey,
        expansionMap});
    }
  }
}

/**
 * Expands the given value by using the coercion and keyword rules in the
 * given context.
 *
 * @param activeCtx the active context to use.
 * @param activeProperty the active property the value is associated with.
 * @param value the value to expand.
 * @param {Object} [options] - processing options.
 *
 * @return the expanded value.
 */
function _expandValue({activeCtx, activeProperty, value, options}) {
  // nothing to expand
  if(value === null || value === undefined) {
    return null;
  }

  // special-case expand @id and @type (skips '@id' expansion)
  const expandedProperty = _expandIri(
    activeCtx, activeProperty, {vocab: true}, options);
  if(expandedProperty === '@id') {
    return _expandIri(activeCtx, value, {base: true}, options);
  } else if(expandedProperty === '@type') {
    return _expandIri(activeCtx, value, {vocab: true, base: true}, options);
  }

  // get type definition from context
  const type = _getContextValue(activeCtx, activeProperty, '@type');

  // do @id expansion (automatic for @graph)
  if((type === '@id' || expandedProperty === '@graph') && _isString(value)) {
    return {'@id': _expandIri(activeCtx, value, {base: true}, options)};
  }
  // do @id expansion w/vocab
  if(type === '@vocab' && _isString(value)) {
    return {
      '@id': _expandIri(activeCtx, value, {vocab: true, base: true}, options)
    };
  }

  // do not expand keyword values
  if(_isKeyword(expandedProperty)) {
    return value;
  }

  const rval = {};

  if(type && !['@id', '@vocab', '@none'].includes(type)) {
    // other type
    rval['@type'] = type;
  } else if(_isString(value)) {
    // check for language tagging for strings
    const language = _getContextValue(activeCtx, activeProperty, '@language');
    if(language !== null) {
      rval['@language'] = language;
    }
    const direction = _getContextValue(activeCtx, activeProperty, '@direction');
    if(direction !== null) {
      rval['@direction'] = direction;
    }
  }
  // do conversion of values that aren't basic JSON types to strings
  if(!['boolean', 'number', 'string'].includes(typeof value)) {
    value = value.toString();
  }
  rval['@value'] = value;

  return rval;
}

/**
 * Expands a language map.
 *
 * @param activeCtx the active context to use.
 * @param languageMap the language map to expand.
 * @param direction the direction to apply to values.
 * @param {Object} [options] - processing options.
 *
 * @return the expanded language map.
 */
function _expandLanguageMap(activeCtx, languageMap, direction, options) {
  const rval = [];
  const keys = Object.keys(languageMap).sort();
  for(const key of keys) {
    const expandedKey = _expandIri(activeCtx, key, {vocab: true}, options);
    let val = languageMap[key];
    if(!_isArray(val)) {
      val = [val];
    }
    for(const item of val) {
      if(item === null) {
        // null values are allowed (8.5) but ignored (3.1)
        continue;
      }
      if(!_isString(item)) {
        throw new JsonLdError(
          'Invalid JSON-LD syntax; language map values must be strings.',
          'jsonld.SyntaxError',
          {code: 'invalid language map value', languageMap});
      }
      const val = {'@value': item};
      if(expandedKey !== '@none') {
        val['@language'] = key.toLowerCase();
      }
      if(direction) {
        val['@direction'] = direction;
      }
      rval.push(val);
    }
  }
  return rval;
}

async function _expandIndexMap(
  {activeCtx, options, activeProperty, value, expansionMap, asGraph,
    indexKey, propertyIndex}) {
  const rval = [];
  const keys = Object.keys(value).sort();
  const isTypeIndex = indexKey === '@type';
  for(let key of keys) {
    // if indexKey is @type, there may be a context defined for it
    if(isTypeIndex) {
      const ctx = _getContextValue(activeCtx, key, '@context');
      if(!_isUndefined(ctx)) {
        activeCtx = await _processContext({
          activeCtx,
          localCtx: ctx,
          propagate: false,
          options
        });
      }
    }

    let val = value[key];
    if(!_isArray(val)) {
      val = [val];
    }

    val = await api.expand({
      activeCtx,
      activeProperty,
      element: val,
      options,
      insideList: false,
      insideIndex: true,
      expansionMap
    });

    // expand for @type, but also for @none
    let expandedKey;
    if(propertyIndex) {
      if(key === '@none') {
        expandedKey = '@none';
      } else {
        expandedKey = _expandValue(
          {activeCtx, activeProperty: indexKey, value: key, options});
      }
    } else {
      expandedKey = _expandIri(activeCtx, key, {vocab: true}, options);
    }

    if(indexKey === '@id') {
      // expand document relative
      key = _expandIri(activeCtx, key, {base: true}, options);
    } else if(isTypeIndex) {
      key = expandedKey;
    }

    for(let item of val) {
      // If this is also a @graph container, turn items into graphs
      if(asGraph && !_isGraph(item)) {
        item = {'@graph': [item]};
      }
      if(indexKey === '@type') {
        if(expandedKey === '@none') {
          // ignore @none
        } else if(item['@type']) {
          item['@type'] = [key].concat(item['@type']);
        } else {
          item['@type'] = [key];
        }
      } else if(_isValue(item) &&
        !['@language', '@type', '@index'].includes(indexKey)) {
        throw new JsonLdError(
          'Invalid JSON-LD syntax; Attempt to add illegal key to value ' +
          `object: "${indexKey}".`,
          'jsonld.SyntaxError',
          {code: 'invalid value object', value: item});
      } else if(propertyIndex) {
        // index is a property to be expanded, and values interpreted for that
        // property
        if(expandedKey !== '@none') {
          // expand key as a value
          _addValue(item, propertyIndex, expandedKey, {
            propertyIsArray: true,
            prependValue: true
          });
        }
      } else if(expandedKey !== '@none' && !(indexKey in item)) {
        item[indexKey] = key;
      }
      rval.push(item);
    }
  }
  return rval;
}

},{"./JsonLdError":44,"./context":51,"./graphTypes":57,"./types":62,"./url":63,"./util":64}],54:[function(require,module,exports){
/*
 * Copyright (c) 2017 Digital Bazaar, Inc. All rights reserved.
 */
'use strict';

const {
  isSubjectReference: _isSubjectReference
} = require('./graphTypes');

const {
  createMergedNodeMap: _createMergedNodeMap
} = require('./nodeMap');

const api = {};
module.exports = api;

/**
 * Performs JSON-LD flattening.
 *
 * @param input the expanded JSON-LD to flatten.
 *
 * @return the flattened output.
 */
api.flatten = input => {
  const defaultGraph = _createMergedNodeMap(input);

  // produce flattened output
  const flattened = [];
  const keys = Object.keys(defaultGraph).sort();
  for(let ki = 0; ki < keys.length; ++ki) {
    const node = defaultGraph[keys[ki]];
    // only add full subjects to top-level
    if(!_isSubjectReference(node)) {
      flattened.push(node);
    }
  }
  return flattened;
};

},{"./graphTypes":57,"./nodeMap":59}],55:[function(require,module,exports){
/*
 * Copyright (c) 2017 Digital Bazaar, Inc. All rights reserved.
 */
'use strict';

const {isKeyword} = require('./context');
const graphTypes = require('./graphTypes');
const types = require('./types');
const util = require('./util');
const url = require('./url');
const JsonLdError = require('./JsonLdError');
const {
  createNodeMap: _createNodeMap,
  mergeNodeMapGraphs: _mergeNodeMapGraphs
} = require('./nodeMap');

const api = {};
module.exports = api;

/**
 * Performs JSON-LD `merged` framing.
 *
 * @param input the expanded JSON-LD to frame.
 * @param frame the expanded JSON-LD frame to use.
 * @param options the framing options.
 *
 * @return the framed output.
 */
api.frameMergedOrDefault = (input, frame, options) => {
  // create framing state
  const state = {
    options,
    embedded: false,
    graph: '@default',
    graphMap: {'@default': {}},
    subjectStack: [],
    link: {},
    bnodeMap: {}
  };

  // produce a map of all graphs and name each bnode
  // FIXME: currently uses subjects from @merged graph only
  const issuer = new util.IdentifierIssuer('_:b');
  _createNodeMap(input, state.graphMap, '@default', issuer);
  if(options.merged) {
    state.graphMap['@merged'] = _mergeNodeMapGraphs(state.graphMap);
    state.graph = '@merged';
  }
  state.subjects = state.graphMap[state.graph];

  // frame the subjects
  const framed = [];
  api.frame(state, Object.keys(state.subjects).sort(), frame, framed);

  // If pruning blank nodes, find those to prune
  if(options.pruneBlankNodeIdentifiers) {
    // remove all blank nodes appearing only once, done in compaction
    options.bnodesToClear =
      Object.keys(state.bnodeMap).filter(id => state.bnodeMap[id].length === 1);
  }

  // remove @preserve from results
  options.link = {};
  return _cleanupPreserve(framed, options);
};

/**
 * Frames subjects according to the given frame.
 *
 * @param state the current framing state.
 * @param subjects the subjects to filter.
 * @param frame the frame.
 * @param parent the parent subject or top-level array.
 * @param property the parent property, initialized to null.
 */
api.frame = (state, subjects, frame, parent, property = null) => {
  // validate the frame
  _validateFrame(frame);
  frame = frame[0];

  // get flags for current frame
  const options = state.options;
  const flags = {
    embed: _getFrameFlag(frame, options, 'embed'),
    explicit: _getFrameFlag(frame, options, 'explicit'),
    requireAll: _getFrameFlag(frame, options, 'requireAll')
  };

  // get link for current graph
  if(!state.link.hasOwnProperty(state.graph)) {
    state.link[state.graph] = {};
  }
  const link = state.link[state.graph];

  // filter out subjects that match the frame
  const matches = _filterSubjects(state, subjects, frame, flags);

  // add matches to output
  const ids = Object.keys(matches).sort();
  for(const id of ids) {
    const subject = matches[id];

    /* Note: In order to treat each top-level match as a compartmentalized
    result, clear the unique embedded subjects map when the property is null,
    which only occurs at the top-level. */
    if(property === null) {
      state.uniqueEmbeds = {[state.graph]: {}};
    } else {
      state.uniqueEmbeds[state.graph] = state.uniqueEmbeds[state.graph] || {};
    }

    if(flags.embed === '@link' && id in link) {
      // TODO: may want to also match an existing linked subject against
      // the current frame ... so different frames could produce different
      // subjects that are only shared in-memory when the frames are the same

      // add existing linked subject
      _addFrameOutput(parent, property, link[id]);
      continue;
    }

    // start output for subject
    const output = {'@id': id};
    if(id.indexOf('_:') === 0) {
      util.addValue(state.bnodeMap, id, output, {propertyIsArray: true});
    }
    link[id] = output;

    // validate @embed
    if((flags.embed === '@first' || flags.embed === '@last') && state.is11) {
      throw new JsonLdError(
        'Invalid JSON-LD syntax; invalid value of @embed.',
        'jsonld.SyntaxError', {code: 'invalid @embed value', frame});
    }

    if(!state.embedded && state.uniqueEmbeds[state.graph].hasOwnProperty(id)) {
      // skip adding this node object to the top level, as it was
      // already included in another node object
      continue;
    }

    // if embed is @never or if a circular reference would be created by an
    // embed, the subject cannot be embedded, just add the reference;
    // note that a circular reference won't occur when the embed flag is
    // `@link` as the above check will short-circuit before reaching this point
    if(state.embedded &&
      (flags.embed === '@never' ||
      _createsCircularReference(subject, state.graph, state.subjectStack))) {
      _addFrameOutput(parent, property, output);
      continue;
    }

    // if only the first (or once) should be embedded
    if(state.embedded &&
       (flags.embed == '@first' || flags.embed == '@once') &&
       state.uniqueEmbeds[state.graph].hasOwnProperty(id)) {
      _addFrameOutput(parent, property, output);
      continue;
    }

    // if only the last match should be embedded
    if(flags.embed === '@last') {
      // remove any existing embed
      if(id in state.uniqueEmbeds[state.graph]) {
        _removeEmbed(state, id);
      }
    }

    state.uniqueEmbeds[state.graph][id] = {parent, property};

    // push matching subject onto stack to enable circular embed checks
    state.subjectStack.push({subject, graph: state.graph});

    // subject is also the name of a graph
    if(id in state.graphMap) {
      let recurse = false;
      let subframe = null;
      if(!('@graph' in frame)) {
        recurse = state.graph !== '@merged';
        subframe = {};
      } else {
        subframe = frame['@graph'][0];
        recurse = !(id === '@merged' || id === '@default');
        if(!types.isObject(subframe)) {
          subframe = {};
        }
      }

      if(recurse) {
        // recurse into graph
        api.frame(
          {...state, graph: id, embedded: false},
          Object.keys(state.graphMap[id]).sort(), [subframe], output, '@graph');
      }
    }

    // if frame has @included, recurse over its sub-frame
    if('@included' in frame) {
      api.frame(
        {...state, embedded: false},
        subjects, frame['@included'], output, '@included');
    }

    // iterate over subject properties
    for(const prop of Object.keys(subject).sort()) {
      // copy keywords to output
      if(isKeyword(prop)) {
        output[prop] = util.clone(subject[prop]);

        if(prop === '@type') {
          // count bnode values of @type
          for(const type of subject['@type']) {
            if(type.indexOf('_:') === 0) {
              util.addValue(
                state.bnodeMap, type, output, {propertyIsArray: true});
            }
          }
        }
        continue;
      }

      // explicit is on and property isn't in the frame, skip processing
      if(flags.explicit && !(prop in frame)) {
        continue;
      }

      // add objects
      for(const o of subject[prop]) {
        const subframe = (prop in frame ?
          frame[prop] : _createImplicitFrame(flags));

        // recurse into list
        if(graphTypes.isList(o)) {
          const subframe =
            (frame[prop] && frame[prop][0] && frame[prop][0]['@list']) ?
              frame[prop][0]['@list'] :
              _createImplicitFrame(flags);

          // add empty list
          const list = {'@list': []};
          _addFrameOutput(output, prop, list);

          // add list objects
          const src = o['@list'];
          for(const oo of src) {
            if(graphTypes.isSubjectReference(oo)) {
              // recurse into subject reference
              api.frame(
                {...state, embedded: true},
                [oo['@id']], subframe, list, '@list');
            } else {
              // include other values automatically
              _addFrameOutput(list, '@list', util.clone(oo));
            }
          }
        } else if(graphTypes.isSubjectReference(o)) {
          // recurse into subject reference
          api.frame(
            {...state, embedded: true},
            [o['@id']], subframe, output, prop);
        } else if(_valueMatch(subframe[0], o)) {
          // include other values, if they match
          _addFrameOutput(output, prop, util.clone(o));
        }
      }
    }

    // handle defaults
    for(const prop of Object.keys(frame).sort()) {
      // skip keywords
      if(prop === '@type') {
        if(!types.isObject(frame[prop][0]) ||
           !('@default' in frame[prop][0])) {
          continue;
        }
        // allow through default types
      } else if(isKeyword(prop)) {
        continue;
      }

      // if omit default is off, then include default values for properties
      // that appear in the next frame but are not in the matching subject
      const next = frame[prop][0] || {};
      const omitDefaultOn = _getFrameFlag(next, options, 'omitDefault');
      if(!omitDefaultOn && !(prop in output)) {
        let preserve = '@null';
        if('@default' in next) {
          preserve = util.clone(next['@default']);
        }
        if(!types.isArray(preserve)) {
          preserve = [preserve];
        }
        output[prop] = [{'@preserve': preserve}];
      }
    }

    // if embed reverse values by finding nodes having this subject as a value
    // of the associated property
    for(const reverseProp of Object.keys(frame['@reverse'] || {}).sort()) {
      const subframe = frame['@reverse'][reverseProp];
      for(const subject of Object.keys(state.subjects)) {
        const nodeValues =
          util.getValues(state.subjects[subject], reverseProp);
        if(nodeValues.some(v => v['@id'] === id)) {
          // node has property referencing this subject, recurse
          output['@reverse'] = output['@reverse'] || {};
          util.addValue(
            output['@reverse'], reverseProp, [], {propertyIsArray: true});
          api.frame(
            {...state, embedded: true},
            [subject], subframe, output['@reverse'][reverseProp],
            property);
        }
      }
    }

    // add output to parent
    _addFrameOutput(parent, property, output);

    // pop matching subject from circular ref-checking stack
    state.subjectStack.pop();
  }
};

/**
 * Replace `@null` with `null`, removing it from arrays.
 *
 * @param input the framed, compacted output.
 * @param options the framing options used.
 *
 * @return the resulting output.
 */
api.cleanupNull = (input, options) => {
  // recurse through arrays
  if(types.isArray(input)) {
    const noNulls = input.map(v => api.cleanupNull(v, options));
    return noNulls.filter(v => v); // removes nulls from array
  }

  if(input === '@null') {
    return null;
  }

  if(types.isObject(input)) {
    // handle in-memory linked nodes
    if('@id' in input) {
      const id = input['@id'];
      if(options.link.hasOwnProperty(id)) {
        const idx = options.link[id].indexOf(input);
        if(idx !== -1) {
          // already visited
          return options.link[id][idx];
        }
        // prevent circular visitation
        options.link[id].push(input);
      } else {
        // prevent circular visitation
        options.link[id] = [input];
      }
    }

    for(const key in input) {
      input[key] = api.cleanupNull(input[key], options);
    }
  }
  return input;
};

/**
 * Creates an implicit frame when recursing through subject matches. If
 * a frame doesn't have an explicit frame for a particular property, then
 * a wildcard child frame will be created that uses the same flags that the
 * parent frame used.
 *
 * @param flags the current framing flags.
 *
 * @return the implicit frame.
 */
function _createImplicitFrame(flags) {
  const frame = {};
  for(const key in flags) {
    if(flags[key] !== undefined) {
      frame['@' + key] = [flags[key]];
    }
  }
  return [frame];
}

/**
 * Checks the current subject stack to see if embedding the given subject
 * would cause a circular reference.
 *
 * @param subjectToEmbed the subject to embed.
 * @param graph the graph the subject to embed is in.
 * @param subjectStack the current stack of subjects.
 *
 * @return true if a circular reference would be created, false if not.
 */
function _createsCircularReference(subjectToEmbed, graph, subjectStack) {
  for(let i = subjectStack.length - 1; i >= 0; --i) {
    const subject = subjectStack[i];
    if(subject.graph === graph &&
      subject.subject['@id'] === subjectToEmbed['@id']) {
      return true;
    }
  }
  return false;
}

/**
 * Gets the frame flag value for the given flag name.
 *
 * @param frame the frame.
 * @param options the framing options.
 * @param name the flag name.
 *
 * @return the flag value.
 */
function _getFrameFlag(frame, options, name) {
  const flag = '@' + name;
  let rval = (flag in frame ? frame[flag][0] : options[name]);
  if(name === 'embed') {
    // default is "@last"
    // backwards-compatibility support for "embed" maps:
    // true => "@last"
    // false => "@never"
    if(rval === true) {
      rval = '@once';
    } else if(rval === false) {
      rval = '@never';
    } else if(rval !== '@always' && rval !== '@never' && rval !== '@link' &&
      rval !== '@first' && rval !== '@last' && rval !== '@once') {
      throw new JsonLdError(
        'Invalid JSON-LD syntax; invalid value of @embed.',
        'jsonld.SyntaxError', {code: 'invalid @embed value', frame});
    }
  }
  return rval;
}

/**
 * Validates a JSON-LD frame, throwing an exception if the frame is invalid.
 *
 * @param frame the frame to validate.
 */
function _validateFrame(frame) {
  if(!types.isArray(frame) || frame.length !== 1 || !types.isObject(frame[0])) {
    throw new JsonLdError(
      'Invalid JSON-LD syntax; a JSON-LD frame must be a single object.',
      'jsonld.SyntaxError', {frame});
  }

  if('@id' in frame[0]) {
    for(const id of util.asArray(frame[0]['@id'])) {
      // @id must be wildcard or an IRI
      if(!(types.isObject(id) || url.isAbsolute(id)) ||
        (types.isString(id) && id.indexOf('_:') === 0)) {
        throw new JsonLdError(
          'Invalid JSON-LD syntax; invalid @id in frame.',
          'jsonld.SyntaxError', {code: 'invalid frame', frame});
      }
    }
  }

  if('@type' in frame[0]) {
    for(const type of util.asArray(frame[0]['@type'])) {
      // @id must be wildcard or an IRI
      if(!(types.isObject(type) || url.isAbsolute(type)) ||
        (types.isString(type) && type.indexOf('_:') === 0)) {
        throw new JsonLdError(
          'Invalid JSON-LD syntax; invalid @type in frame.',
          'jsonld.SyntaxError', {code: 'invalid frame', frame});
      }
    }
  }
}

/**
 * Returns a map of all of the subjects that match a parsed frame.
 *
 * @param state the current framing state.
 * @param subjects the set of subjects to filter.
 * @param frame the parsed frame.
 * @param flags the frame flags.
 *
 * @return all of the matched subjects.
 */
function _filterSubjects(state, subjects, frame, flags) {
  // filter subjects in @id order
  const rval = {};
  for(const id of subjects) {
    const subject = state.graphMap[state.graph][id];
    if(_filterSubject(state, subject, frame, flags)) {
      rval[id] = subject;
    }
  }
  return rval;
}

/**
 * Returns true if the given subject matches the given frame.
 *
 * Matches either based on explicit type inclusion where the node has any
 * type listed in the frame. If the frame has empty types defined matches
 * nodes not having a @type. If the frame has a type of {} defined matches
 * nodes having any type defined.
 *
 * Otherwise, does duck typing, where the node must have all of the
 * properties defined in the frame.
 *
 * @param state the current framing state.
 * @param subject the subject to check.
 * @param frame the frame to check.
 * @param flags the frame flags.
 *
 * @return true if the subject matches, false if not.
 */
function _filterSubject(state, subject, frame, flags) {
  // check ducktype
  let wildcard = true;
  let matchesSome = false;

  for(const key in frame) {
    let matchThis = false;
    const nodeValues = util.getValues(subject, key);
    const isEmpty = util.getValues(frame, key).length === 0;

    if(key === '@id') {
      // match on no @id or any matching @id, including wildcard
      if(types.isEmptyObject(frame['@id'][0] || {})) {
        matchThis = true;
      } else if(frame['@id'].length >= 0) {
        matchThis = frame['@id'].includes(nodeValues[0]);
      }
      if(!flags.requireAll) {
        return matchThis;
      }
    } else if(key === '@type') {
      // check @type (object value means 'any' type,
      // fall through to ducktyping)
      wildcard = false;
      if(isEmpty) {
        if(nodeValues.length > 0) {
          // don't match on no @type
          return false;
        }
        matchThis = true;
      } else if(frame['@type'].length === 1 &&
        types.isEmptyObject(frame['@type'][0])) {
        // match on wildcard @type if there is a type
        matchThis = nodeValues.length > 0;
      } else {
        // match on a specific @type
        for(const type of frame['@type']) {
          if(types.isObject(type) && '@default' in type) {
            // match on default object
            matchThis = true;
          } else {
            matchThis = matchThis || nodeValues.some(tt => tt === type);
          }
        }
      }
      if(!flags.requireAll) {
        return matchThis;
      }
    } else if(isKeyword(key)) {
      continue;
    } else {
      // Force a copy of this frame entry so it can be manipulated
      const thisFrame = util.getValues(frame, key)[0];
      let hasDefault = false;
      if(thisFrame) {
        _validateFrame([thisFrame]);
        hasDefault = '@default' in thisFrame;
      }

      // no longer a wildcard pattern if frame has any non-keyword properties
      wildcard = false;

      // skip, but allow match if node has no value for property, and frame has
      // a default value
      if(nodeValues.length === 0 && hasDefault) {
        continue;
      }

      // if frame value is empty, don't match if subject has any value
      if(nodeValues.length > 0 && isEmpty) {
        return false;
      }

      if(thisFrame === undefined) {
        // node does not match if values is not empty and the value of property
        // in frame is match none.
        if(nodeValues.length > 0) {
          return false;
        }
        matchThis = true;
      } else {
        if(graphTypes.isList(thisFrame)) {
          const listValue = thisFrame['@list'][0];
          if(graphTypes.isList(nodeValues[0])) {
            const nodeListValues = nodeValues[0]['@list'];

            if(graphTypes.isValue(listValue)) {
              // match on any matching value
              matchThis = nodeListValues.some(lv => _valueMatch(listValue, lv));
            } else if(graphTypes.isSubject(listValue) ||
              graphTypes.isSubjectReference(listValue)) {
              matchThis = nodeListValues.some(lv => _nodeMatch(
                state, listValue, lv, flags));
            }
          }
        } else if(graphTypes.isValue(thisFrame)) {
          matchThis = nodeValues.some(nv => _valueMatch(thisFrame, nv));
        } else if(graphTypes.isSubjectReference(thisFrame)) {
          matchThis =
            nodeValues.some(nv => _nodeMatch(state, thisFrame, nv, flags));
        } else if(types.isObject(thisFrame)) {
          matchThis = nodeValues.length > 0;
        } else {
          matchThis = false;
        }
      }
    }

    // all non-defaulted values must match if requireAll is set
    if(!matchThis && flags.requireAll) {
      return false;
    }

    matchesSome = matchesSome || matchThis;
  }

  // return true if wildcard or subject matches some properties
  return wildcard || matchesSome;
}

/**
 * Removes an existing embed.
 *
 * @param state the current framing state.
 * @param id the @id of the embed to remove.
 */
function _removeEmbed(state, id) {
  // get existing embed
  const embeds = state.uniqueEmbeds[state.graph];
  const embed = embeds[id];
  const parent = embed.parent;
  const property = embed.property;

  // create reference to replace embed
  const subject = {'@id': id};

  // remove existing embed
  if(types.isArray(parent)) {
    // replace subject with reference
    for(let i = 0; i < parent.length; ++i) {
      if(util.compareValues(parent[i], subject)) {
        parent[i] = subject;
        break;
      }
    }
  } else {
    // replace subject with reference
    const useArray = types.isArray(parent[property]);
    util.removeValue(parent, property, subject, {propertyIsArray: useArray});
    util.addValue(parent, property, subject, {propertyIsArray: useArray});
  }

  // recursively remove dependent dangling embeds
  const removeDependents = id => {
    // get embed keys as a separate array to enable deleting keys in map
    const ids = Object.keys(embeds);
    for(const next of ids) {
      if(next in embeds && types.isObject(embeds[next].parent) &&
        embeds[next].parent['@id'] === id) {
        delete embeds[next];
        removeDependents(next);
      }
    }
  };
  removeDependents(id);
}

/**
 * Removes the @preserve keywords from expanded result of framing.
 *
 * @param input the framed, framed output.
 * @param options the framing options used.
 *
 * @return the resulting output.
 */
function _cleanupPreserve(input, options) {
  // recurse through arrays
  if(types.isArray(input)) {
    return input.map(value => _cleanupPreserve(value, options));
  }

  if(types.isObject(input)) {
    // remove @preserve
    if('@preserve' in input) {
      return input['@preserve'][0];
    }

    // skip @values
    if(graphTypes.isValue(input)) {
      return input;
    }

    // recurse through @lists
    if(graphTypes.isList(input)) {
      input['@list'] = _cleanupPreserve(input['@list'], options);
      return input;
    }

    // handle in-memory linked nodes
    if('@id' in input) {
      const id = input['@id'];
      if(options.link.hasOwnProperty(id)) {
        const idx = options.link[id].indexOf(input);
        if(idx !== -1) {
          // already visited
          return options.link[id][idx];
        }
        // prevent circular visitation
        options.link[id].push(input);
      } else {
        // prevent circular visitation
        options.link[id] = [input];
      }
    }

    // recurse through properties
    for(const prop in input) {
      // potentially remove the id, if it is an unreference bnode
      if(prop === '@id' && options.bnodesToClear.includes(input[prop])) {
        delete input['@id'];
        continue;
      }

      input[prop] = _cleanupPreserve(input[prop], options);
    }
  }
  return input;
}

/**
 * Adds framing output to the given parent.
 *
 * @param parent the parent to add to.
 * @param property the parent property.
 * @param output the output to add.
 */
function _addFrameOutput(parent, property, output) {
  if(types.isObject(parent)) {
    util.addValue(parent, property, output, {propertyIsArray: true});
  } else {
    parent.push(output);
  }
}

/**
 * Node matches if it is a node, and matches the pattern as a frame.
 *
 * @param state the current framing state.
 * @param pattern used to match value
 * @param value to check
 * @param flags the frame flags.
 */
function _nodeMatch(state, pattern, value, flags) {
  if(!('@id' in value)) {
    return false;
  }
  const nodeObject = state.subjects[value['@id']];
  return nodeObject && _filterSubject(state, nodeObject, pattern, flags);
}

/**
 * Value matches if it is a value and matches the value pattern
 *
 * * `pattern` is empty
 * * @values are the same, or `pattern[@value]` is a wildcard, and
 * * @types are the same or `value[@type]` is not null
 *   and `pattern[@type]` is `{}`, or `value[@type]` is null
 *   and `pattern[@type]` is null or `[]`, and
 * * @languages are the same or `value[@language]` is not null
 *   and `pattern[@language]` is `{}`, or `value[@language]` is null
 *   and `pattern[@language]` is null or `[]`.
 *
 * @param pattern used to match value
 * @param value to check
 */
function _valueMatch(pattern, value) {
  const v1 = value['@value'];
  const t1 = value['@type'];
  const l1 = value['@language'];
  const v2 = pattern['@value'] ?
    (types.isArray(pattern['@value']) ?
      pattern['@value'] : [pattern['@value']]) :
    [];
  const t2 = pattern['@type'] ?
    (types.isArray(pattern['@type']) ?
      pattern['@type'] : [pattern['@type']]) :
    [];
  const l2 = pattern['@language'] ?
    (types.isArray(pattern['@language']) ?
      pattern['@language'] : [pattern['@language']]) :
    [];

  if(v2.length === 0 && t2.length === 0 && l2.length === 0) {
    return true;
  }
  if(!(v2.includes(v1) || types.isEmptyObject(v2[0]))) {
    return false;
  }
  if(!(!t1 && t2.length === 0 || t2.includes(t1) || t1 &&
    types.isEmptyObject(t2[0]))) {
    return false;
  }
  if(!(!l1 && l2.length === 0 || l2.includes(l1) || l1 &&
    types.isEmptyObject(l2[0]))) {
    return false;
  }
  return true;
}

},{"./JsonLdError":44,"./context":51,"./graphTypes":57,"./nodeMap":59,"./types":62,"./url":63,"./util":64}],56:[function(require,module,exports){
/*
 * Copyright (c) 2017 Digital Bazaar, Inc. All rights reserved.
 */
'use strict';

const JsonLdError = require('./JsonLdError');
const graphTypes = require('./graphTypes');
const types = require('./types');
const util = require('./util');

// constants
const {
  // RDF,
  RDF_LIST,
  RDF_FIRST,
  RDF_REST,
  RDF_NIL,
  RDF_TYPE,
  // RDF_PLAIN_LITERAL,
  // RDF_XML_LITERAL,
  RDF_JSON_LITERAL,
  // RDF_OBJECT,
  // RDF_LANGSTRING,

  // XSD,
  XSD_BOOLEAN,
  XSD_DOUBLE,
  XSD_INTEGER,
  XSD_STRING,
} = require('./constants');

const REGEX_BCP47 = /^[a-zA-Z]{1,8}(-[a-zA-Z0-9]{1,8})*$/;

const api = {};
module.exports = api;

/**
 * Converts an RDF dataset to JSON-LD.
 *
 * @param dataset the RDF dataset.
 * @param options the RDF serialization options.
 *
 * @return a Promise that resolves to the JSON-LD output.
 */
api.fromRDF = async (
  dataset,
  {
    useRdfType = false,
    useNativeTypes = false,
    rdfDirection = null
  }
) => {
  const defaultGraph = {};
  const graphMap = {'@default': defaultGraph};
  const referencedOnce = {};

  for(const quad of dataset) {
    // TODO: change 'name' to 'graph'
    const name = (quad.graph.termType === 'DefaultGraph') ?
      '@default' : quad.graph.value;
    if(!(name in graphMap)) {
      graphMap[name] = {};
    }
    if(name !== '@default' && !(name in defaultGraph)) {
      defaultGraph[name] = {'@id': name};
    }

    const nodeMap = graphMap[name];

    // get subject, predicate, object
    const s = quad.subject.value;
    const p = quad.predicate.value;
    const o = quad.object;

    if(!(s in nodeMap)) {
      nodeMap[s] = {'@id': s};
    }
    const node = nodeMap[s];

    const objectIsNode = o.termType.endsWith('Node');
    if(objectIsNode && !(o.value in nodeMap)) {
      nodeMap[o.value] = {'@id': o.value};
    }

    if(p === RDF_TYPE && !useRdfType && objectIsNode) {
      util.addValue(node, '@type', o.value, {propertyIsArray: true});
      continue;
    }

    const value = _RDFToObject(o, useNativeTypes, rdfDirection);
    util.addValue(node, p, value, {propertyIsArray: true});

    // object may be an RDF list/partial list node but we can't know easily
    // until all triples are read
    if(objectIsNode) {
      if(o.value === RDF_NIL) {
        // track rdf:nil uniquely per graph
        const object = nodeMap[o.value];
        if(!('usages' in object)) {
          object.usages = [];
        }
        object.usages.push({
          node,
          property: p,
          value
        });
      } else if(o.value in referencedOnce) {
        // object referenced more than once
        referencedOnce[o.value] = false;
      } else {
        // keep track of single reference
        referencedOnce[o.value] = {
          node,
          property: p,
          value
        };
      }
    }
  }

  /*
  for(let name in dataset) {
    const graph = dataset[name];
    if(!(name in graphMap)) {
      graphMap[name] = {};
    }
    if(name !== '@default' && !(name in defaultGraph)) {
      defaultGraph[name] = {'@id': name};
    }
    const nodeMap = graphMap[name];
    for(let ti = 0; ti < graph.length; ++ti) {
      const triple = graph[ti];

      // get subject, predicate, object
      const s = triple.subject.value;
      const p = triple.predicate.value;
      const o = triple.object;

      if(!(s in nodeMap)) {
        nodeMap[s] = {'@id': s};
      }
      const node = nodeMap[s];

      const objectIsId = (o.type === 'IRI' || o.type === 'blank node');
      if(objectIsId && !(o.value in nodeMap)) {
        nodeMap[o.value] = {'@id': o.value};
      }

      if(p === RDF_TYPE && !useRdfType && objectIsId) {
        util.addValue(node, '@type', o.value, {propertyIsArray: true});
        continue;
      }

      const value = _RDFToObject(o, useNativeTypes);
      util.addValue(node, p, value, {propertyIsArray: true});

      // object may be an RDF list/partial list node but we can't know easily
      // until all triples are read
      if(objectIsId) {
        if(o.value === RDF_NIL) {
          // track rdf:nil uniquely per graph
          const object = nodeMap[o.value];
          if(!('usages' in object)) {
            object.usages = [];
          }
          object.usages.push({
            node: node,
            property: p,
            value: value
          });
        } else if(o.value in referencedOnce) {
          // object referenced more than once
          referencedOnce[o.value] = false;
        } else {
          // keep track of single reference
          referencedOnce[o.value] = {
            node: node,
            property: p,
            value: value
          };
        }
      }
    }
  }*/

  // convert linked lists to @list arrays
  for(const name in graphMap) {
    const graphObject = graphMap[name];

    // no @lists to be converted, continue
    if(!(RDF_NIL in graphObject)) {
      continue;
    }

    // iterate backwards through each RDF list
    const nil = graphObject[RDF_NIL];
    if(!nil.usages) {
      continue;
    }
    for(let usage of nil.usages) {
      let node = usage.node;
      let property = usage.property;
      let head = usage.value;
      const list = [];
      const listNodes = [];

      // ensure node is a well-formed list node; it must:
      // 1. Be referenced only once.
      // 2. Have an array for rdf:first that has 1 item.
      // 3. Have an array for rdf:rest that has 1 item.
      // 4. Have no keys other than: @id, rdf:first, rdf:rest, and,
      //   optionally, @type where the value is rdf:List.
      let nodeKeyCount = Object.keys(node).length;
      while(property === RDF_REST &&
        types.isObject(referencedOnce[node['@id']]) &&
        types.isArray(node[RDF_FIRST]) && node[RDF_FIRST].length === 1 &&
        types.isArray(node[RDF_REST]) && node[RDF_REST].length === 1 &&
        (nodeKeyCount === 3 ||
          (nodeKeyCount === 4 && types.isArray(node['@type']) &&
          node['@type'].length === 1 && node['@type'][0] === RDF_LIST))) {
        list.push(node[RDF_FIRST][0]);
        listNodes.push(node['@id']);

        // get next node, moving backwards through list
        usage = referencedOnce[node['@id']];
        node = usage.node;
        property = usage.property;
        head = usage.value;
        nodeKeyCount = Object.keys(node).length;

        // if node is not a blank node, then list head found
        if(!graphTypes.isBlankNode(node)) {
          break;
        }
      }

      // transform list into @list object
      delete head['@id'];
      head['@list'] = list.reverse();
      for(const listNode of listNodes) {
        delete graphObject[listNode];
      }
    }

    delete nil.usages;
  }

  const result = [];
  const subjects = Object.keys(defaultGraph).sort();
  for(const subject of subjects) {
    const node = defaultGraph[subject];
    if(subject in graphMap) {
      const graph = node['@graph'] = [];
      const graphObject = graphMap[subject];
      const graphSubjects = Object.keys(graphObject).sort();
      for(const graphSubject of graphSubjects) {
        const node = graphObject[graphSubject];
        // only add full subjects to top-level
        if(!graphTypes.isSubjectReference(node)) {
          graph.push(node);
        }
      }
    }
    // only add full subjects to top-level
    if(!graphTypes.isSubjectReference(node)) {
      result.push(node);
    }
  }

  return result;
};

/**
 * Converts an RDF triple object to a JSON-LD object.
 *
 * @param o the RDF triple object to convert.
 * @param useNativeTypes true to output native types, false not to.
 *
 * @return the JSON-LD object.
 */
function _RDFToObject(o, useNativeTypes, rdfDirection) {
  // convert NamedNode/BlankNode object to JSON-LD
  if(o.termType.endsWith('Node')) {
    return {'@id': o.value};
  }

  // convert literal to JSON-LD
  const rval = {'@value': o.value};

  // add language
  if(o.language) {
    rval['@language'] = o.language;
  } else {
    let type = o.datatype.value;
    if(!type) {
      type = XSD_STRING;
    }
    if(type === RDF_JSON_LITERAL) {
      type = '@json';
      try {
        rval['@value'] = JSON.parse(rval['@value']);
      } catch(e) {
        throw new JsonLdError(
          'JSON literal could not be parsed.',
          'jsonld.InvalidJsonLiteral',
          {code: 'invalid JSON literal', value: rval['@value'], cause: e});
      }
    }
    // use native types for certain xsd types
    if(useNativeTypes) {
      if(type === XSD_BOOLEAN) {
        if(rval['@value'] === 'true') {
          rval['@value'] = true;
        } else if(rval['@value'] === 'false') {
          rval['@value'] = false;
        }
      } else if(types.isNumeric(rval['@value'])) {
        if(type === XSD_INTEGER) {
          const i = parseInt(rval['@value'], 10);
          if(i.toFixed(0) === rval['@value']) {
            rval['@value'] = i;
          }
        } else if(type === XSD_DOUBLE) {
          rval['@value'] = parseFloat(rval['@value']);
        }
      }
      // do not add native type
      if(![XSD_BOOLEAN, XSD_INTEGER, XSD_DOUBLE, XSD_STRING].includes(type)) {
        rval['@type'] = type;
      }
    } else if(rdfDirection === 'i18n-datatype' &&
      type.startsWith('https://www.w3.org/ns/i18n#')) {
      const [, language, direction] = type.split(/[#_]/);
      if(language.length > 0) {
        rval['@language'] = language;
        if(!language.match(REGEX_BCP47)) {
          console.warn(`@language must be valid BCP47: ${language}`);
        }
      }
      rval['@direction'] = direction;
    } else if(type !== XSD_STRING) {
      rval['@type'] = type;
    }
  }

  return rval;
}

},{"./JsonLdError":44,"./constants":50,"./graphTypes":57,"./types":62,"./util":64}],57:[function(require,module,exports){
/*
 * Copyright (c) 2017 Digital Bazaar, Inc. All rights reserved.
 */
'use strict';

const types = require('./types');

const api = {};
module.exports = api;

/**
 * Returns true if the given value is a subject with properties.
 *
 * @param v the value to check.
 *
 * @return true if the value is a subject with properties, false if not.
 */
api.isSubject = v => {
  // Note: A value is a subject if all of these hold true:
  // 1. It is an Object.
  // 2. It is not a @value, @set, or @list.
  // 3. It has more than 1 key OR any existing key is not @id.
  if(types.isObject(v) &&
    !(('@value' in v) || ('@set' in v) || ('@list' in v))) {
    const keyCount = Object.keys(v).length;
    return (keyCount > 1 || !('@id' in v));
  }
  return false;
};

/**
 * Returns true if the given value is a subject reference.
 *
 * @param v the value to check.
 *
 * @return true if the value is a subject reference, false if not.
 */
api.isSubjectReference = v =>
  // Note: A value is a subject reference if all of these hold true:
  // 1. It is an Object.
  // 2. It has a single key: @id.
  (types.isObject(v) && Object.keys(v).length === 1 && ('@id' in v));

/**
 * Returns true if the given value is a @value.
 *
 * @param v the value to check.
 *
 * @return true if the value is a @value, false if not.
 */
api.isValue = v =>
  // Note: A value is a @value if all of these hold true:
  // 1. It is an Object.
  // 2. It has the @value property.
  types.isObject(v) && ('@value' in v);

/**
 * Returns true if the given value is a @list.
 *
 * @param v the value to check.
 *
 * @return true if the value is a @list, false if not.
 */
api.isList = v =>
  // Note: A value is a @list if all of these hold true:
  // 1. It is an Object.
  // 2. It has the @list property.
  types.isObject(v) && ('@list' in v);

/**
 * Returns true if the given value is a @graph.
 *
 * @return true if the value is a @graph, false if not.
 */
api.isGraph = v => {
  // Note: A value is a graph if all of these hold true:
  // 1. It is an object.
  // 2. It has an `@graph` key.
  // 3. It may have '@id' or '@index'
  return types.isObject(v) &&
    '@graph' in v &&
    Object.keys(v)
      .filter(key => key !== '@id' && key !== '@index').length === 1;
};

/**
 * Returns true if the given value is a simple @graph.
 *
 * @return true if the value is a simple @graph, false if not.
 */
api.isSimpleGraph = v => {
  // Note: A value is a simple graph if all of these hold true:
  // 1. It is an object.
  // 2. It has an `@graph` key.
  // 3. It has only 1 key or 2 keys where one of them is `@index`.
  return api.isGraph(v) && !('@id' in v);
};

/**
 * Returns true if the given value is a blank node.
 *
 * @param v the value to check.
 *
 * @return true if the value is a blank node, false if not.
 */
api.isBlankNode = v => {
  // Note: A value is a blank node if all of these hold true:
  // 1. It is an Object.
  // 2. If it has an @id key its value begins with '_:'.
  // 3. It has no keys OR is not a @value, @set, or @list.
  if(types.isObject(v)) {
    if('@id' in v) {
      return (v['@id'].indexOf('_:') === 0);
    }
    return (Object.keys(v).length === 0 ||
      !(('@value' in v) || ('@set' in v) || ('@list' in v)));
  }
  return false;
};

},{"./types":62}],58:[function(require,module,exports){
/**
 * A JavaScript implementation of the JSON-LD API.
 *
 * @author Dave Longley
 *
 * @license BSD 3-Clause License
 * Copyright (c) 2011-2019 Digital Bazaar, Inc.
 * All rights reserved.
 *
 * Redistribution and use in source and binary forms, with or without
 * modification, are permitted provided that the following conditions are met:
 *
 * Redistributions of source code must retain the above copyright notice,
 * this list of conditions and the following disclaimer.
 *
 * Redistributions in binary form must reproduce the above copyright
 * notice, this list of conditions and the following disclaimer in the
 * documentation and/or other materials provided with the distribution.
 *
 * Neither the name of the Digital Bazaar, Inc. nor the names of its
 * contributors may be used to endorse or promote products derived from
 * this software without specific prior written permission.
 *
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS
 * IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED
 * TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A
 * PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT
 * HOLDER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL,
 * SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED
 * TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR
 * PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF
 * LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING
 * NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS
 * SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 */
const canonize = require('rdf-canonize');
const platform = require('./platform');
const util = require('./util');
const ContextResolver = require('./ContextResolver');
const IdentifierIssuer = util.IdentifierIssuer;
const JsonLdError = require('./JsonLdError');
const LRU = require('lru-cache');
const NQuads = require('./NQuads');

const {expand: _expand} = require('./expand');
const {flatten: _flatten} = require('./flatten');
const {fromRDF: _fromRDF} = require('./fromRdf');
const {toRDF: _toRDF} = require('./toRdf');

const {
  frameMergedOrDefault: _frameMergedOrDefault,
  cleanupNull: _cleanupNull
} = require('./frame');

const {
  isArray: _isArray,
  isObject: _isObject,
  isString: _isString
} = require('./types');

const {
  isSubjectReference: _isSubjectReference,
} = require('./graphTypes');

const {
  expandIri: _expandIri,
  getInitialContext: _getInitialContext,
  process: _processContext,
  processingMode: _processingMode
} = require('./context');

const {
  compact: _compact,
  compactIri: _compactIri
} = require('./compact');

const {
  createNodeMap: _createNodeMap,
  createMergedNodeMap: _createMergedNodeMap,
  mergeNodeMaps: _mergeNodeMaps
} = require('./nodeMap');

/* eslint-disable indent */
// attaches jsonld API to the given object
const wrapper = function(jsonld) {

/** Registered RDF dataset parsers hashed by content-type. */
const _rdfParsers = {};

// resolved context cache
// TODO: consider basing max on context size rather than number
const RESOLVED_CONTEXT_CACHE_MAX_SIZE = 100;
const _resolvedContextCache = new LRU({max: RESOLVED_CONTEXT_CACHE_MAX_SIZE});

/* Core API */

/**
 * Performs JSON-LD compaction.
 *
 * @param input the JSON-LD input to compact.
 * @param ctx the context to compact with.
 * @param [options] options to use:
 *          [base] the base IRI to use.
 *          [compactArrays] true to compact arrays to single values when
 *            appropriate, false not to (default: true).
 *          [compactToRelative] true to compact IRIs to be relative to document
 *            base, false to keep absolute (default: true)
 *          [graph] true to always output a top-level graph (default: false).
 *          [expandContext] a context to expand with.
 *          [skipExpansion] true to assume the input is expanded and skip
 *            expansion, false not to, defaults to false.
 *          [documentLoader(url, options)] the document loader.
 *          [expansionMap(info)] a function that can be used to custom map
 *            unmappable values (or to throw an error when they are detected);
 *            if this function returns `undefined` then the default behavior
 *            will be used.
 *          [framing] true if compaction is occuring during a framing operation.
 *          [compactionMap(info)] a function that can be used to custom map
 *            unmappable values (or to throw an error when they are detected);
 *            if this function returns `undefined` then the default behavior
 *            will be used.
 *          [contextResolver] internal use only.
 *
 * @return a Promise that resolves to the compacted output.
 */
jsonld.compact = async function(input, ctx, options) {
  if(arguments.length < 2) {
    throw new TypeError('Could not compact, too few arguments.');
  }

  if(ctx === null) {
    throw new JsonLdError(
      'The compaction context must not be null.',
      'jsonld.CompactError', {code: 'invalid local context'});
  }

  // nothing to compact
  if(input === null) {
    return null;
  }

  // set default options
  options = _setDefaults(options, {
    base: _isString(input) ? input : '',
    compactArrays: true,
    compactToRelative: true,
    graph: false,
    skipExpansion: false,
    link: false,
    issuer: new IdentifierIssuer('_:b'),
    contextResolver: new ContextResolver(
      {sharedCache: _resolvedContextCache})
  });
  if(options.link) {
    // force skip expansion when linking, "link" is not part of the public
    // API, it should only be called from framing
    options.skipExpansion = true;
  }
  if(!options.compactToRelative) {
    delete options.base;
  }

  // expand input
  let expanded;
  if(options.skipExpansion) {
    expanded = input;
  } else {
    expanded = await jsonld.expand(input, options);
  }

  // process context
  const activeCtx = await jsonld.processContext(
    _getInitialContext(options), ctx, options);

  // do compaction
  let compacted = await _compact({
    activeCtx,
    element: expanded,
    options,
    compactionMap: options.compactionMap
  });

  // perform clean up
  if(options.compactArrays && !options.graph && _isArray(compacted)) {
    if(compacted.length === 1) {
      // simplify to a single item
      compacted = compacted[0];
    } else if(compacted.length === 0) {
      // simplify to an empty object
      compacted = {};
    }
  } else if(options.graph && _isObject(compacted)) {
    // always use array if graph option is on
    compacted = [compacted];
  }

  // follow @context key
  if(_isObject(ctx) && '@context' in ctx) {
    ctx = ctx['@context'];
  }

  // build output context
  ctx = util.clone(ctx);
  if(!_isArray(ctx)) {
    ctx = [ctx];
  }
  // remove empty contexts
  const tmp = ctx;
  ctx = [];
  for(let i = 0; i < tmp.length; ++i) {
    if(!_isObject(tmp[i]) || Object.keys(tmp[i]).length > 0) {
      ctx.push(tmp[i]);
    }
  }

  // remove array if only one context
  const hasContext = (ctx.length > 0);
  if(ctx.length === 1) {
    ctx = ctx[0];
  }

  // add context and/or @graph
  if(_isArray(compacted)) {
    // use '@graph' keyword
    const graphAlias = _compactIri({
      activeCtx, iri: '@graph', relativeTo: {vocab: true}
    });
    const graph = compacted;
    compacted = {};
    if(hasContext) {
      compacted['@context'] = ctx;
    }
    compacted[graphAlias] = graph;
  } else if(_isObject(compacted) && hasContext) {
    // reorder keys so @context is first
    const graph = compacted;
    compacted = {'@context': ctx};
    for(const key in graph) {
      compacted[key] = graph[key];
    }
  }

  return compacted;
};

/**
 * Performs JSON-LD expansion.
 *
 * @param input the JSON-LD input to expand.
 * @param [options] the options to use:
 *          [base] the base IRI to use.
 *          [expandContext] a context to expand with.
 *          [keepFreeFloatingNodes] true to keep free-floating nodes,
 *            false not to, defaults to false.
 *          [documentLoader(url, options)] the document loader.
 *          [expansionMap(info)] a function that can be used to custom map
 *            unmappable values (or to throw an error when they are detected);
 *            if this function returns `undefined` then the default behavior
 *            will be used.
 *          [contextResolver] internal use only.
 *
 * @return a Promise that resolves to the expanded output.
 */
jsonld.expand = async function(input, options) {
  if(arguments.length < 1) {
    throw new TypeError('Could not expand, too few arguments.');
  }

  // set default options
  options = _setDefaults(options, {
    keepFreeFloatingNodes: false,
    contextResolver: new ContextResolver(
      {sharedCache: _resolvedContextCache})
  });
  if(options.expansionMap === false) {
    options.expansionMap = undefined;
  }

  // build set of objects that may have @contexts to resolve
  const toResolve = {};

  // build set of contexts to process prior to expansion
  const contextsToProcess = [];

  // if an `expandContext` has been given ensure it gets resolved
  if('expandContext' in options) {
    const expandContext = util.clone(options.expandContext);
    if(_isObject(expandContext) && '@context' in expandContext) {
      toResolve.expandContext = expandContext;
    } else {
      toResolve.expandContext = {'@context': expandContext};
    }
    contextsToProcess.push(toResolve.expandContext);
  }

  // if input is a string, attempt to dereference remote document
  let defaultBase;
  if(!_isString(input)) {
    // input is not a URL, do not need to retrieve it first
    toResolve.input = util.clone(input);
  } else {
    // load remote doc
    const remoteDoc = await jsonld.get(input, options);
    defaultBase = remoteDoc.documentUrl;
    toResolve.input = remoteDoc.document;
    if(remoteDoc.contextUrl) {
      // context included in HTTP link header and must be resolved
      toResolve.remoteContext = {'@context': remoteDoc.contextUrl};
      contextsToProcess.push(toResolve.remoteContext);
    }
  }

  // set default base
  if(!('base' in options)) {
    options.base = defaultBase || '';
  }

  // process any additional contexts
  let activeCtx = _getInitialContext(options);
  for(const localCtx of contextsToProcess) {
    activeCtx = await _processContext({activeCtx, localCtx, options});
  }

  // expand resolved input
  let expanded = await _expand({
    activeCtx,
    element: toResolve.input,
    options,
    expansionMap: options.expansionMap
  });

  // optimize away @graph with no other properties
  if(_isObject(expanded) && ('@graph' in expanded) &&
    Object.keys(expanded).length === 1) {
    expanded = expanded['@graph'];
  } else if(expanded === null) {
    expanded = [];
  }

  // normalize to an array
  if(!_isArray(expanded)) {
    expanded = [expanded];
  }

  return expanded;
};

/**
 * Performs JSON-LD flattening.
 *
 * @param input the JSON-LD to flatten.
 * @param ctx the context to use to compact the flattened output, or null.
 * @param [options] the options to use:
 *          [base] the base IRI to use.
 *          [expandContext] a context to expand with.
 *          [documentLoader(url, options)] the document loader.
 *          [contextResolver] internal use only.
 *
 * @return a Promise that resolves to the flattened output.
 */
jsonld.flatten = async function(input, ctx, options) {
  if(arguments.length < 1) {
    return new TypeError('Could not flatten, too few arguments.');
  }

  if(typeof ctx === 'function') {
    ctx = null;
  } else {
    ctx = ctx || null;
  }

  // set default options
  options = _setDefaults(options, {
    base: _isString(input) ? input : '',
    contextResolver: new ContextResolver(
      {sharedCache: _resolvedContextCache})
  });

  // expand input
  const expanded = await jsonld.expand(input, options);

  // do flattening
  const flattened = _flatten(expanded);

  if(ctx === null) {
    // no compaction required
    return flattened;
  }

  // compact result (force @graph option to true, skip expansion)
  options.graph = true;
  options.skipExpansion = true;
  const compacted = await jsonld.compact(flattened, ctx, options);

  return compacted;
};

/**
 * Performs JSON-LD framing.
 *
 * @param input the JSON-LD input to frame.
 * @param frame the JSON-LD frame to use.
 * @param [options] the framing options.
 *          [base] the base IRI to use.
 *          [expandContext] a context to expand with.
 *          [embed] default @embed flag: '@last', '@always', '@never', '@link'
 *            (default: '@last').
 *          [explicit] default @explicit flag (default: false).
 *          [requireAll] default @requireAll flag (default: true).
 *          [omitDefault] default @omitDefault flag (default: false).
 *          [documentLoader(url, options)] the document loader.
 *          [contextResolver] internal use only.
 *
 * @return a Promise that resolves to the framed output.
 */
jsonld.frame = async function(input, frame, options) {
  if(arguments.length < 2) {
    throw new TypeError('Could not frame, too few arguments.');
  }

  // set default options
  options = _setDefaults(options, {
    base: _isString(input) ? input : '',
    embed: '@once',
    explicit: false,
    requireAll: false,
    omitDefault: false,
    bnodesToClear: [],
    contextResolver: new ContextResolver(
      {sharedCache: _resolvedContextCache})
  });

  // if frame is a string, attempt to dereference remote document
  if(_isString(frame)) {
    // load remote doc
    const remoteDoc = await jsonld.get(frame, options);
    frame = remoteDoc.document;

    if(remoteDoc.contextUrl) {
      // inject link header @context into frame
      let ctx = frame['@context'];
      if(!ctx) {
        ctx = remoteDoc.contextUrl;
      } else if(_isArray(ctx)) {
        ctx.push(remoteDoc.contextUrl);
      } else {
        ctx = [ctx, remoteDoc.contextUrl];
      }
      frame['@context'] = ctx;
    }
  }

  const frameContext = frame ? frame['@context'] || {} : {};

  // process context
  const activeCtx = await jsonld.processContext(
    _getInitialContext(options), frameContext, options);

  // mode specific defaults
  if(!options.hasOwnProperty('omitGraph')) {
    options.omitGraph = _processingMode(activeCtx, 1.1);
  }
  if(!options.hasOwnProperty('pruneBlankNodeIdentifiers')) {
    options.pruneBlankNodeIdentifiers = _processingMode(activeCtx, 1.1);
  }

  // expand input
  const expanded = await jsonld.expand(input, options);

  // expand frame
  const opts = {...options};
  opts.isFrame = true;
  opts.keepFreeFloatingNodes = true;
  const expandedFrame = await jsonld.expand(frame, opts);

  // if the unexpanded frame includes a key expanding to @graph, frame the
  // default graph, otherwise, the merged graph
  const frameKeys = Object.keys(frame)
    .map(key => _expandIri(activeCtx, key, {vocab: true}));
  opts.merged = !frameKeys.includes('@graph');
  opts.is11 = _processingMode(activeCtx, 1.1);

  // do framing
  const framed = _frameMergedOrDefault(expanded, expandedFrame, opts);

  opts.graph = !options.omitGraph;
  opts.skipExpansion = true;
  opts.link = {};
  opts.framing = true;
  let compacted = await jsonld.compact(framed, frameContext, opts);

  // replace @null with null, compacting arrays
  opts.link = {};
  compacted = _cleanupNull(compacted, opts);

  return compacted;
};

/**
 * **Experimental**
 *
 * Links a JSON-LD document's nodes in memory.
 *
 * @param input the JSON-LD document to link.
 * @param [ctx] the JSON-LD context to apply.
 * @param [options] the options to use:
 *          [base] the base IRI to use.
 *          [expandContext] a context to expand with.
 *          [documentLoader(url, options)] the document loader.
 *          [contextResolver] internal use only.
 *
 * @return a Promise that resolves to the linked output.
 */
jsonld.link = async function(input, ctx, options) {
  // API matches running frame with a wildcard frame and embed: '@link'
  // get arguments
  const frame = {};
  if(ctx) {
    frame['@context'] = ctx;
  }
  frame['@embed'] = '@link';
  return jsonld.frame(input, frame, options);
};

/**
 * Performs RDF dataset normalization on the given input. The input is JSON-LD
 * unless the 'inputFormat' option is used. The output is an RDF dataset
 * unless the 'format' option is used.
 *
 * @param input the input to normalize as JSON-LD or as a format specified by
 *          the 'inputFormat' option.
 * @param [options] the options to use:
 *          [algorithm] the normalization algorithm to use, `URDNA2015` or
 *            `URGNA2012` (default: `URDNA2015`).
 *          [base] the base IRI to use.
 *          [expandContext] a context to expand with.
 *          [skipExpansion] true to assume the input is expanded and skip
 *            expansion, false not to, defaults to false.
 *          [inputFormat] the format if input is not JSON-LD:
 *            'application/n-quads' for N-Quads.
 *          [format] the format if output is a string:
 *            'application/n-quads' for N-Quads.
 *          [documentLoader(url, options)] the document loader.
 *          [useNative] true to use a native canonize algorithm
 *          [contextResolver] internal use only.
 *
 * @return a Promise that resolves to the normalized output.
 */
jsonld.normalize = jsonld.canonize = async function(input, options) {
  if(arguments.length < 1) {
    throw new TypeError('Could not canonize, too few arguments.');
  }

  // set default options
  options = _setDefaults(options, {
    base: _isString(input) ? input : '',
    algorithm: 'URDNA2015',
    skipExpansion: false,
    contextResolver: new ContextResolver(
      {sharedCache: _resolvedContextCache})
  });
  if('inputFormat' in options) {
    if(options.inputFormat !== 'application/n-quads' &&
      options.inputFormat !== 'application/nquads') {
      throw new JsonLdError(
        'Unknown canonicalization input format.',
        'jsonld.CanonizeError');
    }
    // TODO: `await` for async parsers
    const parsedInput = NQuads.parse(input);

    // do canonicalization
    return canonize.canonize(parsedInput, options);
  }

  // convert to RDF dataset then do normalization
  const opts = {...options};
  delete opts.format;
  opts.produceGeneralizedRdf = false;
  const dataset = await jsonld.toRDF(input, opts);

  // do canonicalization
  return canonize.canonize(dataset, options);
};

/**
 * Converts an RDF dataset to JSON-LD.
 *
 * @param dataset a serialized string of RDF in a format specified by the
 *          format option or an RDF dataset to convert.
 * @param [options] the options to use:
 *          [format] the format if dataset param must first be parsed:
 *            'application/n-quads' for N-Quads (default).
 *          [rdfParser] a custom RDF-parser to use to parse the dataset.
 *          [useRdfType] true to use rdf:type, false to use @type
 *            (default: false).
 *          [useNativeTypes] true to convert XSD types into native types
 *            (boolean, integer, double), false not to (default: false).
 *
 * @return a Promise that resolves to the JSON-LD document.
 */
jsonld.fromRDF = async function(dataset, options) {
  if(arguments.length < 1) {
    throw new TypeError('Could not convert from RDF, too few arguments.');
  }

  // set default options
  options = _setDefaults(options, {
    format: _isString(dataset) ? 'application/n-quads' : undefined
  });

  const {format} = options;
  let {rdfParser} = options;

  // handle special format
  if(format) {
    // check supported formats
    rdfParser = rdfParser || _rdfParsers[format];
    if(!rdfParser) {
      throw new JsonLdError(
        'Unknown input format.',
        'jsonld.UnknownFormat', {format});
    }
  } else {
    // no-op parser, assume dataset already parsed
    rdfParser = () => dataset;
  }

  // rdfParser must be synchronous or return a promise, no callback support
  const parsedDataset = await rdfParser(dataset);
  return _fromRDF(parsedDataset, options);
};

/**
 * Outputs the RDF dataset found in the given JSON-LD object.
 *
 * @param input the JSON-LD input.
 * @param [options] the options to use:
 *          [base] the base IRI to use.
 *          [expandContext] a context to expand with.
 *          [skipExpansion] true to assume the input is expanded and skip
 *            expansion, false not to, defaults to false.
 *          [format] the format to use to output a string:
 *            'application/n-quads' for N-Quads.
 *          [produceGeneralizedRdf] true to output generalized RDF, false
 *            to produce only standard RDF (default: false).
 *          [documentLoader(url, options)] the document loader.
 *          [contextResolver] internal use only.
 *
 * @return a Promise that resolves to the RDF dataset.
 */
jsonld.toRDF = async function(input, options) {
  if(arguments.length < 1) {
    throw new TypeError('Could not convert to RDF, too few arguments.');
  }

  // set default options
  options = _setDefaults(options, {
    base: _isString(input) ? input : '',
    skipExpansion: false,
    contextResolver: new ContextResolver(
      {sharedCache: _resolvedContextCache})
  });

  // TODO: support toRDF custom map?
  let expanded;
  if(options.skipExpansion) {
    expanded = input;
  } else {
    // expand input
    expanded = await jsonld.expand(input, options);
  }

  // output RDF dataset
  const dataset = _toRDF(expanded, options);
  if(options.format) {
    if(options.format === 'application/n-quads' ||
      options.format === 'application/nquads') {
      return NQuads.serialize(dataset);
    }
    throw new JsonLdError(
      'Unknown output format.',
      'jsonld.UnknownFormat', {format: options.format});
  }

  return dataset;
};

/**
 * **Experimental**
 *
 * Recursively flattens the nodes in the given JSON-LD input into a merged
 * map of node ID => node. All graphs will be merged into the default graph.
 *
 * @param input the JSON-LD input.
 * @param [options] the options to use:
 *          [base] the base IRI to use.
 *          [expandContext] a context to expand with.
 *          [issuer] a jsonld.IdentifierIssuer to use to label blank nodes.
 *          [documentLoader(url, options)] the document loader.
 *          [contextResolver] internal use only.
 *
 * @return a Promise that resolves to the merged node map.
 */
jsonld.createNodeMap = async function(input, options) {
  if(arguments.length < 1) {
    throw new TypeError('Could not create node map, too few arguments.');
  }

  // set default options
  options = _setDefaults(options, {
    base: _isString(input) ? input : '',
    contextResolver: new ContextResolver(
      {sharedCache: _resolvedContextCache})
  });

  // expand input
  const expanded = await jsonld.expand(input, options);

  return _createMergedNodeMap(expanded, options);
};

/**
 * **Experimental**
 *
 * Merges two or more JSON-LD documents into a single flattened document.
 *
 * @param docs the JSON-LD documents to merge together.
 * @param ctx the context to use to compact the merged result, or null.
 * @param [options] the options to use:
 *          [base] the base IRI to use.
 *          [expandContext] a context to expand with.
 *          [issuer] a jsonld.IdentifierIssuer to use to label blank nodes.
 *          [mergeNodes] true to merge properties for nodes with the same ID,
 *            false to ignore new properties for nodes with the same ID once
 *            the ID has been defined; note that this may not prevent merging
 *            new properties where a node is in the `object` position
 *            (default: true).
 *          [documentLoader(url, options)] the document loader.
 *          [contextResolver] internal use only.
 *
 * @return a Promise that resolves to the merged output.
 */
jsonld.merge = async function(docs, ctx, options) {
  if(arguments.length < 1) {
    throw new TypeError('Could not merge, too few arguments.');
  }
  if(!_isArray(docs)) {
    throw new TypeError('Could not merge, "docs" must be an array.');
  }

  if(typeof ctx === 'function') {
    ctx = null;
  } else {
    ctx = ctx || null;
  }

  // set default options
  options = _setDefaults(options, {
    contextResolver: new ContextResolver(
      {sharedCache: _resolvedContextCache})
  });

  // expand all documents
  const expanded = await Promise.all(docs.map(doc => {
    const opts = {...options};
    return jsonld.expand(doc, opts);
  }));

  let mergeNodes = true;
  if('mergeNodes' in options) {
    mergeNodes = options.mergeNodes;
  }

  const issuer = options.issuer || new IdentifierIssuer('_:b');
  const graphs = {'@default': {}};

  for(let i = 0; i < expanded.length; ++i) {
    // uniquely relabel blank nodes
    const doc = util.relabelBlankNodes(expanded[i], {
      issuer: new IdentifierIssuer('_:b' + i + '-')
    });

    // add nodes to the shared node map graphs if merging nodes, to a
    // separate graph set if not
    const _graphs = (mergeNodes || i === 0) ? graphs : {'@default': {}};
    _createNodeMap(doc, _graphs, '@default', issuer);

    if(_graphs !== graphs) {
      // merge document graphs but don't merge existing nodes
      for(const graphName in _graphs) {
        const _nodeMap = _graphs[graphName];
        if(!(graphName in graphs)) {
          graphs[graphName] = _nodeMap;
          continue;
        }
        const nodeMap = graphs[graphName];
        for(const key in _nodeMap) {
          if(!(key in nodeMap)) {
            nodeMap[key] = _nodeMap[key];
          }
        }
      }
    }
  }

  // add all non-default graphs to default graph
  const defaultGraph = _mergeNodeMaps(graphs);

  // produce flattened output
  const flattened = [];
  const keys = Object.keys(defaultGraph).sort();
  for(let ki = 0; ki < keys.length; ++ki) {
    const node = defaultGraph[keys[ki]];
    // only add full subjects to top-level
    if(!_isSubjectReference(node)) {
      flattened.push(node);
    }
  }

  if(ctx === null) {
    return flattened;
  }

  // compact result (force @graph option to true, skip expansion)
  options.graph = true;
  options.skipExpansion = true;
  const compacted = await jsonld.compact(flattened, ctx, options);

  return compacted;
};

/**
 * The default document loader for external documents.
 *
 * @param url the URL to load.
 *
 * @return a promise that resolves to the remote document.
 */
Object.defineProperty(jsonld, 'documentLoader', {
  get: () => jsonld._documentLoader,
  set: v => jsonld._documentLoader = v
});
// default document loader not implemented
jsonld.documentLoader = async url => {
  throw new JsonLdError(
    'Could not retrieve a JSON-LD document from the URL. URL ' +
    'dereferencing not implemented.', 'jsonld.LoadDocumentError',
    {code: 'loading document failed', url});
};

/**
 * Gets a remote JSON-LD document using the default document loader or
 * one given in the passed options.
 *
 * @param url the URL to fetch.
 * @param [options] the options to use:
 *          [documentLoader] the document loader to use.
 *
 * @return a Promise that resolves to the retrieved remote document.
 */
jsonld.get = async function(url, options) {
  let load;
  if(typeof options.documentLoader === 'function') {
    load = options.documentLoader;
  } else {
    load = jsonld.documentLoader;
  }

  const remoteDoc = await load(url);

  try {
    if(!remoteDoc.document) {
      throw new JsonLdError(
        'No remote document found at the given URL.',
        'jsonld.NullRemoteDocument');
    }
    if(_isString(remoteDoc.document)) {
      remoteDoc.document = JSON.parse(remoteDoc.document);
    }
  } catch(e) {
    throw new JsonLdError(
      'Could not retrieve a JSON-LD document from the URL.',
      'jsonld.LoadDocumentError', {
        code: 'loading document failed',
        cause: e,
        remoteDoc
      });
  }

  return remoteDoc;
};

/**
 * Processes a local context, resolving any URLs as necessary, and returns a
 * new active context.
 *
 * @param activeCtx the current active context.
 * @param localCtx the local context to process.
 * @param [options] the options to use:
 *          [documentLoader(url, options)] the document loader.
 *          [contextResolver] internal use only.
 *
 * @return a Promise that resolves to the new active context.
 */
jsonld.processContext = async function(
  activeCtx, localCtx, options) {
  // set default options
  options = _setDefaults(options, {
    base: '',
    contextResolver: new ContextResolver(
      {sharedCache: _resolvedContextCache})
  });

  // return initial context early for null context
  if(localCtx === null) {
    return _getInitialContext(options);
  }

  // get URLs in localCtx
  localCtx = util.clone(localCtx);
  if(!(_isObject(localCtx) && '@context' in localCtx)) {
    localCtx = {'@context': localCtx};
  }

  return _processContext({activeCtx, localCtx, options});
};

// backwards compatibility
jsonld.getContextValue = require('./context').getContextValue;

/**
 * Document loaders.
 */
jsonld.documentLoaders = {};

/**
 * Assigns the default document loader for external document URLs to a built-in
 * default. Supported types currently include: 'xhr' and 'node'.
 *
 * @param type the type to set.
 * @param [params] the parameters required to use the document loader.
 */
jsonld.useDocumentLoader = function(type) {
  if(!(type in jsonld.documentLoaders)) {
    throw new JsonLdError(
      'Unknown document loader type: "' + type + '"',
      'jsonld.UnknownDocumentLoader',
      {type});
  }

  // set document loader
  jsonld.documentLoader = jsonld.documentLoaders[type].apply(
    jsonld, Array.prototype.slice.call(arguments, 1));
};

/**
 * Registers an RDF dataset parser by content-type, for use with
 * jsonld.fromRDF. An RDF dataset parser will always be given one parameter,
 * a string of input. An RDF dataset parser can be synchronous or
 * asynchronous (by returning a promise).
 *
 * @param contentType the content-type for the parser.
 * @param parser(input) the parser function (takes a string as a parameter
 *          and either returns an RDF dataset or a Promise that resolves to one.
 */
jsonld.registerRDFParser = function(contentType, parser) {
  _rdfParsers[contentType] = parser;
};

/**
 * Unregisters an RDF dataset parser by content-type.
 *
 * @param contentType the content-type for the parser.
 */
jsonld.unregisterRDFParser = function(contentType) {
  delete _rdfParsers[contentType];
};

// register the N-Quads RDF parser
jsonld.registerRDFParser('application/n-quads', NQuads.parse);
jsonld.registerRDFParser('application/nquads', NQuads.parse);

/* URL API */
jsonld.url = require('./url');

/* Utility API */
jsonld.util = util;
// backwards compatibility
Object.assign(jsonld, util);

// reexpose API as jsonld.promises for backwards compatability
jsonld.promises = jsonld;

// backwards compatibility
jsonld.RequestQueue = require('./RequestQueue');

/* WebIDL API */
jsonld.JsonLdProcessor = require('./JsonLdProcessor')(jsonld);

platform.setupGlobals(jsonld);
platform.setupDocumentLoaders(jsonld);

function _setDefaults(options, {
  documentLoader = jsonld.documentLoader,
  ...defaults
}) {
  return Object.assign({}, {documentLoader}, defaults, options);
}

// end of jsonld API `wrapper` factory
return jsonld;
};

// external APIs:

// used to generate a new jsonld API instance
const factory = function() {
  return wrapper(function() {
    return factory();
  });
};

// wrap the main jsonld API instance
wrapper(factory);
// export API
module.exports = factory;

},{"./ContextResolver":43,"./JsonLdError":44,"./JsonLdProcessor":45,"./NQuads":46,"./RequestQueue":47,"./compact":49,"./context":51,"./expand":53,"./flatten":54,"./frame":55,"./fromRdf":56,"./graphTypes":57,"./nodeMap":59,"./platform":60,"./toRdf":61,"./types":62,"./url":63,"./util":64,"lru-cache":65,"rdf-canonize":69}],59:[function(require,module,exports){
/*
 * Copyright (c) 2017 Digital Bazaar, Inc. All rights reserved.
 */
'use strict';

const {isKeyword} = require('./context');
const graphTypes = require('./graphTypes');
const types = require('./types');
const util = require('./util');
const JsonLdError = require('./JsonLdError');

const api = {};
module.exports = api;

/**
 * Creates a merged JSON-LD node map (node ID => node).
 *
 * @param input the expanded JSON-LD to create a node map of.
 * @param [options] the options to use:
 *          [issuer] a jsonld.IdentifierIssuer to use to label blank nodes.
 *
 * @return the node map.
 */
api.createMergedNodeMap = (input, options) => {
  options = options || {};

  // produce a map of all subjects and name each bnode
  const issuer = options.issuer || new util.IdentifierIssuer('_:b');
  const graphs = {'@default': {}};
  api.createNodeMap(input, graphs, '@default', issuer);

  // add all non-default graphs to default graph
  return api.mergeNodeMaps(graphs);
};

/**
 * Recursively flattens the subjects in the given JSON-LD expanded input
 * into a node map.
 *
 * @param input the JSON-LD expanded input.
 * @param graphs a map of graph name to subject map.
 * @param graph the name of the current graph.
 * @param issuer the blank node identifier issuer.
 * @param name the name assigned to the current input if it is a bnode.
 * @param list the list to append to, null for none.
 */
api.createNodeMap = (input, graphs, graph, issuer, name, list) => {
  // recurse through array
  if(types.isArray(input)) {
    for(const node of input) {
      api.createNodeMap(node, graphs, graph, issuer, undefined, list);
    }
    return;
  }

  // add non-object to list
  if(!types.isObject(input)) {
    if(list) {
      list.push(input);
    }
    return;
  }

  // add values to list
  if(graphTypes.isValue(input)) {
    if('@type' in input) {
      let type = input['@type'];
      // rename @type blank node
      if(type.indexOf('_:') === 0) {
        input['@type'] = type = issuer.getId(type);
      }
    }
    if(list) {
      list.push(input);
    }
    return;
  } else if(list && graphTypes.isList(input)) {
    const _list = [];
    api.createNodeMap(input['@list'], graphs, graph, issuer, name, _list);
    list.push({'@list': _list});
    return;
  }

  // Note: At this point, input must be a subject.

  // spec requires @type to be named first, so assign names early
  if('@type' in input) {
    const types = input['@type'];
    for(const type of types) {
      if(type.indexOf('_:') === 0) {
        issuer.getId(type);
      }
    }
  }

  // get name for subject
  if(types.isUndefined(name)) {
    name = graphTypes.isBlankNode(input) ?
      issuer.getId(input['@id']) : input['@id'];
  }

  // add subject reference to list
  if(list) {
    list.push({'@id': name});
  }

  // create new subject or merge into existing one
  const subjects = graphs[graph];
  const subject = subjects[name] = subjects[name] || {};
  subject['@id'] = name;
  const properties = Object.keys(input).sort();
  for(let property of properties) {
    // skip @id
    if(property === '@id') {
      continue;
    }

    // handle reverse properties
    if(property === '@reverse') {
      const referencedNode = {'@id': name};
      const reverseMap = input['@reverse'];
      for(const reverseProperty in reverseMap) {
        const items = reverseMap[reverseProperty];
        for(const item of items) {
          let itemName = item['@id'];
          if(graphTypes.isBlankNode(item)) {
            itemName = issuer.getId(itemName);
          }
          api.createNodeMap(item, graphs, graph, issuer, itemName);
          util.addValue(
            subjects[itemName], reverseProperty, referencedNode,
            {propertyIsArray: true, allowDuplicate: false});
        }
      }
      continue;
    }

    // recurse into graph
    if(property === '@graph') {
      // add graph subjects map entry
      if(!(name in graphs)) {
        graphs[name] = {};
      }
      api.createNodeMap(input[property], graphs, name, issuer);
      continue;
    }

    // recurse into included
    if(property === '@included') {
      api.createNodeMap(input[property], graphs, graph, issuer);
      continue;
    }

    // copy non-@type keywords
    if(property !== '@type' && isKeyword(property)) {
      if(property === '@index' && property in subject &&
        (input[property] !== subject[property] ||
        input[property]['@id'] !== subject[property]['@id'])) {
        throw new JsonLdError(
          'Invalid JSON-LD syntax; conflicting @index property detected.',
          'jsonld.SyntaxError',
          {code: 'conflicting indexes', subject});
      }
      subject[property] = input[property];
      continue;
    }

    // iterate over objects
    const objects = input[property];

    // if property is a bnode, assign it a new id
    if(property.indexOf('_:') === 0) {
      property = issuer.getId(property);
    }

    // ensure property is added for empty arrays
    if(objects.length === 0) {
      util.addValue(subject, property, [], {propertyIsArray: true});
      continue;
    }
    for(let o of objects) {
      if(property === '@type') {
        // rename @type blank nodes
        o = (o.indexOf('_:') === 0) ? issuer.getId(o) : o;
      }

      // handle embedded subject or subject reference
      if(graphTypes.isSubject(o) || graphTypes.isSubjectReference(o)) {
        // skip null @id
        if('@id' in o && !o['@id']) {
          continue;
        }

        // relabel blank node @id
        const id = graphTypes.isBlankNode(o) ?
          issuer.getId(o['@id']) : o['@id'];

        // add reference and recurse
        util.addValue(
          subject, property, {'@id': id},
          {propertyIsArray: true, allowDuplicate: false});
        api.createNodeMap(o, graphs, graph, issuer, id);
      } else if(graphTypes.isValue(o)) {
        util.addValue(
          subject, property, o,
          {propertyIsArray: true, allowDuplicate: false});
      } else if(graphTypes.isList(o)) {
        // handle @list
        const _list = [];
        api.createNodeMap(o['@list'], graphs, graph, issuer, name, _list);
        o = {'@list': _list};
        util.addValue(
          subject, property, o,
          {propertyIsArray: true, allowDuplicate: false});
      } else {
        // handle @value
        api.createNodeMap(o, graphs, graph, issuer, name);
        util.addValue(
          subject, property, o, {propertyIsArray: true, allowDuplicate: false});
      }
    }
  }
};

/**
 * Merge separate named graphs into a single merged graph including
 * all nodes from the default graph and named graphs.
 *
 * @param graphs a map of graph name to subject map.
 *
 * @return the merged graph map.
 */
api.mergeNodeMapGraphs = graphs => {
  const merged = {};
  for(const name of Object.keys(graphs).sort()) {
    for(const id of Object.keys(graphs[name]).sort()) {
      const node = graphs[name][id];
      if(!(id in merged)) {
        merged[id] = {'@id': id};
      }
      const mergedNode = merged[id];

      for(const property of Object.keys(node).sort()) {
        if(isKeyword(property) && property !== '@type') {
          // copy keywords
          mergedNode[property] = util.clone(node[property]);
        } else {
          // merge objects
          for(const value of node[property]) {
            util.addValue(
              mergedNode, property, util.clone(value),
              {propertyIsArray: true, allowDuplicate: false});
          }
        }
      }
    }
  }

  return merged;
};

api.mergeNodeMaps = graphs => {
  // add all non-default graphs to default graph
  const defaultGraph = graphs['@default'];
  const graphNames = Object.keys(graphs).sort();
  for(const graphName of graphNames) {
    if(graphName === '@default') {
      continue;
    }
    const nodeMap = graphs[graphName];
    let subject = defaultGraph[graphName];
    if(!subject) {
      defaultGraph[graphName] = subject = {
        '@id': graphName,
        '@graph': []
      };
    } else if(!('@graph' in subject)) {
      subject['@graph'] = [];
    }
    const graph = subject['@graph'];
    for(const id of Object.keys(nodeMap).sort()) {
      const node = nodeMap[id];
      // only add full subjects
      if(!graphTypes.isSubjectReference(node)) {
        graph.push(node);
      }
    }
  }
  return defaultGraph;
};

},{"./JsonLdError":44,"./context":51,"./graphTypes":57,"./types":62,"./util":64}],60:[function(require,module,exports){
/*
 * Copyright (c) 2021 Digital Bazaar, Inc. All rights reserved.
 */
'use strict';

const xhrLoader = require('./documentLoaders/xhr');

const api = {};
module.exports = api;

/**
 * Setup browser document loaders.
 *
 * @param jsonld the jsonld api.
 */
api.setupDocumentLoaders = function(jsonld) {
  if(typeof XMLHttpRequest !== 'undefined') {
    jsonld.documentLoaders.xhr = xhrLoader;
    // use xhr document loader by default
    jsonld.useDocumentLoader('xhr');
  }
};

/**
 * Setup browser globals.
 *
 * @param jsonld the jsonld api.
 */
api.setupGlobals = function(jsonld) {
  // setup browser global JsonLdProcessor
  if(typeof globalThis.JsonLdProcessor === 'undefined') {
    Object.defineProperty(globalThis, 'JsonLdProcessor', {
      writable: true,
      enumerable: false,
      configurable: true,
      value: jsonld.JsonLdProcessor
    });
  }
};

},{"./documentLoaders/xhr":52}],61:[function(require,module,exports){
/*
 * Copyright (c) 2017 Digital Bazaar, Inc. All rights reserved.
 */
'use strict';

const {createNodeMap} = require('./nodeMap');
const {isKeyword} = require('./context');
const graphTypes = require('./graphTypes');
const jsonCanonicalize = require('canonicalize');
const types = require('./types');
const util = require('./util');

const {
  // RDF,
  // RDF_LIST,
  RDF_FIRST,
  RDF_REST,
  RDF_NIL,
  RDF_TYPE,
  // RDF_PLAIN_LITERAL,
  // RDF_XML_LITERAL,
  RDF_JSON_LITERAL,
  // RDF_OBJECT,
  RDF_LANGSTRING,

  // XSD,
  XSD_BOOLEAN,
  XSD_DOUBLE,
  XSD_INTEGER,
  XSD_STRING,
} = require('./constants');

const {
  isAbsolute: _isAbsoluteIri
} = require('./url');

const api = {};
module.exports = api;

/**
 * Outputs an RDF dataset for the expanded JSON-LD input.
 *
 * @param input the expanded JSON-LD input.
 * @param options the RDF serialization options.
 *
 * @return the RDF dataset.
 */
api.toRDF = (input, options) => {
  // create node map for default graph (and any named graphs)
  const issuer = new util.IdentifierIssuer('_:b');
  const nodeMap = {'@default': {}};
  createNodeMap(input, nodeMap, '@default', issuer);

  const dataset = [];
  const graphNames = Object.keys(nodeMap).sort();
  for(const graphName of graphNames) {
    let graphTerm;
    if(graphName === '@default') {
      graphTerm = {termType: 'DefaultGraph', value: ''};
    } else if(_isAbsoluteIri(graphName)) {
      if(graphName.startsWith('_:')) {
        graphTerm = {termType: 'BlankNode'};
      } else {
        graphTerm = {termType: 'NamedNode'};
      }
      graphTerm.value = graphName;
    } else {
      // skip relative IRIs (not valid RDF)
      continue;
    }
    _graphToRDF(dataset, nodeMap[graphName], graphTerm, issuer, options);
  }

  return dataset;
};

/**
 * Adds RDF quads for a particular graph to the given dataset.
 *
 * @param dataset the dataset to append RDF quads to.
 * @param graph the graph to create RDF quads for.
 * @param graphTerm the graph term for each quad.
 * @param issuer a IdentifierIssuer for assigning blank node names.
 * @param options the RDF serialization options.
 *
 * @return the array of RDF triples for the given graph.
 */
function _graphToRDF(dataset, graph, graphTerm, issuer, options) {
  const ids = Object.keys(graph).sort();
  for(const id of ids) {
    const node = graph[id];
    const properties = Object.keys(node).sort();
    for(let property of properties) {
      const items = node[property];
      if(property === '@type') {
        property = RDF_TYPE;
      } else if(isKeyword(property)) {
        continue;
      }

      for(const item of items) {
        // RDF subject
        const subject = {
          termType: id.startsWith('_:') ? 'BlankNode' : 'NamedNode',
          value: id
        };

        // skip relative IRI subjects (not valid RDF)
        if(!_isAbsoluteIri(id)) {
          continue;
        }

        // RDF predicate
        const predicate = {
          termType: property.startsWith('_:') ? 'BlankNode' : 'NamedNode',
          value: property
        };

        // skip relative IRI predicates (not valid RDF)
        if(!_isAbsoluteIri(property)) {
          continue;
        }

        // skip blank node predicates unless producing generalized RDF
        if(predicate.termType === 'BlankNode' &&
          !options.produceGeneralizedRdf) {
          continue;
        }

        // convert list, value or node object to triple
        const object =
          _objectToRDF(item, issuer, dataset, graphTerm, options.rdfDirection);
        // skip null objects (they are relative IRIs)
        if(object) {
          dataset.push({
            subject,
            predicate,
            object,
            graph: graphTerm
          });
        }
      }
    }
  }
}

/**
 * Converts a @list value into linked list of blank node RDF quads
 * (an RDF collection).
 *
 * @param list the @list value.
 * @param issuer a IdentifierIssuer for assigning blank node names.
 * @param dataset the array of quads to append to.
 * @param graphTerm the graph term for each quad.
 *
 * @return the head of the list.
 */
function _listToRDF(list, issuer, dataset, graphTerm, rdfDirection) {
  const first = {termType: 'NamedNode', value: RDF_FIRST};
  const rest = {termType: 'NamedNode', value: RDF_REST};
  const nil = {termType: 'NamedNode', value: RDF_NIL};

  const last = list.pop();
  // Result is the head of the list
  const result = last ? {termType: 'BlankNode', value: issuer.getId()} : nil;
  let subject = result;

  for(const item of list) {
    const object = _objectToRDF(item, issuer, dataset, graphTerm, rdfDirection);
    const next = {termType: 'BlankNode', value: issuer.getId()};
    dataset.push({
      subject,
      predicate: first,
      object,
      graph: graphTerm
    });
    dataset.push({
      subject,
      predicate: rest,
      object: next,
      graph: graphTerm
    });
    subject = next;
  }

  // Tail of list
  if(last) {
    const object = _objectToRDF(last, issuer, dataset, graphTerm, rdfDirection);
    dataset.push({
      subject,
      predicate: first,
      object,
      graph: graphTerm
    });
    dataset.push({
      subject,
      predicate: rest,
      object: nil,
      graph: graphTerm
    });
  }

  return result;
}

/**
 * Converts a JSON-LD value object to an RDF literal or a JSON-LD string,
 * node object to an RDF resource, or adds a list.
 *
 * @param item the JSON-LD value or node object.
 * @param issuer a IdentifierIssuer for assigning blank node names.
 * @param dataset the dataset to append RDF quads to.
 * @param graphTerm the graph term for each quad.
 *
 * @return the RDF literal or RDF resource.
 */
function _objectToRDF(item, issuer, dataset, graphTerm, rdfDirection) {
  const object = {};

  // convert value object to RDF
  if(graphTypes.isValue(item)) {
    object.termType = 'Literal';
    object.value = undefined;
    object.datatype = {
      termType: 'NamedNode'
    };
    let value = item['@value'];
    const datatype = item['@type'] || null;

    // convert to XSD/JSON datatypes as appropriate
    if(datatype === '@json') {
      object.value = jsonCanonicalize(value);
      object.datatype.value = RDF_JSON_LITERAL;
    } else if(types.isBoolean(value)) {
      object.value = value.toString();
      object.datatype.value = datatype || XSD_BOOLEAN;
    } else if(types.isDouble(value) || datatype === XSD_DOUBLE) {
      if(!types.isDouble(value)) {
        value = parseFloat(value);
      }
      // canonical double representation
      object.value = value.toExponential(15).replace(/(\d)0*e\+?/, '$1E');
      object.datatype.value = datatype || XSD_DOUBLE;
    } else if(types.isNumber(value)) {
      object.value = value.toFixed(0);
      object.datatype.value = datatype || XSD_INTEGER;
    } else if(rdfDirection === 'i18n-datatype' &&
      '@direction' in item) {
      const datatype = 'https://www.w3.org/ns/i18n#' +
        (item['@language'] || '') +
        `_${item['@direction']}`;
      object.datatype.value = datatype;
      object.value = value;
    } else if('@language' in item) {
      object.value = value;
      object.datatype.value = datatype || RDF_LANGSTRING;
      object.language = item['@language'];
    } else {
      object.value = value;
      object.datatype.value = datatype || XSD_STRING;
    }
  } else if(graphTypes.isList(item)) {
    const _list =
      _listToRDF(item['@list'], issuer, dataset, graphTerm, rdfDirection);
    object.termType = _list.termType;
    object.value = _list.value;
  } else {
    // convert string/node object to RDF
    const id = types.isObject(item) ? item['@id'] : item;
    object.termType = id.startsWith('_:') ? 'BlankNode' : 'NamedNode';
    object.value = id;
  }

  // skip relative IRIs, not valid RDF
  if(object.termType === 'NamedNode' && !_isAbsoluteIri(object.value)) {
    return null;
  }

  return object;
}

},{"./constants":50,"./context":51,"./graphTypes":57,"./nodeMap":59,"./types":62,"./url":63,"./util":64,"canonicalize":31}],62:[function(require,module,exports){
/*
 * Copyright (c) 2017 Digital Bazaar, Inc. All rights reserved.
 */
'use strict';

const api = {};
module.exports = api;

/**
 * Returns true if the given value is an Array.
 *
 * @param v the value to check.
 *
 * @return true if the value is an Array, false if not.
 */
api.isArray = Array.isArray;

/**
 * Returns true if the given value is a Boolean.
 *
 * @param v the value to check.
 *
 * @return true if the value is a Boolean, false if not.
 */
api.isBoolean = v => (typeof v === 'boolean' ||
  Object.prototype.toString.call(v) === '[object Boolean]');

/**
 * Returns true if the given value is a double.
 *
 * @param v the value to check.
 *
 * @return true if the value is a double, false if not.
 */
api.isDouble = v => api.isNumber(v) &&
  (String(v).indexOf('.') !== -1 || Math.abs(v) >= 1e21);

/**
 * Returns true if the given value is an empty Object.
 *
 * @param v the value to check.
 *
 * @return true if the value is an empty Object, false if not.
 */
api.isEmptyObject = v => api.isObject(v) && Object.keys(v).length === 0;

/**
 * Returns true if the given value is a Number.
 *
 * @param v the value to check.
 *
 * @return true if the value is a Number, false if not.
 */
api.isNumber = v => (typeof v === 'number' ||
  Object.prototype.toString.call(v) === '[object Number]');

/**
 * Returns true if the given value is numeric.
 *
 * @param v the value to check.
 *
 * @return true if the value is numeric, false if not.
 */
api.isNumeric = v => !isNaN(parseFloat(v)) && isFinite(v);

/**
 * Returns true if the given value is an Object.
 *
 * @param v the value to check.
 *
 * @return true if the value is an Object, false if not.
 */
api.isObject = v => Object.prototype.toString.call(v) === '[object Object]';

/**
 * Returns true if the given value is a String.
 *
 * @param v the value to check.
 *
 * @return true if the value is a String, false if not.
 */
api.isString = v => (typeof v === 'string' ||
  Object.prototype.toString.call(v) === '[object String]');

/**
 * Returns true if the given value is undefined.
 *
 * @param v the value to check.
 *
 * @return true if the value is undefined, false if not.
 */
api.isUndefined = v => typeof v === 'undefined';

},{}],63:[function(require,module,exports){
/*
 * Copyright (c) 2017 Digital Bazaar, Inc. All rights reserved.
 */
'use strict';

const types = require('./types');

const api = {};
module.exports = api;

// define URL parser
// parseUri 1.2.2
// (c) Steven Levithan <stevenlevithan.com>
// MIT License
// with local jsonld.js modifications
api.parsers = {
  simple: {
    // RFC 3986 basic parts
    keys: [
      'href', 'scheme', 'authority', 'path', 'query', 'fragment'
    ],
    /* eslint-disable-next-line max-len */
    regex: /^(?:([^:\/?#]+):)?(?:\/\/([^\/?#]*))?([^?#]*)(?:\?([^#]*))?(?:#(.*))?/
  },
  full: {
    keys: [
      'href', 'protocol', 'scheme', 'authority', 'auth', 'user', 'password',
      'hostname', 'port', 'path', 'directory', 'file', 'query', 'fragment'
    ],
    /* eslint-disable-next-line max-len */
    regex: /^(([^:\/?#]+):)?(?:\/\/((?:(([^:@]*)(?::([^:@]*))?)?@)?([^:\/?#]*)(?::(\d*))?))?(?:(((?:[^?#\/]*\/)*)([^?#]*))(?:\?([^#]*))?(?:#(.*))?)/
  }
};
api.parse = (str, parser) => {
  const parsed = {};
  const o = api.parsers[parser || 'full'];
  const m = o.regex.exec(str);
  let i = o.keys.length;
  while(i--) {
    parsed[o.keys[i]] = (m[i] === undefined) ? null : m[i];
  }

  // remove default ports in found in URLs
  if((parsed.scheme === 'https' && parsed.port === '443') ||
    (parsed.scheme === 'http' && parsed.port === '80')) {
    parsed.href = parsed.href.replace(':' + parsed.port, '');
    parsed.authority = parsed.authority.replace(':' + parsed.port, '');
    parsed.port = null;
  }

  parsed.normalizedPath = api.removeDotSegments(parsed.path);
  return parsed;
};

/**
 * Prepends a base IRI to the given relative IRI.
 *
 * @param base the base IRI.
 * @param iri the relative IRI.
 *
 * @return the absolute IRI.
 */
api.prependBase = (base, iri) => {
  // skip IRI processing
  if(base === null) {
    return iri;
  }
  // already an absolute IRI
  if(api.isAbsolute(iri)) {
    return iri;
  }

  // parse base if it is a string
  if(!base || types.isString(base)) {
    base = api.parse(base || '');
  }

  // parse given IRI
  const rel = api.parse(iri);

  // per RFC3986 5.2.2
  const transform = {
    protocol: base.protocol || ''
  };

  if(rel.authority !== null) {
    transform.authority = rel.authority;
    transform.path = rel.path;
    transform.query = rel.query;
  } else {
    transform.authority = base.authority;

    if(rel.path === '') {
      transform.path = base.path;
      if(rel.query !== null) {
        transform.query = rel.query;
      } else {
        transform.query = base.query;
      }
    } else {
      if(rel.path.indexOf('/') === 0) {
        // IRI represents an absolute path
        transform.path = rel.path;
      } else {
        // merge paths
        let path = base.path;

        // append relative path to the end of the last directory from base
        path = path.substr(0, path.lastIndexOf('/') + 1);
        if((path.length > 0 || base.authority) && path.substr(-1) !== '/') {
          path += '/';
        }
        path += rel.path;

        transform.path = path;
      }
      transform.query = rel.query;
    }
  }

  if(rel.path !== '') {
    // remove slashes and dots in path
    transform.path = api.removeDotSegments(transform.path);
  }

  // construct URL
  let rval = transform.protocol;
  if(transform.authority !== null) {
    rval += '//' + transform.authority;
  }
  rval += transform.path;
  if(transform.query !== null) {
    rval += '?' + transform.query;
  }
  if(rel.fragment !== null) {
    rval += '#' + rel.fragment;
  }

  // handle empty base
  if(rval === '') {
    rval = './';
  }

  return rval;
};

/**
 * Removes a base IRI from the given absolute IRI.
 *
 * @param base the base IRI.
 * @param iri the absolute IRI.
 *
 * @return the relative IRI if relative to base, otherwise the absolute IRI.
 */
api.removeBase = (base, iri) => {
  // skip IRI processing
  if(base === null) {
    return iri;
  }

  if(!base || types.isString(base)) {
    base = api.parse(base || '');
  }

  // establish base root
  let root = '';
  if(base.href !== '') {
    root += (base.protocol || '') + '//' + (base.authority || '');
  } else if(iri.indexOf('//')) {
    // support network-path reference with empty base
    root += '//';
  }

  // IRI not relative to base
  if(iri.indexOf(root) !== 0) {
    return iri;
  }

  // remove root from IRI and parse remainder
  const rel = api.parse(iri.substr(root.length));

  // remove path segments that match (do not remove last segment unless there
  // is a hash or query)
  const baseSegments = base.normalizedPath.split('/');
  const iriSegments = rel.normalizedPath.split('/');
  const last = (rel.fragment || rel.query) ? 0 : 1;
  while(baseSegments.length > 0 && iriSegments.length > last) {
    if(baseSegments[0] !== iriSegments[0]) {
      break;
    }
    baseSegments.shift();
    iriSegments.shift();
  }

  // use '../' for each non-matching base segment
  let rval = '';
  if(baseSegments.length > 0) {
    // don't count the last segment (if it ends with '/' last path doesn't
    // count and if it doesn't end with '/' it isn't a path)
    baseSegments.pop();
    for(let i = 0; i < baseSegments.length; ++i) {
      rval += '../';
    }
  }

  // prepend remaining segments
  rval += iriSegments.join('/');

  // add query and hash
  if(rel.query !== null) {
    rval += '?' + rel.query;
  }
  if(rel.fragment !== null) {
    rval += '#' + rel.fragment;
  }

  // handle empty base
  if(rval === '') {
    rval = './';
  }

  return rval;
};

/**
 * Removes dot segments from a URL path.
 *
 * @param path the path to remove dot segments from.
 */
api.removeDotSegments = path => {
  // RFC 3986 5.2.4 (reworked)

  // empty path shortcut
  if(path.length === 0) {
    return '';
  }

  const input = path.split('/');
  const output = [];

  while(input.length > 0) {
    const next = input.shift();
    const done = input.length === 0;

    if(next === '.') {
      if(done) {
        // ensure output has trailing /
        output.push('');
      }
      continue;
    }

    if(next === '..') {
      output.pop();
      if(done) {
        // ensure output has trailing /
        output.push('');
      }
      continue;
    }

    output.push(next);
  }

  // if path was absolute, ensure output has leading /
  if(path[0] === '/' && output.length > 0 && output[0] !== '') {
    output.unshift('');
  }
  if(output.length === 1 && output[0] === '') {
    return '/';
  }

  return output.join('/');
};

// TODO: time better isAbsolute/isRelative checks using full regexes:
// http://jmrware.com/articles/2009/uri_regexp/URI_regex.html

// regex to check for absolute IRI (starting scheme and ':') or blank node IRI
const isAbsoluteRegex = /^([A-Za-z][A-Za-z0-9+-.]*|_):[^\s]*$/;

/**
 * Returns true if the given value is an absolute IRI or blank node IRI, false
 * if not.
 * Note: This weak check only checks for a correct starting scheme.
 *
 * @param v the value to check.
 *
 * @return true if the value is an absolute IRI, false if not.
 */
api.isAbsolute = v => types.isString(v) && isAbsoluteRegex.test(v);

/**
 * Returns true if the given value is a relative IRI, false if not.
 * Note: this is a weak check.
 *
 * @param v the value to check.
 *
 * @return true if the value is a relative IRI, false if not.
 */
api.isRelative = v => types.isString(v);

},{"./types":62}],64:[function(require,module,exports){
/*
 * Copyright (c) 2017-2019 Digital Bazaar, Inc. All rights reserved.
 */
'use strict';

const graphTypes = require('./graphTypes');
const types = require('./types');
// TODO: move `IdentifierIssuer` to its own package
const IdentifierIssuer = require('rdf-canonize').IdentifierIssuer;
const JsonLdError = require('./JsonLdError');

// constants
const REGEX_LINK_HEADERS = /(?:<[^>]*?>|"[^"]*?"|[^,])+/g;
const REGEX_LINK_HEADER = /\s*<([^>]*?)>\s*(?:;\s*(.*))?/;
const REGEX_LINK_HEADER_PARAMS =
  /(.*?)=(?:(?:"([^"]*?)")|([^"]*?))\s*(?:(?:;\s*)|$)/g;

const DEFAULTS = {
  headers: {
    accept: 'application/ld+json, application/json'
  }
};

const api = {};
module.exports = api;
api.IdentifierIssuer = IdentifierIssuer;

/**
 * Clones an object, array, Map, Set, or string/number. If a typed JavaScript
 * object is given, such as a Date, it will be converted to a string.
 *
 * @param value the value to clone.
 *
 * @return the cloned value.
 */
api.clone = function(value) {
  if(value && typeof value === 'object') {
    let rval;
    if(types.isArray(value)) {
      rval = [];
      for(let i = 0; i < value.length; ++i) {
        rval[i] = api.clone(value[i]);
      }
    } else if(value instanceof Map) {
      rval = new Map();
      for(const [k, v] of value) {
        rval.set(k, api.clone(v));
      }
    } else if(value instanceof Set) {
      rval = new Set();
      for(const v of value) {
        rval.add(api.clone(v));
      }
    } else if(types.isObject(value)) {
      rval = {};
      for(const key in value) {
        rval[key] = api.clone(value[key]);
      }
    } else {
      rval = value.toString();
    }
    return rval;
  }
  return value;
};

/**
 * Ensure a value is an array. If the value is an array, it is returned.
 * Otherwise, it is wrapped in an array.
 *
 * @param value the value to return as an array.
 *
 * @return the value as an array.
 */
api.asArray = function(value) {
  return Array.isArray(value) ? value : [value];
};

/**
 * Builds an HTTP headers object for making a JSON-LD request from custom
 * headers and asserts the `accept` header isn't overridden.
 *
 * @param headers an object of headers with keys as header names and values
 *          as header values.
 *
 * @return an object of headers with a valid `accept` header.
 */
api.buildHeaders = (headers = {}) => {
  const hasAccept = Object.keys(headers).some(
    h => h.toLowerCase() === 'accept');

  if(hasAccept) {
    throw new RangeError(
      'Accept header may not be specified; only "' +
      DEFAULTS.headers.accept + '" is supported.');
  }

  return Object.assign({Accept: DEFAULTS.headers.accept}, headers);
};

/**
 * Parses a link header. The results will be key'd by the value of "rel".
 *
 * Link: <http://json-ld.org/contexts/person.jsonld>;
 * rel="http://www.w3.org/ns/json-ld#context"; type="application/ld+json"
 *
 * Parses as: {
 *   'http://www.w3.org/ns/json-ld#context': {
 *     target: http://json-ld.org/contexts/person.jsonld,
 *     type: 'application/ld+json'
 *   }
 * }
 *
 * If there is more than one "rel" with the same IRI, then entries in the
 * resulting map for that "rel" will be arrays.
 *
 * @param header the link header to parse.
 */
api.parseLinkHeader = header => {
  const rval = {};
  // split on unbracketed/unquoted commas
  const entries = header.match(REGEX_LINK_HEADERS);
  for(let i = 0; i < entries.length; ++i) {
    let match = entries[i].match(REGEX_LINK_HEADER);
    if(!match) {
      continue;
    }
    const result = {target: match[1]};
    const params = match[2];
    while((match = REGEX_LINK_HEADER_PARAMS.exec(params))) {
      result[match[1]] = (match[2] === undefined) ? match[3] : match[2];
    }
    const rel = result['rel'] || '';
    if(Array.isArray(rval[rel])) {
      rval[rel].push(result);
    } else if(rval.hasOwnProperty(rel)) {
      rval[rel] = [rval[rel], result];
    } else {
      rval[rel] = result;
    }
  }
  return rval;
};

/**
 * Throws an exception if the given value is not a valid @type value.
 *
 * @param v the value to check.
 */
api.validateTypeValue = (v, isFrame) => {
  if(types.isString(v)) {
    return;
  }

  if(types.isArray(v) && v.every(vv => types.isString(vv))) {
    return;
  }
  if(isFrame && types.isObject(v)) {
    switch(Object.keys(v).length) {
      case 0:
        // empty object is wildcard
        return;
      case 1:
        // default entry is all strings
        if('@default' in v &&
          api.asArray(v['@default']).every(vv => types.isString(vv))) {
          return;
        }
    }
  }

  throw new JsonLdError(
    'Invalid JSON-LD syntax; "@type" value must a string, an array of ' +
    'strings, an empty object, ' +
    'or a default object.', 'jsonld.SyntaxError',
    {code: 'invalid type value', value: v});
};

/**
 * Returns true if the given subject has the given property.
 *
 * @param subject the subject to check.
 * @param property the property to look for.
 *
 * @return true if the subject has the given property, false if not.
 */
api.hasProperty = (subject, property) => {
  if(subject.hasOwnProperty(property)) {
    const value = subject[property];
    return (!types.isArray(value) || value.length > 0);
  }
  return false;
};

/**
 * Determines if the given value is a property of the given subject.
 *
 * @param subject the subject to check.
 * @param property the property to check.
 * @param value the value to check.
 *
 * @return true if the value exists, false if not.
 */
api.hasValue = (subject, property, value) => {
  if(api.hasProperty(subject, property)) {
    let val = subject[property];
    const isList = graphTypes.isList(val);
    if(types.isArray(val) || isList) {
      if(isList) {
        val = val['@list'];
      }
      for(let i = 0; i < val.length; ++i) {
        if(api.compareValues(value, val[i])) {
          return true;
        }
      }
    } else if(!types.isArray(value)) {
      // avoid matching the set of values with an array value parameter
      return api.compareValues(value, val);
    }
  }
  return false;
};

/**
 * Adds a value to a subject. If the value is an array, all values in the
 * array will be added.
 *
 * @param subject the subject to add the value to.
 * @param property the property that relates the value to the subject.
 * @param value the value to add.
 * @param [options] the options to use:
 *        [propertyIsArray] true if the property is always an array, false
 *          if not (default: false).
 *        [valueIsArray] true if the value to be added should be preserved as
 *          an array (lists) (default: false).
 *        [allowDuplicate] true to allow duplicates, false not to (uses a
 *          simple shallow comparison of subject ID or value) (default: true).
 *        [prependValue] false to prepend value to any existing values.
 *          (default: false)
 */
api.addValue = (subject, property, value, options) => {
  options = options || {};
  if(!('propertyIsArray' in options)) {
    options.propertyIsArray = false;
  }
  if(!('valueIsArray' in options)) {
    options.valueIsArray = false;
  }
  if(!('allowDuplicate' in options)) {
    options.allowDuplicate = true;
  }
  if(!('prependValue' in options)) {
    options.prependValue = false;
  }

  if(options.valueIsArray) {
    subject[property] = value;
  } else if(types.isArray(value)) {
    if(value.length === 0 && options.propertyIsArray &&
      !subject.hasOwnProperty(property)) {
      subject[property] = [];
    }
    if(options.prependValue) {
      value = value.concat(subject[property]);
      subject[property] = [];
    }
    for(let i = 0; i < value.length; ++i) {
      api.addValue(subject, property, value[i], options);
    }
  } else if(subject.hasOwnProperty(property)) {
    // check if subject already has value if duplicates not allowed
    const hasValue = (!options.allowDuplicate &&
      api.hasValue(subject, property, value));

    // make property an array if value not present or always an array
    if(!types.isArray(subject[property]) &&
      (!hasValue || options.propertyIsArray)) {
      subject[property] = [subject[property]];
    }

    // add new value
    if(!hasValue) {
      if(options.prependValue) {
        subject[property].unshift(value);
      } else {
        subject[property].push(value);
      }
    }
  } else {
    // add new value as set or single value
    subject[property] = options.propertyIsArray ? [value] : value;
  }
};

/**
 * Gets all of the values for a subject's property as an array.
 *
 * @param subject the subject.
 * @param property the property.
 *
 * @return all of the values for a subject's property as an array.
 */
api.getValues = (subject, property) => [].concat(subject[property] || []);

/**
 * Removes a property from a subject.
 *
 * @param subject the subject.
 * @param property the property.
 */
api.removeProperty = (subject, property) => {
  delete subject[property];
};

/**
 * Removes a value from a subject.
 *
 * @param subject the subject.
 * @param property the property that relates the value to the subject.
 * @param value the value to remove.
 * @param [options] the options to use:
 *          [propertyIsArray] true if the property is always an array, false
 *            if not (default: false).
 */
api.removeValue = (subject, property, value, options) => {
  options = options || {};
  if(!('propertyIsArray' in options)) {
    options.propertyIsArray = false;
  }

  // filter out value
  const values = api.getValues(subject, property).filter(
    e => !api.compareValues(e, value));

  if(values.length === 0) {
    api.removeProperty(subject, property);
  } else if(values.length === 1 && !options.propertyIsArray) {
    subject[property] = values[0];
  } else {
    subject[property] = values;
  }
};

/**
 * Relabels all blank nodes in the given JSON-LD input.
 *
 * @param input the JSON-LD input.
 * @param [options] the options to use:
 *          [issuer] an IdentifierIssuer to use to label blank nodes.
 */
api.relabelBlankNodes = (input, options) => {
  options = options || {};
  const issuer = options.issuer || new IdentifierIssuer('_:b');
  return _labelBlankNodes(issuer, input);
};

/**
 * Compares two JSON-LD values for equality. Two JSON-LD values will be
 * considered equal if:
 *
 * 1. They are both primitives of the same type and value.
 * 2. They are both @values with the same @value, @type, @language,
 *   and @index, OR
 * 3. They both have @ids they are the same.
 *
 * @param v1 the first value.
 * @param v2 the second value.
 *
 * @return true if v1 and v2 are considered equal, false if not.
 */
api.compareValues = (v1, v2) => {
  // 1. equal primitives
  if(v1 === v2) {
    return true;
  }

  // 2. equal @values
  if(graphTypes.isValue(v1) && graphTypes.isValue(v2) &&
    v1['@value'] === v2['@value'] &&
    v1['@type'] === v2['@type'] &&
    v1['@language'] === v2['@language'] &&
    v1['@index'] === v2['@index']) {
    return true;
  }

  // 3. equal @ids
  if(types.isObject(v1) &&
    ('@id' in v1) &&
    types.isObject(v2) &&
    ('@id' in v2)) {
    return v1['@id'] === v2['@id'];
  }

  return false;
};

/**
 * Compares two strings first based on length and then lexicographically.
 *
 * @param a the first string.
 * @param b the second string.
 *
 * @return -1 if a < b, 1 if a > b, 0 if a === b.
 */
api.compareShortestLeast = (a, b) => {
  if(a.length < b.length) {
    return -1;
  }
  if(b.length < a.length) {
    return 1;
  }
  if(a === b) {
    return 0;
  }
  return (a < b) ? -1 : 1;
};

/**
 * Labels the blank nodes in the given value using the given IdentifierIssuer.
 *
 * @param issuer the IdentifierIssuer to use.
 * @param element the element with blank nodes to rename.
 *
 * @return the element.
 */
function _labelBlankNodes(issuer, element) {
  if(types.isArray(element)) {
    for(let i = 0; i < element.length; ++i) {
      element[i] = _labelBlankNodes(issuer, element[i]);
    }
  } else if(graphTypes.isList(element)) {
    element['@list'] = _labelBlankNodes(issuer, element['@list']);
  } else if(types.isObject(element)) {
    // relabel blank node
    if(graphTypes.isBlankNode(element)) {
      element['@id'] = issuer.getId(element['@id']);
    }

    // recursively apply to all keys
    const keys = Object.keys(element).sort();
    for(let ki = 0; ki < keys.length; ++ki) {
      const key = keys[ki];
      if(key !== '@id') {
        element[key] = _labelBlankNodes(issuer, element[key]);
      }
    }
  }

  return element;
}

},{"./JsonLdError":44,"./graphTypes":57,"./types":62,"rdf-canonize":69}],65:[function(require,module,exports){
'use strict'

// A linked list to keep track of recently-used-ness
const Yallist = require('yallist')

const MAX = Symbol('max')
const LENGTH = Symbol('length')
const LENGTH_CALCULATOR = Symbol('lengthCalculator')
const ALLOW_STALE = Symbol('allowStale')
const MAX_AGE = Symbol('maxAge')
const DISPOSE = Symbol('dispose')
const NO_DISPOSE_ON_SET = Symbol('noDisposeOnSet')
const LRU_LIST = Symbol('lruList')
const CACHE = Symbol('cache')
const UPDATE_AGE_ON_GET = Symbol('updateAgeOnGet')

const naiveLength = () => 1

// lruList is a yallist where the head is the youngest
// item, and the tail is the oldest.  the list contains the Hit
// objects as the entries.
// Each Hit object has a reference to its Yallist.Node.  This
// never changes.
//
// cache is a Map (or PseudoMap) that matches the keys to
// the Yallist.Node object.
class LRUCache {
  constructor (options) {
    if (typeof options === 'number')
      options = { max: options }

    if (!options)
      options = {}

    if (options.max && (typeof options.max !== 'number' || options.max < 0))
      throw new TypeError('max must be a non-negative number')
    // Kind of weird to have a default max of Infinity, but oh well.
    const max = this[MAX] = options.max || Infinity

    const lc = options.length || naiveLength
    this[LENGTH_CALCULATOR] = (typeof lc !== 'function') ? naiveLength : lc
    this[ALLOW_STALE] = options.stale || false
    if (options.maxAge && typeof options.maxAge !== 'number')
      throw new TypeError('maxAge must be a number')
    this[MAX_AGE] = options.maxAge || 0
    this[DISPOSE] = options.dispose
    this[NO_DISPOSE_ON_SET] = options.noDisposeOnSet || false
    this[UPDATE_AGE_ON_GET] = options.updateAgeOnGet || false
    this.reset()
  }

  // resize the cache when the max changes.
  set max (mL) {
    if (typeof mL !== 'number' || mL < 0)
      throw new TypeError('max must be a non-negative number')

    this[MAX] = mL || Infinity
    trim(this)
  }
  get max () {
    return this[MAX]
  }

  set allowStale (allowStale) {
    this[ALLOW_STALE] = !!allowStale
  }
  get allowStale () {
    return this[ALLOW_STALE]
  }

  set maxAge (mA) {
    if (typeof mA !== 'number')
      throw new TypeError('maxAge must be a non-negative number')

    this[MAX_AGE] = mA
    trim(this)
  }
  get maxAge () {
    return this[MAX_AGE]
  }

  // resize the cache when the lengthCalculator changes.
  set lengthCalculator (lC) {
    if (typeof lC !== 'function')
      lC = naiveLength

    if (lC !== this[LENGTH_CALCULATOR]) {
      this[LENGTH_CALCULATOR] = lC
      this[LENGTH] = 0
      this[LRU_LIST].forEach(hit => {
        hit.length = this[LENGTH_CALCULATOR](hit.value, hit.key)
        this[LENGTH] += hit.length
      })
    }
    trim(this)
  }
  get lengthCalculator () { return this[LENGTH_CALCULATOR] }

  get length () { return this[LENGTH] }
  get itemCount () { return this[LRU_LIST].length }

  rforEach (fn, thisp) {
    thisp = thisp || this
    for (let walker = this[LRU_LIST].tail; walker !== null;) {
      const prev = walker.prev
      forEachStep(this, fn, walker, thisp)
      walker = prev
    }
  }

  forEach (fn, thisp) {
    thisp = thisp || this
    for (let walker = this[LRU_LIST].head; walker !== null;) {
      const next = walker.next
      forEachStep(this, fn, walker, thisp)
      walker = next
    }
  }

  keys () {
    return this[LRU_LIST].toArray().map(k => k.key)
  }

  values () {
    return this[LRU_LIST].toArray().map(k => k.value)
  }

  reset () {
    if (this[DISPOSE] &&
        this[LRU_LIST] &&
        this[LRU_LIST].length) {
      this[LRU_LIST].forEach(hit => this[DISPOSE](hit.key, hit.value))
    }

    this[CACHE] = new Map() // hash of items by key
    this[LRU_LIST] = new Yallist() // list of items in order of use recency
    this[LENGTH] = 0 // length of items in the list
  }

  dump () {
    return this[LRU_LIST].map(hit =>
      isStale(this, hit) ? false : {
        k: hit.key,
        v: hit.value,
        e: hit.now + (hit.maxAge || 0)
      }).toArray().filter(h => h)
  }

  dumpLru () {
    return this[LRU_LIST]
  }

  set (key, value, maxAge) {
    maxAge = maxAge || this[MAX_AGE]

    if (maxAge && typeof maxAge !== 'number')
      throw new TypeError('maxAge must be a number')

    const now = maxAge ? Date.now() : 0
    const len = this[LENGTH_CALCULATOR](value, key)

    if (this[CACHE].has(key)) {
      if (len > this[MAX]) {
        del(this, this[CACHE].get(key))
        return false
      }

      const node = this[CACHE].get(key)
      const item = node.value

      // dispose of the old one before overwriting
      // split out into 2 ifs for better coverage tracking
      if (this[DISPOSE]) {
        if (!this[NO_DISPOSE_ON_SET])
          this[DISPOSE](key, item.value)
      }

      item.now = now
      item.maxAge = maxAge
      item.value = value
      this[LENGTH] += len - item.length
      item.length = len
      this.get(key)
      trim(this)
      return true
    }

    const hit = new Entry(key, value, len, now, maxAge)

    // oversized objects fall out of cache automatically.
    if (hit.length > this[MAX]) {
      if (this[DISPOSE])
        this[DISPOSE](key, value)

      return false
    }

    this[LENGTH] += hit.length
    this[LRU_LIST].unshift(hit)
    this[CACHE].set(key, this[LRU_LIST].head)
    trim(this)
    return true
  }

  has (key) {
    if (!this[CACHE].has(key)) return false
    const hit = this[CACHE].get(key).value
    return !isStale(this, hit)
  }

  get (key) {
    return get(this, key, true)
  }

  peek (key) {
    return get(this, key, false)
  }

  pop () {
    const node = this[LRU_LIST].tail
    if (!node)
      return null

    del(this, node)
    return node.value
  }

  del (key) {
    del(this, this[CACHE].get(key))
  }

  load (arr) {
    // reset the cache
    this.reset()

    const now = Date.now()
    // A previous serialized cache has the most recent items first
    for (let l = arr.length - 1; l >= 0; l--) {
      const hit = arr[l]
      const expiresAt = hit.e || 0
      if (expiresAt === 0)
        // the item was created without expiration in a non aged cache
        this.set(hit.k, hit.v)
      else {
        const maxAge = expiresAt - now
        // dont add already expired items
        if (maxAge > 0) {
          this.set(hit.k, hit.v, maxAge)
        }
      }
    }
  }

  prune () {
    this[CACHE].forEach((value, key) => get(this, key, false))
  }
}

const get = (self, key, doUse) => {
  const node = self[CACHE].get(key)
  if (node) {
    const hit = node.value
    if (isStale(self, hit)) {
      del(self, node)
      if (!self[ALLOW_STALE])
        return undefined
    } else {
      if (doUse) {
        if (self[UPDATE_AGE_ON_GET])
          node.value.now = Date.now()
        self[LRU_LIST].unshiftNode(node)
      }
    }
    return hit.value
  }
}

const isStale = (self, hit) => {
  if (!hit || (!hit.maxAge && !self[MAX_AGE]))
    return false

  const diff = Date.now() - hit.now
  return hit.maxAge ? diff > hit.maxAge
    : self[MAX_AGE] && (diff > self[MAX_AGE])
}

const trim = self => {
  if (self[LENGTH] > self[MAX]) {
    for (let walker = self[LRU_LIST].tail;
      self[LENGTH] > self[MAX] && walker !== null;) {
      // We know that we're about to delete this one, and also
      // what the next least recently used key will be, so just
      // go ahead and set it now.
      const prev = walker.prev
      del(self, walker)
      walker = prev
    }
  }
}

const del = (self, node) => {
  if (node) {
    const hit = node.value
    if (self[DISPOSE])
      self[DISPOSE](hit.key, hit.value)

    self[LENGTH] -= hit.length
    self[CACHE].delete(hit.key)
    self[LRU_LIST].removeNode(node)
  }
}

class Entry {
  constructor (key, value, length, now, maxAge) {
    this.key = key
    this.value = value
    this.length = length
    this.now = now
    this.maxAge = maxAge || 0
  }
}

const forEachStep = (self, fn, node, thisp) => {
  let hit = node.value
  if (isStale(self, hit)) {
    del(self, node)
    if (!self[ALLOW_STALE])
      hit = undefined
  }
  if (hit)
    fn.call(thisp, hit.value, hit.key, self)
}

module.exports = LRUCache

},{"yallist":92}],66:[function(require,module,exports){
(function (process){(function (){
// This file replaces `index.js` in bundlers like webpack or Rollup,
// according to `browser` config in `package.json`.

let { urlAlphabet } = require('./url-alphabet/index.cjs')

if (process.env.NODE_ENV !== 'production') {
  // All bundlers will remove this block in the production bundle.
  if (
    typeof navigator !== 'undefined' &&
    navigator.product === 'ReactNative' &&
    typeof crypto === 'undefined'
  ) {
    throw new Error(
      'React Native does not have a built-in secure random generator. ' +
        'If you don’t need unpredictable IDs use `nanoid/non-secure`. ' +
        'For secure IDs, import `react-native-get-random-values` ' +
        'before Nano ID.'
    )
  }
  if (typeof msCrypto !== 'undefined' && typeof crypto === 'undefined') {
    throw new Error(
      'Import file with `if (!window.crypto) window.crypto = window.msCrypto`' +
        ' before importing Nano ID to fix IE 11 support'
    )
  }
  if (typeof crypto === 'undefined') {
    throw new Error(
      'Your browser does not have secure random generator. ' +
        'If you don’t need unpredictable IDs, you can use nanoid/non-secure.'
    )
  }
}

let random = bytes => crypto.getRandomValues(new Uint8Array(bytes))

let customRandom = (alphabet, size, getRandom) => {
  // First, a bitmask is necessary to generate the ID. The bitmask makes bytes
  // values closer to the alphabet size. The bitmask calculates the closest
  // `2^31 - 1` number, which exceeds the alphabet size.
  // For example, the bitmask for the alphabet size 30 is 31 (00011111).
  // `Math.clz32` is not used, because it is not available in browsers.
  let mask = (2 << (Math.log(alphabet.length - 1) / Math.LN2)) - 1
  // Though, the bitmask solution is not perfect since the bytes exceeding
  // the alphabet size are refused. Therefore, to reliably generate the ID,
  // the random bytes redundancy has to be satisfied.

  // Note: every hardware random generator call is performance expensive,
  // because the system call for entropy collection takes a lot of time.
  // So, to avoid additional system calls, extra bytes are requested in advance.

  // Next, a step determines how many random bytes to generate.
  // The number of random bytes gets decided upon the ID size, mask,
  // alphabet size, and magic number 1.6 (using 1.6 peaks at performance
  // according to benchmarks).

  // `-~f => Math.ceil(f)` if f is a float
  // `-~i => i + 1` if i is an integer
  let step = -~((1.6 * mask * size) / alphabet.length)

  return () => {
    let id = ''
    while (true) {
      let bytes = getRandom(step)
      // A compact alternative for `for (var i = 0; i < step; i++)`.
      let j = step
      while (j--) {
        // Adding `|| ''` refuses a random byte that exceeds the alphabet size.
        id += alphabet[bytes[j] & mask] || ''
        if (id.length === size) return id
      }
    }
  }
}

let customAlphabet = (alphabet, size) => customRandom(alphabet, size, random)

let nanoid = (size = 21) => {
  let id = ''
  let bytes = crypto.getRandomValues(new Uint8Array(size))

  // A compact alternative for `for (var i = 0; i < step; i++)`.
  while (size--) {
    // It is incorrect to use bytes exceeding the alphabet size.
    // The following mask reduces the random byte in the 0-255 value
    // range to the 0-63 value range. Therefore, adding hacks, such
    // as empty string fallback or magic numbers, is unneccessary because
    // the bitmask trims bytes down to the alphabet size.
    let byte = bytes[size] & 63
    if (byte < 36) {
      // `0-9a-z`
      id += byte.toString(36)
    } else if (byte < 62) {
      // `A-Z`
      id += (byte - 26).toString(36).toUpperCase()
    } else if (byte < 63) {
      id += '_'
    } else {
      id += '-'
    }
  }
  return id
}

module.exports = { nanoid, customAlphabet, customRandom, urlAlphabet, random }

}).call(this)}).call(this,require('_process'))
},{"./url-alphabet/index.cjs":67,"_process":68}],67:[function(require,module,exports){
// This alphabet uses `A-Za-z0-9_-` symbols. The genetic algorithm helped
// optimize the gzip compression for this alphabet.
let urlAlphabet =
  'ModuleSymbhasOwnPr-0123456789ABCDEFGHNRVfgctiUvz_KqYTJkLxpZXIjQW'

module.exports = { urlAlphabet }

},{}],68:[function(require,module,exports){
// shim for using process in browser
var process = module.exports = {};

// cached from whatever global is present so that test runners that stub it
// don't break things.  But we need to wrap it in a try catch in case it is
// wrapped in strict mode code which doesn't define any globals.  It's inside a
// function because try/catches deoptimize in certain engines.

var cachedSetTimeout;
var cachedClearTimeout;

function defaultSetTimout() {
    throw new Error('setTimeout has not been defined');
}
function defaultClearTimeout () {
    throw new Error('clearTimeout has not been defined');
}
(function () {
    try {
        if (typeof setTimeout === 'function') {
            cachedSetTimeout = setTimeout;
        } else {
            cachedSetTimeout = defaultSetTimout;
        }
    } catch (e) {
        cachedSetTimeout = defaultSetTimout;
    }
    try {
        if (typeof clearTimeout === 'function') {
            cachedClearTimeout = clearTimeout;
        } else {
            cachedClearTimeout = defaultClearTimeout;
        }
    } catch (e) {
        cachedClearTimeout = defaultClearTimeout;
    }
} ())
function runTimeout(fun) {
    if (cachedSetTimeout === setTimeout) {
        //normal enviroments in sane situations
        return setTimeout(fun, 0);
    }
    // if setTimeout wasn't available but was latter defined
    if ((cachedSetTimeout === defaultSetTimout || !cachedSetTimeout) && setTimeout) {
        cachedSetTimeout = setTimeout;
        return setTimeout(fun, 0);
    }
    try {
        // when when somebody has screwed with setTimeout but no I.E. maddness
        return cachedSetTimeout(fun, 0);
    } catch(e){
        try {
            // When we are in I.E. but the script has been evaled so I.E. doesn't trust the global object when called normally
            return cachedSetTimeout.call(null, fun, 0);
        } catch(e){
            // same as above but when it's a version of I.E. that must have the global object for 'this', hopfully our context correct otherwise it will throw a global error
            return cachedSetTimeout.call(this, fun, 0);
        }
    }


}
function runClearTimeout(marker) {
    if (cachedClearTimeout === clearTimeout) {
        //normal enviroments in sane situations
        return clearTimeout(marker);
    }
    // if clearTimeout wasn't available but was latter defined
    if ((cachedClearTimeout === defaultClearTimeout || !cachedClearTimeout) && clearTimeout) {
        cachedClearTimeout = clearTimeout;
        return clearTimeout(marker);
    }
    try {
        // when when somebody has screwed with setTimeout but no I.E. maddness
        return cachedClearTimeout(marker);
    } catch (e){
        try {
            // When we are in I.E. but the script has been evaled so I.E. doesn't  trust the global object when called normally
            return cachedClearTimeout.call(null, marker);
        } catch (e){
            // same as above but when it's a version of I.E. that must have the global object for 'this', hopfully our context correct otherwise it will throw a global error.
            // Some versions of I.E. have different rules for clearTimeout vs setTimeout
            return cachedClearTimeout.call(this, marker);
        }
    }



}
var queue = [];
var draining = false;
var currentQueue;
var queueIndex = -1;

function cleanUpNextTick() {
    if (!draining || !currentQueue) {
        return;
    }
    draining = false;
    if (currentQueue.length) {
        queue = currentQueue.concat(queue);
    } else {
        queueIndex = -1;
    }
    if (queue.length) {
        drainQueue();
    }
}

function drainQueue() {
    if (draining) {
        return;
    }
    var timeout = runTimeout(cleanUpNextTick);
    draining = true;

    var len = queue.length;
    while(len) {
        currentQueue = queue;
        queue = [];
        while (++queueIndex < len) {
            if (currentQueue) {
                currentQueue[queueIndex].run();
            }
        }
        queueIndex = -1;
        len = queue.length;
    }
    currentQueue = null;
    draining = false;
    runClearTimeout(timeout);
}

process.nextTick = function (fun) {
    var args = new Array(arguments.length - 1);
    if (arguments.length > 1) {
        for (var i = 1; i < arguments.length; i++) {
            args[i - 1] = arguments[i];
        }
    }
    queue.push(new Item(fun, args));
    if (queue.length === 1 && !draining) {
        runTimeout(drainQueue);
    }
};

// v8 likes predictible objects
function Item(fun, array) {
    this.fun = fun;
    this.array = array;
}
Item.prototype.run = function () {
    this.fun.apply(null, this.array);
};
process.title = 'browser';
process.browser = true;
process.env = {};
process.argv = [];
process.version = ''; // empty string to avoid regexp issues
process.versions = {};

function noop() {}

process.on = noop;
process.addListener = noop;
process.once = noop;
process.off = noop;
process.removeListener = noop;
process.removeAllListeners = noop;
process.emit = noop;
process.prependListener = noop;
process.prependOnceListener = noop;

process.listeners = function (name) { return [] }

process.binding = function (name) {
    throw new Error('process.binding is not supported');
};

process.cwd = function () { return '/' };
process.chdir = function (dir) {
    throw new Error('process.chdir is not supported');
};
process.umask = function() { return 0; };

},{}],69:[function(require,module,exports){
/**
 * An implementation of the RDF Dataset Normalization specification.
 *
 * @author Dave Longley
 *
 * Copyright 2010-2021 Digital Bazaar, Inc.
 */
module.exports = require('./lib');

},{"./lib":78}],70:[function(require,module,exports){
/*
 * Copyright (c) 2016-2021 Digital Bazaar, Inc. All rights reserved.
 */
'use strict';

module.exports = class IdentifierIssuer {
  /**
   * Creates a new IdentifierIssuer. A IdentifierIssuer issues unique
   * identifiers, keeping track of any previously issued identifiers.
   *
   * @param prefix the prefix to use ('<prefix><counter>').
   * @param existing an existing Map to use.
   * @param counter the counter to use.
   */
  constructor(prefix, existing = new Map(), counter = 0) {
    this.prefix = prefix;
    this._existing = existing;
    this.counter = counter;
  }

  /**
   * Copies this IdentifierIssuer.
   *
   * @return a copy of this IdentifierIssuer.
   */
  clone() {
    const {prefix, _existing, counter} = this;
    return new IdentifierIssuer(prefix, new Map(_existing), counter);
  }

  /**
   * Gets the new identifier for the given old identifier, where if no old
   * identifier is given a new identifier will be generated.
   *
   * @param [old] the old identifier to get the new identifier for.
   *
   * @return the new identifier.
   */
  getId(old) {
    // return existing old identifier
    const existing = old && this._existing.get(old);
    if(existing) {
      return existing;
    }

    // get next identifier
    const identifier = this.prefix + this.counter;
    this.counter++;

    // save mapping
    if(old) {
      this._existing.set(old, identifier);
    }

    return identifier;
  }

  /**
   * Returns true if the given old identifer has already been assigned a new
   * identifier.
   *
   * @param old the old identifier to check.
   *
   * @return true if the old identifier has been assigned a new identifier,
   *   false if not.
   */
  hasId(old) {
    return this._existing.has(old);
  }

  /**
   * Returns all of the IDs that have been issued new IDs in the order in
   * which they were issued new IDs.
   *
   * @return the list of old IDs that has been issued new IDs in order.
   */
  getOldIds() {
    return [...this._existing.keys()];
  }
};

},{}],71:[function(require,module,exports){
/*
 * Copyright (c) 2016-2021 Digital Bazaar, Inc. All rights reserved.
 */
'use strict';

require('setimmediate');

const crypto = self.crypto || self.msCrypto;

// TODO: synchronous version no longer supported in browser

module.exports = class MessageDigest {
  /**
   * Creates a new MessageDigest.
   *
   * @param algorithm the algorithm to use.
   */
  constructor(algorithm) {
    // check if crypto.subtle is available
    // check is here rather than top-level to only fail if class is used
    if(!(crypto && crypto.subtle)) {
      throw new Error('crypto.subtle not found.');
    }
    if(algorithm === 'sha256') {
      this.algorithm = {name: 'SHA-256'};
    } else if(algorithm === 'sha1') {
      this.algorithm = {name: 'SHA-1'};
    } else {
      throw new Error(`Unsupport algorithm "${algorithm}".`);
    }
    this._content = '';
  }

  update(msg) {
    this._content += msg;
  }

  async digest() {
    const data = new TextEncoder().encode(this._content);
    const buffer = new Uint8Array(
      await crypto.subtle.digest(this.algorithm, data));
    // return digest in hex
    let hex = '';
    for(let i = 0; i < buffer.length; ++i) {
      hex += buffer[i].toString(16).padStart(2, '0');
    }
    return hex;
  }
};

},{"setimmediate":89}],72:[function(require,module,exports){
/*
 * Copyright (c) 2016-2021 Digital Bazaar, Inc. All rights reserved.
 */
'use strict';

// eslint-disable-next-line no-unused-vars
const TERMS = ['subject', 'predicate', 'object', 'graph'];
const RDF = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#';
const RDF_LANGSTRING = RDF + 'langString';
const XSD_STRING = 'http://www.w3.org/2001/XMLSchema#string';

const TYPE_NAMED_NODE = 'NamedNode';
const TYPE_BLANK_NODE = 'BlankNode';
const TYPE_LITERAL = 'Literal';
const TYPE_DEFAULT_GRAPH = 'DefaultGraph';

// build regexes
const REGEX = {};
(() => {
  const iri = '(?:<([^:]+:[^>]*)>)';
  // https://www.w3.org/TR/turtle/#grammar-production-BLANK_NODE_LABEL
  const PN_CHARS_BASE =
    'A-Z' + 'a-z' +
    '\u00C0-\u00D6' +
    '\u00D8-\u00F6' +
    '\u00F8-\u02FF' +
    '\u0370-\u037D' +
    '\u037F-\u1FFF' +
    '\u200C-\u200D' +
    '\u2070-\u218F' +
    '\u2C00-\u2FEF' +
    '\u3001-\uD7FF' +
    '\uF900-\uFDCF' +
    '\uFDF0-\uFFFD';
    // TODO:
    //'\u10000-\uEFFFF';
  const PN_CHARS_U =
    PN_CHARS_BASE +
    '_';
  const PN_CHARS =
    PN_CHARS_U +
    '0-9' +
    '-' +
    '\u00B7' +
    '\u0300-\u036F' +
    '\u203F-\u2040';
  const BLANK_NODE_LABEL =
    '(_:' +
      '(?:[' + PN_CHARS_U + '0-9])' +
      '(?:(?:[' + PN_CHARS + '.])*(?:[' + PN_CHARS + ']))?' +
    ')';
  const bnode = BLANK_NODE_LABEL;
  const plain = '"([^"\\\\]*(?:\\\\.[^"\\\\]*)*)"';
  const datatype = '(?:\\^\\^' + iri + ')';
  const language = '(?:@([a-zA-Z]+(?:-[a-zA-Z0-9]+)*))';
  const literal = '(?:' + plain + '(?:' + datatype + '|' + language + ')?)';
  const ws = '[ \\t]+';
  const wso = '[ \\t]*';

  // define quad part regexes
  const subject = '(?:' + iri + '|' + bnode + ')' + ws;
  const property = iri + ws;
  const object = '(?:' + iri + '|' + bnode + '|' + literal + ')' + wso;
  const graphName = '(?:\\.|(?:(?:' + iri + '|' + bnode + ')' + wso + '\\.))';

  // end of line and empty regexes
  REGEX.eoln = /(?:\r\n)|(?:\n)|(?:\r)/g;
  REGEX.empty = new RegExp('^' + wso + '$');

  // full quad regex
  REGEX.quad = new RegExp(
    '^' + wso + subject + property + object + graphName + wso + '$');
})();

module.exports = class NQuads {
  /**
   * Parses RDF in the form of N-Quads.
   *
   * @param input the N-Quads input to parse.
   *
   * @return an RDF dataset (an array of quads per http://rdf.js.org/).
   */
  static parse(input) {
    // build RDF dataset
    const dataset = [];

    const graphs = {};

    // split N-Quad input into lines
    const lines = input.split(REGEX.eoln);
    let lineNumber = 0;
    for(const line of lines) {
      lineNumber++;

      // skip empty lines
      if(REGEX.empty.test(line)) {
        continue;
      }

      // parse quad
      const match = line.match(REGEX.quad);
      if(match === null) {
        throw new Error('N-Quads parse error on line ' + lineNumber + '.');
      }

      // create RDF quad
      const quad = {subject: null, predicate: null, object: null, graph: null};

      // get subject
      if(match[1] !== undefined) {
        quad.subject = {termType: TYPE_NAMED_NODE, value: match[1]};
      } else {
        quad.subject = {termType: TYPE_BLANK_NODE, value: match[2]};
      }

      // get predicate
      quad.predicate = {termType: TYPE_NAMED_NODE, value: match[3]};

      // get object
      if(match[4] !== undefined) {
        quad.object = {termType: TYPE_NAMED_NODE, value: match[4]};
      } else if(match[5] !== undefined) {
        quad.object = {termType: TYPE_BLANK_NODE, value: match[5]};
      } else {
        quad.object = {
          termType: TYPE_LITERAL,
          value: undefined,
          datatype: {
            termType: TYPE_NAMED_NODE
          }
        };
        if(match[7] !== undefined) {
          quad.object.datatype.value = match[7];
        } else if(match[8] !== undefined) {
          quad.object.datatype.value = RDF_LANGSTRING;
          quad.object.language = match[8];
        } else {
          quad.object.datatype.value = XSD_STRING;
        }
        quad.object.value = _unescape(match[6]);
      }

      // get graph
      if(match[9] !== undefined) {
        quad.graph = {
          termType: TYPE_NAMED_NODE,
          value: match[9]
        };
      } else if(match[10] !== undefined) {
        quad.graph = {
          termType: TYPE_BLANK_NODE,
          value: match[10]
        };
      } else {
        quad.graph = {
          termType: TYPE_DEFAULT_GRAPH,
          value: ''
        };
      }

      // only add quad if it is unique in its graph
      if(!(quad.graph.value in graphs)) {
        graphs[quad.graph.value] = [quad];
        dataset.push(quad);
      } else {
        let unique = true;
        const quads = graphs[quad.graph.value];
        for(const q of quads) {
          if(_compareTriples(q, quad)) {
            unique = false;
            break;
          }
        }
        if(unique) {
          quads.push(quad);
          dataset.push(quad);
        }
      }
    }

    return dataset;
  }

  /**
   * Converts an RDF dataset to N-Quads.
   *
   * @param dataset (array of quads) the RDF dataset to convert.
   *
   * @return the N-Quads string.
   */
  static serialize(dataset) {
    if(!Array.isArray(dataset)) {
      dataset = NQuads.legacyDatasetToQuads(dataset);
    }
    const quads = [];
    for(const quad of dataset) {
      quads.push(NQuads.serializeQuad(quad));
    }
    return quads.sort().join('');
  }

  /**
   * Converts an RDF quad to an N-Quad string (a single quad).
   *
   * @param quad the RDF quad convert.
   *
   * @return the N-Quad string.
   */
  static serializeQuad(quad) {
    const s = quad.subject;
    const p = quad.predicate;
    const o = quad.object;
    const g = quad.graph;

    let nquad = '';

    // subject can only be NamedNode or BlankNode
    if(s.termType === TYPE_NAMED_NODE) {
      nquad += `<${s.value}>`;
    } else {
      nquad += `${s.value}`;
    }

    // predicate can only be NamedNode
    nquad += ` <${p.value}> `;

    // object is NamedNode, BlankNode, or Literal
    if(o.termType === TYPE_NAMED_NODE) {
      nquad += `<${o.value}>`;
    } else if(o.termType === TYPE_BLANK_NODE) {
      nquad += o.value;
    } else {
      nquad += `"${_escape(o.value)}"`;
      if(o.datatype.value === RDF_LANGSTRING) {
        if(o.language) {
          nquad += `@${o.language}`;
        }
      } else if(o.datatype.value !== XSD_STRING) {
        nquad += `^^<${o.datatype.value}>`;
      }
    }

    // graph can only be NamedNode or BlankNode (or DefaultGraph, but that
    // does not add to `nquad`)
    if(g.termType === TYPE_NAMED_NODE) {
      nquad += ` <${g.value}>`;
    } else if(g.termType === TYPE_BLANK_NODE) {
      nquad += ` ${g.value}`;
    }

    nquad += ' .\n';
    return nquad;
  }

  /**
   * Converts a legacy-formatted dataset to an array of quads dataset per
   * http://rdf.js.org/.
   *
   * @param dataset the legacy dataset to convert.
   *
   * @return the array of quads dataset.
   */
  static legacyDatasetToQuads(dataset) {
    const quads = [];

    const termTypeMap = {
      'blank node': TYPE_BLANK_NODE,
      IRI: TYPE_NAMED_NODE,
      literal: TYPE_LITERAL
    };

    for(const graphName in dataset) {
      const triples = dataset[graphName];
      triples.forEach(triple => {
        const quad = {};
        for(const componentName in triple) {
          const oldComponent = triple[componentName];
          const newComponent = {
            termType: termTypeMap[oldComponent.type],
            value: oldComponent.value
          };
          if(newComponent.termType === TYPE_LITERAL) {
            newComponent.datatype = {
              termType: TYPE_NAMED_NODE
            };
            if('datatype' in oldComponent) {
              newComponent.datatype.value = oldComponent.datatype;
            }
            if('language' in oldComponent) {
              if(!('datatype' in oldComponent)) {
                newComponent.datatype.value = RDF_LANGSTRING;
              }
              newComponent.language = oldComponent.language;
            } else if(!('datatype' in oldComponent)) {
              newComponent.datatype.value = XSD_STRING;
            }
          }
          quad[componentName] = newComponent;
        }
        if(graphName === '@default') {
          quad.graph = {
            termType: TYPE_DEFAULT_GRAPH,
            value: ''
          };
        } else {
          quad.graph = {
            termType: graphName.startsWith('_:') ?
              TYPE_BLANK_NODE : TYPE_NAMED_NODE,
            value: graphName
          };
        }
        quads.push(quad);
      });
    }

    return quads;
  }
};

/**
 * Compares two RDF triples for equality.
 *
 * @param t1 the first triple.
 * @param t2 the second triple.
 *
 * @return true if the triples are the same, false if not.
 */
function _compareTriples(t1, t2) {
  // compare subject and object types first as it is the quickest check
  if(!(t1.subject.termType === t2.subject.termType &&
    t1.object.termType === t2.object.termType)) {
    return false;
  }
  // compare values
  if(!(t1.subject.value === t2.subject.value &&
    t1.predicate.value === t2.predicate.value &&
    t1.object.value === t2.object.value)) {
    return false;
  }
  if(t1.object.termType !== TYPE_LITERAL) {
    // no `datatype` or `language` to check
    return true;
  }
  return (
    (t1.object.datatype.termType === t2.object.datatype.termType) &&
    (t1.object.language === t2.object.language) &&
    (t1.object.datatype.value === t2.object.datatype.value)
  );
}

const _escapeRegex = /["\\\n\r]/g;
/**
 * Escape string to N-Quads literal
 */
function _escape(s) {
  return s.replace(_escapeRegex, function(match) {
    switch(match) {
      case '"': return '\\"';
      case '\\': return '\\\\';
      case '\n': return '\\n';
      case '\r': return '\\r';
    }
  });
}

const _unescapeRegex =
  /(?:\\([tbnrf"'\\]))|(?:\\u([0-9A-Fa-f]{4}))|(?:\\U([0-9A-Fa-f]{8}))/g;
/**
 * Unescape N-Quads literal to string
 */
function _unescape(s) {
  return s.replace(_unescapeRegex, function(match, code, u, U) {
    if(code) {
      switch(code) {
        case 't': return '\t';
        case 'b': return '\b';
        case 'n': return '\n';
        case 'r': return '\r';
        case 'f': return '\f';
        case '"': return '"';
        case '\'': return '\'';
        case '\\': return '\\';
      }
    }
    if(u) {
      return String.fromCharCode(parseInt(u, 16));
    }
    if(U) {
      // FIXME: support larger values
      throw new Error('Unsupported U escape');
    }
  });
}

},{}],73:[function(require,module,exports){
/*
 * Copyright (c) 2016-2021 Digital Bazaar, Inc. All rights reserved.
 */
'use strict';

// TODO: convert to ES6 iterable?

module.exports = class Permuter {
  /**
   * A Permuter iterates over all possible permutations of the given array
   * of elements.
   *
   * @param list the array of elements to iterate over.
   */
  constructor(list) {
    // original array
    this.current = list.sort();
    // indicates whether there are more permutations
    this.done = false;
    // directional info for permutation algorithm
    this.dir = new Map();
    for(let i = 0; i < list.length; ++i) {
      this.dir.set(list[i], true);
    }
  }

  /**
   * Returns true if there is another permutation.
   *
   * @return true if there is another permutation, false if not.
   */
  hasNext() {
    return !this.done;
  }

  /**
   * Gets the next permutation. Call hasNext() to ensure there is another one
   * first.
   *
   * @return the next permutation.
   */
  next() {
    // copy current permutation to return it
    const {current, dir} = this;
    const rval = current.slice();

    /* Calculate the next permutation using the Steinhaus-Johnson-Trotter
     permutation algorithm. */

    // get largest mobile element k
    // (mobile: element is greater than the one it is looking at)
    let k = null;
    let pos = 0;
    const length = current.length;
    for(let i = 0; i < length; ++i) {
      const element = current[i];
      const left = dir.get(element);
      if((k === null || element > k) &&
        ((left && i > 0 && element > current[i - 1]) ||
        (!left && i < (length - 1) && element > current[i + 1]))) {
        k = element;
        pos = i;
      }
    }

    // no more permutations
    if(k === null) {
      this.done = true;
    } else {
      // swap k and the element it is looking at
      const swap = dir.get(k) ? pos - 1 : pos + 1;
      current[pos] = current[swap];
      current[swap] = k;

      // reverse the direction of all elements larger than k
      for(const element of current) {
        if(element > k) {
          dir.set(element, !dir.get(element));
        }
      }
    }

    return rval;
  }
};

},{}],74:[function(require,module,exports){
(function (setImmediate){(function (){
/*
 * Copyright (c) 2016-2021 Digital Bazaar, Inc. All rights reserved.
 */
'use strict';

const IdentifierIssuer = require('./IdentifierIssuer');
const MessageDigest = require('./MessageDigest');
const Permuter = require('./Permuter');
const NQuads = require('./NQuads');

module.exports = class URDNA2015 {
  constructor() {
    this.name = 'URDNA2015';
    this.blankNodeInfo = new Map();
    this.canonicalIssuer = new IdentifierIssuer('_:c14n');
    this.hashAlgorithm = 'sha256';
    this.quads = null;
  }

  // 4.4) Normalization Algorithm
  async main(dataset) {
    this.quads = dataset;

    // 1) Create the normalization state.
    // 2) For every quad in input dataset:
    for(const quad of dataset) {
      // 2.1) For each blank node that occurs in the quad, add a reference
      // to the quad using the blank node identifier in the blank node to
      // quads map, creating a new entry if necessary.
      this._addBlankNodeQuadInfo({quad, component: quad.subject});
      this._addBlankNodeQuadInfo({quad, component: quad.object});
      this._addBlankNodeQuadInfo({quad, component: quad.graph});
    }

    // 3) Create a list of non-normalized blank node identifiers
    // non-normalized identifiers and populate it using the keys from the
    // blank node to quads map.
    // Note: We use a map here and it was generated during step 2.

    // 4) `simple` flag is skipped -- loop is optimized away. This optimization
    // is permitted because there was a typo in the hash first degree quads
    // algorithm in the URDNA2015 spec that was implemented widely making it
    // such that it could not be fixed; the result was that the loop only
    // needs to be run once and the first degree quad hashes will never change.
    // 5.1-5.2 are skipped; first degree quad hashes are generated just once
    // for all non-normalized blank nodes.

    // 5.3) For each blank node identifier identifier in non-normalized
    // identifiers:
    const hashToBlankNodes = new Map();
    const nonNormalized = [...this.blankNodeInfo.keys()];
    let i = 0;
    for(const id of nonNormalized) {
      // Note: batch hashing first degree quads 100 at a time
      if(++i % 100 === 0) {
        await this._yield();
      }
      // steps 5.3.1 and 5.3.2:
      await this._hashAndTrackBlankNode({id, hashToBlankNodes});
    }

    // 5.4) For each hash to identifier list mapping in hash to blank
    // nodes map, lexicographically-sorted by hash:
    const hashes = [...hashToBlankNodes.keys()].sort();
    // optimize away second sort, gather non-unique hashes in order as we go
    const nonUnique = [];
    for(const hash of hashes) {
      // 5.4.1) If the length of identifier list is greater than 1,
      // continue to the next mapping.
      const idList = hashToBlankNodes.get(hash);
      if(idList.length > 1) {
        nonUnique.push(idList);
        continue;
      }

      // 5.4.2) Use the Issue Identifier algorithm, passing canonical
      // issuer and the single blank node identifier in identifier
      // list, identifier, to issue a canonical replacement identifier
      // for identifier.
      const id = idList[0];
      this.canonicalIssuer.getId(id);

      // Note: These steps are skipped, optimized away since the loop
      // only needs to be run once.
      // 5.4.3) Remove identifier from non-normalized identifiers.
      // 5.4.4) Remove hash from the hash to blank nodes map.
      // 5.4.5) Set simple to true.
    }

    // 6) For each hash to identifier list mapping in hash to blank nodes map,
    // lexicographically-sorted by hash:
    // Note: sort optimized away, use `nonUnique`.
    for(const idList of nonUnique) {
      // 6.1) Create hash path list where each item will be a result of
      // running the Hash N-Degree Quads algorithm.
      const hashPathList = [];

      // 6.2) For each blank node identifier identifier in identifier list:
      for(const id of idList) {
        // 6.2.1) If a canonical identifier has already been issued for
        // identifier, continue to the next identifier.
        if(this.canonicalIssuer.hasId(id)) {
          continue;
        }

        // 6.2.2) Create temporary issuer, an identifier issuer
        // initialized with the prefix _:b.
        const issuer = new IdentifierIssuer('_:b');

        // 6.2.3) Use the Issue Identifier algorithm, passing temporary
        // issuer and identifier, to issue a new temporary blank node
        // identifier for identifier.
        issuer.getId(id);

        // 6.2.4) Run the Hash N-Degree Quads algorithm, passing
        // temporary issuer, and append the result to the hash path list.
        const result = await this.hashNDegreeQuads(id, issuer);
        hashPathList.push(result);
      }

      // 6.3) For each result in the hash path list,
      // lexicographically-sorted by the hash in result:
      hashPathList.sort(_stringHashCompare);
      for(const result of hashPathList) {
        // 6.3.1) For each blank node identifier, existing identifier,
        // that was issued a temporary identifier by identifier issuer
        // in result, issue a canonical identifier, in the same order,
        // using the Issue Identifier algorithm, passing canonical
        // issuer and existing identifier.
        const oldIds = result.issuer.getOldIds();
        for(const id of oldIds) {
          this.canonicalIssuer.getId(id);
        }
      }
    }

    /* Note: At this point all blank nodes in the set of RDF quads have been
    assigned canonical identifiers, which have been stored in the canonical
    issuer. Here each quad is updated by assigning each of its blank nodes
    its new identifier. */

    // 7) For each quad, quad, in input dataset:
    const normalized = [];
    for(const quad of this.quads) {
      // 7.1) Create a copy, quad copy, of quad and replace any existing
      // blank node identifiers using the canonical identifiers
      // previously issued by canonical issuer.
      // Note: We optimize with shallow copies here.
      const q = {...quad};
      q.subject = this._useCanonicalId({component: q.subject});
      q.object = this._useCanonicalId({component: q.object});
      q.graph = this._useCanonicalId({component: q.graph});
      // 7.2) Add quad copy to the normalized dataset.
      normalized.push(NQuads.serializeQuad(q));
    }

    // sort normalized output
    normalized.sort();

    // 8) Return the normalized dataset.
    return normalized.join('');
  }

  // 4.6) Hash First Degree Quads
  async hashFirstDegreeQuads(id) {
    // 1) Initialize nquads to an empty list. It will be used to store quads in
    // N-Quads format.
    const nquads = [];

    // 2) Get the list of quads `quads` associated with the reference blank node
    // identifier in the blank node to quads map.
    const info = this.blankNodeInfo.get(id);
    const quads = info.quads;

    // 3) For each quad `quad` in `quads`:
    for(const quad of quads) {
      // 3.1) Serialize the quad in N-Quads format with the following special
      // rule:

      // 3.1.1) If any component in quad is an blank node, then serialize it
      // using a special identifier as follows:
      const copy = {
        subject: null, predicate: quad.predicate, object: null, graph: null
      };
      // 3.1.2) If the blank node's existing blank node identifier matches
      // the reference blank node identifier then use the blank node
      // identifier _:a, otherwise, use the blank node identifier _:z.
      copy.subject = this.modifyFirstDegreeComponent(
        id, quad.subject, 'subject');
      copy.object = this.modifyFirstDegreeComponent(
        id, quad.object, 'object');
      copy.graph = this.modifyFirstDegreeComponent(
        id, quad.graph, 'graph');
      nquads.push(NQuads.serializeQuad(copy));
    }

    // 4) Sort nquads in lexicographical order.
    nquads.sort();

    // 5) Return the hash that results from passing the sorted, joined nquads
    // through the hash algorithm.
    const md = new MessageDigest(this.hashAlgorithm);
    for(const nquad of nquads) {
      md.update(nquad);
    }
    info.hash = await md.digest();
    return info.hash;
  }

  // 4.7) Hash Related Blank Node
  async hashRelatedBlankNode(related, quad, issuer, position) {
    // 1) Set the identifier to use for related, preferring first the canonical
    // identifier for related if issued, second the identifier issued by issuer
    // if issued, and last, if necessary, the result of the Hash First Degree
    // Quads algorithm, passing related.
    let id;
    if(this.canonicalIssuer.hasId(related)) {
      id = this.canonicalIssuer.getId(related);
    } else if(issuer.hasId(related)) {
      id = issuer.getId(related);
    } else {
      id = this.blankNodeInfo.get(related).hash;
    }

    // 2) Initialize a string input to the value of position.
    // Note: We use a hash object instead.
    const md = new MessageDigest(this.hashAlgorithm);
    md.update(position);

    // 3) If position is not g, append <, the value of the predicate in quad,
    // and > to input.
    if(position !== 'g') {
      md.update(this.getRelatedPredicate(quad));
    }

    // 4) Append identifier to input.
    md.update(id);

    // 5) Return the hash that results from passing input through the hash
    // algorithm.
    return md.digest();
  }

  // 4.8) Hash N-Degree Quads
  async hashNDegreeQuads(id, issuer) {
    // 1) Create a hash to related blank nodes map for storing hashes that
    // identify related blank nodes.
    // Note: 2) and 3) handled within `createHashToRelated`
    const md = new MessageDigest(this.hashAlgorithm);
    const hashToRelated = await this.createHashToRelated(id, issuer);

    // 4) Create an empty string, data to hash.
    // Note: We created a hash object `md` above instead.

    // 5) For each related hash to blank node list mapping in hash to related
    // blank nodes map, sorted lexicographically by related hash:
    const hashes = [...hashToRelated.keys()].sort();
    for(const hash of hashes) {
      // 5.1) Append the related hash to the data to hash.
      md.update(hash);

      // 5.2) Create a string chosen path.
      let chosenPath = '';

      // 5.3) Create an unset chosen issuer variable.
      let chosenIssuer;

      // 5.4) For each permutation of blank node list:
      const permuter = new Permuter(hashToRelated.get(hash));
      let i = 0;
      while(permuter.hasNext()) {
        const permutation = permuter.next();
        // Note: batch permutations 3 at a time
        if(++i % 3 === 0) {
          await this._yield();
        }

        // 5.4.1) Create a copy of issuer, issuer copy.
        let issuerCopy = issuer.clone();

        // 5.4.2) Create a string path.
        let path = '';

        // 5.4.3) Create a recursion list, to store blank node identifiers
        // that must be recursively processed by this algorithm.
        const recursionList = [];

        // 5.4.4) For each related in permutation:
        let nextPermutation = false;
        for(const related of permutation) {
          // 5.4.4.1) If a canonical identifier has been issued for
          // related, append it to path.
          if(this.canonicalIssuer.hasId(related)) {
            path += this.canonicalIssuer.getId(related);
          } else {
            // 5.4.4.2) Otherwise:
            // 5.4.4.2.1) If issuer copy has not issued an identifier for
            // related, append related to recursion list.
            if(!issuerCopy.hasId(related)) {
              recursionList.push(related);
            }
            // 5.4.4.2.2) Use the Issue Identifier algorithm, passing
            // issuer copy and related and append the result to path.
            path += issuerCopy.getId(related);
          }

          // 5.4.4.3) If chosen path is not empty and the length of path
          // is greater than or equal to the length of chosen path and
          // path is lexicographically greater than chosen path, then
          // skip to the next permutation.
          // Note: Comparing path length to chosen path length can be optimized
          // away; only compare lexicographically.
          if(chosenPath.length !== 0 && path > chosenPath) {
            nextPermutation = true;
            break;
          }
        }

        if(nextPermutation) {
          continue;
        }

        // 5.4.5) For each related in recursion list:
        for(const related of recursionList) {
          // 5.4.5.1) Set result to the result of recursively executing
          // the Hash N-Degree Quads algorithm, passing related for
          // identifier and issuer copy for path identifier issuer.
          const result = await this.hashNDegreeQuads(related, issuerCopy);

          // 5.4.5.2) Use the Issue Identifier algorithm, passing issuer
          // copy and related and append the result to path.
          path += issuerCopy.getId(related);

          // 5.4.5.3) Append <, the hash in result, and > to path.
          path += `<${result.hash}>`;

          // 5.4.5.4) Set issuer copy to the identifier issuer in
          // result.
          issuerCopy = result.issuer;

          // 5.4.5.5) If chosen path is not empty and the length of path
          // is greater than or equal to the length of chosen path and
          // path is lexicographically greater than chosen path, then
          // skip to the next permutation.
          // Note: Comparing path length to chosen path length can be optimized
          // away; only compare lexicographically.
          if(chosenPath.length !== 0 && path > chosenPath) {
            nextPermutation = true;
            break;
          }
        }

        if(nextPermutation) {
          continue;
        }

        // 5.4.6) If chosen path is empty or path is lexicographically
        // less than chosen path, set chosen path to path and chosen
        // issuer to issuer copy.
        if(chosenPath.length === 0 || path < chosenPath) {
          chosenPath = path;
          chosenIssuer = issuerCopy;
        }
      }

      // 5.5) Append chosen path to data to hash.
      md.update(chosenPath);

      // 5.6) Replace issuer, by reference, with chosen issuer.
      issuer = chosenIssuer;
    }

    // 6) Return issuer and the hash that results from passing data to hash
    // through the hash algorithm.
    return {hash: await md.digest(), issuer};
  }

  // helper for modifying component during Hash First Degree Quads
  modifyFirstDegreeComponent(id, component) {
    if(component.termType !== 'BlankNode') {
      return component;
    }
    /* Note: A mistake in the URDNA2015 spec that made its way into
    implementations (and therefore must stay to avoid interop breakage)
    resulted in an assigned canonical ID, if available for
    `component.value`, not being used in place of `_:a`/`_:z`, so
    we don't use it here. */
    return {
      termType: 'BlankNode',
      value: component.value === id ? '_:a' : '_:z'
    };
  }

  // helper for getting a related predicate
  getRelatedPredicate(quad) {
    return `<${quad.predicate.value}>`;
  }

  // helper for creating hash to related blank nodes map
  async createHashToRelated(id, issuer) {
    // 1) Create a hash to related blank nodes map for storing hashes that
    // identify related blank nodes.
    const hashToRelated = new Map();

    // 2) Get a reference, quads, to the list of quads in the blank node to
    // quads map for the key identifier.
    const quads = this.blankNodeInfo.get(id).quads;

    // 3) For each quad in quads:
    let i = 0;
    for(const quad of quads) {
      // Note: batch hashing related blank node quads 100 at a time
      if(++i % 100 === 0) {
        await this._yield();
      }
      // 3.1) For each component in quad, if component is the subject, object,
      // and graph name and it is a blank node that is not identified by
      // identifier:
      // steps 3.1.1 and 3.1.2 occur in helpers:
      await Promise.all([
        this._addRelatedBlankNodeHash({
          quad, component: quad.subject, position: 's',
          id, issuer, hashToRelated
        }),
        this._addRelatedBlankNodeHash({
          quad, component: quad.object, position: 'o',
          id, issuer, hashToRelated
        }),
        this._addRelatedBlankNodeHash({
          quad, component: quad.graph, position: 'g',
          id, issuer, hashToRelated
        })
      ]);
    }

    return hashToRelated;
  }

  async _hashAndTrackBlankNode({id, hashToBlankNodes}) {
    // 5.3.1) Create a hash, hash, according to the Hash First Degree
    // Quads algorithm.
    const hash = await this.hashFirstDegreeQuads(id);

    // 5.3.2) Add hash and identifier to hash to blank nodes map,
    // creating a new entry if necessary.
    const idList = hashToBlankNodes.get(hash);
    if(!idList) {
      hashToBlankNodes.set(hash, [id]);
    } else {
      idList.push(id);
    }
  }

  _addBlankNodeQuadInfo({quad, component}) {
    if(component.termType !== 'BlankNode') {
      return;
    }
    const id = component.value;
    const info = this.blankNodeInfo.get(id);
    if(info) {
      info.quads.add(quad);
    } else {
      this.blankNodeInfo.set(id, {quads: new Set([quad]), hash: null});
    }
  }

  async _addRelatedBlankNodeHash(
    {quad, component, position, id, issuer, hashToRelated}) {
    if(!(component.termType === 'BlankNode' && component.value !== id)) {
      return;
    }
    // 3.1.1) Set hash to the result of the Hash Related Blank Node
    // algorithm, passing the blank node identifier for component as
    // related, quad, path identifier issuer as issuer, and position as
    // either s, o, or g based on whether component is a subject, object,
    // graph name, respectively.
    const related = component.value;
    const hash = await this.hashRelatedBlankNode(
      related, quad, issuer, position);

    // 3.1.2) Add a mapping of hash to the blank node identifier for
    // component to hash to related blank nodes map, adding an entry as
    // necessary.
    const entries = hashToRelated.get(hash);
    if(entries) {
      entries.push(related);
    } else {
      hashToRelated.set(hash, [related]);
    }
  }

  _useCanonicalId({component}) {
    if(component.termType === 'BlankNode' &&
      !component.value.startsWith(this.canonicalIssuer.prefix)) {
      return {
        termType: 'BlankNode',
        value: this.canonicalIssuer.getId(component.value)
      };
    }
    return component;
  }

  async _yield() {
    return new Promise(resolve => setImmediate(resolve));
  }
};

function _stringHashCompare(a, b) {
  return a.hash < b.hash ? -1 : a.hash > b.hash ? 1 : 0;
}

}).call(this)}).call(this,require("timers").setImmediate)
},{"./IdentifierIssuer":70,"./MessageDigest":71,"./NQuads":72,"./Permuter":73,"timers":90}],75:[function(require,module,exports){
/*
 * Copyright (c) 2016-2021 Digital Bazaar, Inc. All rights reserved.
 */
'use strict';

const IdentifierIssuer = require('./IdentifierIssuer');
const MessageDigest = require('./MessageDigest');
const Permuter = require('./Permuter');
const NQuads = require('./NQuads');

module.exports = class URDNA2015Sync {
  constructor() {
    this.name = 'URDNA2015';
    this.blankNodeInfo = new Map();
    this.canonicalIssuer = new IdentifierIssuer('_:c14n');
    this.hashAlgorithm = 'sha256';
    this.quads = null;
  }

  // 4.4) Normalization Algorithm
  main(dataset) {
    this.quads = dataset;

    // 1) Create the normalization state.
    // 2) For every quad in input dataset:
    for(const quad of dataset) {
      // 2.1) For each blank node that occurs in the quad, add a reference
      // to the quad using the blank node identifier in the blank node to
      // quads map, creating a new entry if necessary.
      this._addBlankNodeQuadInfo({quad, component: quad.subject});
      this._addBlankNodeQuadInfo({quad, component: quad.object});
      this._addBlankNodeQuadInfo({quad, component: quad.graph});
    }

    // 3) Create a list of non-normalized blank node identifiers
    // non-normalized identifiers and populate it using the keys from the
    // blank node to quads map.
    // Note: We use a map here and it was generated during step 2.

    // 4) `simple` flag is skipped -- loop is optimized away. This optimization
    // is permitted because there was a typo in the hash first degree quads
    // algorithm in the URDNA2015 spec that was implemented widely making it
    // such that it could not be fixed; the result was that the loop only
    // needs to be run once and the first degree quad hashes will never change.
    // 5.1-5.2 are skipped; first degree quad hashes are generated just once
    // for all non-normalized blank nodes.

    // 5.3) For each blank node identifier identifier in non-normalized
    // identifiers:
    const hashToBlankNodes = new Map();
    const nonNormalized = [...this.blankNodeInfo.keys()];
    for(const id of nonNormalized) {
      // steps 5.3.1 and 5.3.2:
      this._hashAndTrackBlankNode({id, hashToBlankNodes});
    }

    // 5.4) For each hash to identifier list mapping in hash to blank
    // nodes map, lexicographically-sorted by hash:
    const hashes = [...hashToBlankNodes.keys()].sort();
    // optimize away second sort, gather non-unique hashes in order as we go
    const nonUnique = [];
    for(const hash of hashes) {
      // 5.4.1) If the length of identifier list is greater than 1,
      // continue to the next mapping.
      const idList = hashToBlankNodes.get(hash);
      if(idList.length > 1) {
        nonUnique.push(idList);
        continue;
      }

      // 5.4.2) Use the Issue Identifier algorithm, passing canonical
      // issuer and the single blank node identifier in identifier
      // list, identifier, to issue a canonical replacement identifier
      // for identifier.
      const id = idList[0];
      this.canonicalIssuer.getId(id);

      // Note: These steps are skipped, optimized away since the loop
      // only needs to be run once.
      // 5.4.3) Remove identifier from non-normalized identifiers.
      // 5.4.4) Remove hash from the hash to blank nodes map.
      // 5.4.5) Set simple to true.
    }

    // 6) For each hash to identifier list mapping in hash to blank nodes map,
    // lexicographically-sorted by hash:
    // Note: sort optimized away, use `nonUnique`.
    for(const idList of nonUnique) {
      // 6.1) Create hash path list where each item will be a result of
      // running the Hash N-Degree Quads algorithm.
      const hashPathList = [];

      // 6.2) For each blank node identifier identifier in identifier list:
      for(const id of idList) {
        // 6.2.1) If a canonical identifier has already been issued for
        // identifier, continue to the next identifier.
        if(this.canonicalIssuer.hasId(id)) {
          continue;
        }

        // 6.2.2) Create temporary issuer, an identifier issuer
        // initialized with the prefix _:b.
        const issuer = new IdentifierIssuer('_:b');

        // 6.2.3) Use the Issue Identifier algorithm, passing temporary
        // issuer and identifier, to issue a new temporary blank node
        // identifier for identifier.
        issuer.getId(id);

        // 6.2.4) Run the Hash N-Degree Quads algorithm, passing
        // temporary issuer, and append the result to the hash path list.
        const result = this.hashNDegreeQuads(id, issuer);
        hashPathList.push(result);
      }

      // 6.3) For each result in the hash path list,
      // lexicographically-sorted by the hash in result:
      hashPathList.sort(_stringHashCompare);
      for(const result of hashPathList) {
        // 6.3.1) For each blank node identifier, existing identifier,
        // that was issued a temporary identifier by identifier issuer
        // in result, issue a canonical identifier, in the same order,
        // using the Issue Identifier algorithm, passing canonical
        // issuer and existing identifier.
        const oldIds = result.issuer.getOldIds();
        for(const id of oldIds) {
          this.canonicalIssuer.getId(id);
        }
      }
    }

    /* Note: At this point all blank nodes in the set of RDF quads have been
    assigned canonical identifiers, which have been stored in the canonical
    issuer. Here each quad is updated by assigning each of its blank nodes
    its new identifier. */

    // 7) For each quad, quad, in input dataset:
    const normalized = [];
    for(const quad of this.quads) {
      // 7.1) Create a copy, quad copy, of quad and replace any existing
      // blank node identifiers using the canonical identifiers
      // previously issued by canonical issuer.
      // Note: We optimize with shallow copies here.
      const q = {...quad};
      q.subject = this._useCanonicalId({component: q.subject});
      q.object = this._useCanonicalId({component: q.object});
      q.graph = this._useCanonicalId({component: q.graph});
      // 7.2) Add quad copy to the normalized dataset.
      normalized.push(NQuads.serializeQuad(q));
    }

    // sort normalized output
    normalized.sort();

    // 8) Return the normalized dataset.
    return normalized.join('');
  }

  // 4.6) Hash First Degree Quads
  hashFirstDegreeQuads(id) {
    // 1) Initialize nquads to an empty list. It will be used to store quads in
    // N-Quads format.
    const nquads = [];

    // 2) Get the list of quads `quads` associated with the reference blank node
    // identifier in the blank node to quads map.
    const info = this.blankNodeInfo.get(id);
    const quads = info.quads;

    // 3) For each quad `quad` in `quads`:
    for(const quad of quads) {
      // 3.1) Serialize the quad in N-Quads format with the following special
      // rule:

      // 3.1.1) If any component in quad is an blank node, then serialize it
      // using a special identifier as follows:
      const copy = {
        subject: null, predicate: quad.predicate, object: null, graph: null
      };
      // 3.1.2) If the blank node's existing blank node identifier matches
      // the reference blank node identifier then use the blank node
      // identifier _:a, otherwise, use the blank node identifier _:z.
      copy.subject = this.modifyFirstDegreeComponent(
        id, quad.subject, 'subject');
      copy.object = this.modifyFirstDegreeComponent(
        id, quad.object, 'object');
      copy.graph = this.modifyFirstDegreeComponent(
        id, quad.graph, 'graph');
      nquads.push(NQuads.serializeQuad(copy));
    }

    // 4) Sort nquads in lexicographical order.
    nquads.sort();

    // 5) Return the hash that results from passing the sorted, joined nquads
    // through the hash algorithm.
    const md = new MessageDigest(this.hashAlgorithm);
    for(const nquad of nquads) {
      md.update(nquad);
    }
    info.hash = md.digest();
    return info.hash;
  }

  // 4.7) Hash Related Blank Node
  hashRelatedBlankNode(related, quad, issuer, position) {
    // 1) Set the identifier to use for related, preferring first the canonical
    // identifier for related if issued, second the identifier issued by issuer
    // if issued, and last, if necessary, the result of the Hash First Degree
    // Quads algorithm, passing related.
    let id;
    if(this.canonicalIssuer.hasId(related)) {
      id = this.canonicalIssuer.getId(related);
    } else if(issuer.hasId(related)) {
      id = issuer.getId(related);
    } else {
      id = this.blankNodeInfo.get(related).hash;
    }

    // 2) Initialize a string input to the value of position.
    // Note: We use a hash object instead.
    const md = new MessageDigest(this.hashAlgorithm);
    md.update(position);

    // 3) If position is not g, append <, the value of the predicate in quad,
    // and > to input.
    if(position !== 'g') {
      md.update(this.getRelatedPredicate(quad));
    }

    // 4) Append identifier to input.
    md.update(id);

    // 5) Return the hash that results from passing input through the hash
    // algorithm.
    return md.digest();
  }

  // 4.8) Hash N-Degree Quads
  hashNDegreeQuads(id, issuer) {
    // 1) Create a hash to related blank nodes map for storing hashes that
    // identify related blank nodes.
    // Note: 2) and 3) handled within `createHashToRelated`
    const md = new MessageDigest(this.hashAlgorithm);
    const hashToRelated = this.createHashToRelated(id, issuer);

    // 4) Create an empty string, data to hash.
    // Note: We created a hash object `md` above instead.

    // 5) For each related hash to blank node list mapping in hash to related
    // blank nodes map, sorted lexicographically by related hash:
    const hashes = [...hashToRelated.keys()].sort();
    for(const hash of hashes) {
      // 5.1) Append the related hash to the data to hash.
      md.update(hash);

      // 5.2) Create a string chosen path.
      let chosenPath = '';

      // 5.3) Create an unset chosen issuer variable.
      let chosenIssuer;

      // 5.4) For each permutation of blank node list:
      const permuter = new Permuter(hashToRelated.get(hash));
      while(permuter.hasNext()) {
        const permutation = permuter.next();

        // 5.4.1) Create a copy of issuer, issuer copy.
        let issuerCopy = issuer.clone();

        // 5.4.2) Create a string path.
        let path = '';

        // 5.4.3) Create a recursion list, to store blank node identifiers
        // that must be recursively processed by this algorithm.
        const recursionList = [];

        // 5.4.4) For each related in permutation:
        let nextPermutation = false;
        for(const related of permutation) {
          // 5.4.4.1) If a canonical identifier has been issued for
          // related, append it to path.
          if(this.canonicalIssuer.hasId(related)) {
            path += this.canonicalIssuer.getId(related);
          } else {
            // 5.4.4.2) Otherwise:
            // 5.4.4.2.1) If issuer copy has not issued an identifier for
            // related, append related to recursion list.
            if(!issuerCopy.hasId(related)) {
              recursionList.push(related);
            }
            // 5.4.4.2.2) Use the Issue Identifier algorithm, passing
            // issuer copy and related and append the result to path.
            path += issuerCopy.getId(related);
          }

          // 5.4.4.3) If chosen path is not empty and the length of path
          // is greater than or equal to the length of chosen path and
          // path is lexicographically greater than chosen path, then
          // skip to the next permutation.
          // Note: Comparing path length to chosen path length can be optimized
          // away; only compare lexicographically.
          if(chosenPath.length !== 0 && path > chosenPath) {
            nextPermutation = true;
            break;
          }
        }

        if(nextPermutation) {
          continue;
        }

        // 5.4.5) For each related in recursion list:
        for(const related of recursionList) {
          // 5.4.5.1) Set result to the result of recursively executing
          // the Hash N-Degree Quads algorithm, passing related for
          // identifier and issuer copy for path identifier issuer.
          const result = this.hashNDegreeQuads(related, issuerCopy);

          // 5.4.5.2) Use the Issue Identifier algorithm, passing issuer
          // copy and related and append the result to path.
          path += issuerCopy.getId(related);

          // 5.4.5.3) Append <, the hash in result, and > to path.
          path += `<${result.hash}>`;

          // 5.4.5.4) Set issuer copy to the identifier issuer in
          // result.
          issuerCopy = result.issuer;

          // 5.4.5.5) If chosen path is not empty and the length of path
          // is greater than or equal to the length of chosen path and
          // path is lexicographically greater than chosen path, then
          // skip to the next permutation.
          // Note: Comparing path length to chosen path length can be optimized
          // away; only compare lexicographically.
          if(chosenPath.length !== 0 && path > chosenPath) {
            nextPermutation = true;
            break;
          }
        }

        if(nextPermutation) {
          continue;
        }

        // 5.4.6) If chosen path is empty or path is lexicographically
        // less than chosen path, set chosen path to path and chosen
        // issuer to issuer copy.
        if(chosenPath.length === 0 || path < chosenPath) {
          chosenPath = path;
          chosenIssuer = issuerCopy;
        }
      }

      // 5.5) Append chosen path to data to hash.
      md.update(chosenPath);

      // 5.6) Replace issuer, by reference, with chosen issuer.
      issuer = chosenIssuer;
    }

    // 6) Return issuer and the hash that results from passing data to hash
    // through the hash algorithm.
    return {hash: md.digest(), issuer};
  }

  // helper for modifying component during Hash First Degree Quads
  modifyFirstDegreeComponent(id, component) {
    if(component.termType !== 'BlankNode') {
      return component;
    }
    /* Note: A mistake in the URDNA2015 spec that made its way into
    implementations (and therefore must stay to avoid interop breakage)
    resulted in an assigned canonical ID, if available for
    `component.value`, not being used in place of `_:a`/`_:z`, so
    we don't use it here. */
    return {
      termType: 'BlankNode',
      value: component.value === id ? '_:a' : '_:z'
    };
  }

  // helper for getting a related predicate
  getRelatedPredicate(quad) {
    return `<${quad.predicate.value}>`;
  }

  // helper for creating hash to related blank nodes map
  createHashToRelated(id, issuer) {
    // 1) Create a hash to related blank nodes map for storing hashes that
    // identify related blank nodes.
    const hashToRelated = new Map();

    // 2) Get a reference, quads, to the list of quads in the blank node to
    // quads map for the key identifier.
    const quads = this.blankNodeInfo.get(id).quads;

    // 3) For each quad in quads:
    for(const quad of quads) {
      // 3.1) For each component in quad, if component is the subject, object,
      // or graph name and it is a blank node that is not identified by
      // identifier:
      // steps 3.1.1 and 3.1.2 occur in helpers:
      this._addRelatedBlankNodeHash({
        quad, component: quad.subject, position: 's',
        id, issuer, hashToRelated
      });
      this._addRelatedBlankNodeHash({
        quad, component: quad.object, position: 'o',
        id, issuer, hashToRelated
      });
      this._addRelatedBlankNodeHash({
        quad, component: quad.graph, position: 'g',
        id, issuer, hashToRelated
      });
    }

    return hashToRelated;
  }

  _hashAndTrackBlankNode({id, hashToBlankNodes}) {
    // 5.3.1) Create a hash, hash, according to the Hash First Degree
    // Quads algorithm.
    const hash = this.hashFirstDegreeQuads(id);

    // 5.3.2) Add hash and identifier to hash to blank nodes map,
    // creating a new entry if necessary.
    const idList = hashToBlankNodes.get(hash);
    if(!idList) {
      hashToBlankNodes.set(hash, [id]);
    } else {
      idList.push(id);
    }
  }

  _addBlankNodeQuadInfo({quad, component}) {
    if(component.termType !== 'BlankNode') {
      return;
    }
    const id = component.value;
    const info = this.blankNodeInfo.get(id);
    if(info) {
      info.quads.add(quad);
    } else {
      this.blankNodeInfo.set(id, {quads: new Set([quad]), hash: null});
    }
  }

  _addRelatedBlankNodeHash(
    {quad, component, position, id, issuer, hashToRelated}) {
    if(!(component.termType === 'BlankNode' && component.value !== id)) {
      return;
    }
    // 3.1.1) Set hash to the result of the Hash Related Blank Node
    // algorithm, passing the blank node identifier for component as
    // related, quad, path identifier issuer as issuer, and position as
    // either s, o, or g based on whether component is a subject, object,
    // graph name, respectively.
    const related = component.value;
    const hash = this.hashRelatedBlankNode(related, quad, issuer, position);

    // 3.1.2) Add a mapping of hash to the blank node identifier for
    // component to hash to related blank nodes map, adding an entry as
    // necessary.
    const entries = hashToRelated.get(hash);
    if(entries) {
      entries.push(related);
    } else {
      hashToRelated.set(hash, [related]);
    }
  }

  _useCanonicalId({component}) {
    if(component.termType === 'BlankNode' &&
      !component.value.startsWith(this.canonicalIssuer.prefix)) {
      return {
        termType: 'BlankNode',
        value: this.canonicalIssuer.getId(component.value)
      };
    }
    return component;
  }
};

function _stringHashCompare(a, b) {
  return a.hash < b.hash ? -1 : a.hash > b.hash ? 1 : 0;
}

},{"./IdentifierIssuer":70,"./MessageDigest":71,"./NQuads":72,"./Permuter":73}],76:[function(require,module,exports){
/*
 * Copyright (c) 2016-2021 Digital Bazaar, Inc. All rights reserved.
 */
'use strict';

const URDNA2015 = require('./URDNA2015');

module.exports = class URDNA2012 extends URDNA2015 {
  constructor() {
    super();
    this.name = 'URGNA2012';
    this.hashAlgorithm = 'sha1';
  }

  // helper for modifying component during Hash First Degree Quads
  modifyFirstDegreeComponent(id, component, key) {
    if(component.termType !== 'BlankNode') {
      return component;
    }
    if(key === 'graph') {
      return {
        termType: 'BlankNode',
        value: '_:g'
      };
    }
    return {
      termType: 'BlankNode',
      value: (component.value === id ? '_:a' : '_:z')
    };
  }

  // helper for getting a related predicate
  getRelatedPredicate(quad) {
    return quad.predicate.value;
  }

  // helper for creating hash to related blank nodes map
  async createHashToRelated(id, issuer) {
    // 1) Create a hash to related blank nodes map for storing hashes that
    // identify related blank nodes.
    const hashToRelated = new Map();

    // 2) Get a reference, quads, to the list of quads in the blank node to
    // quads map for the key identifier.
    const quads = this.blankNodeInfo.get(id).quads;

    // 3) For each quad in quads:
    let i = 0;
    for(const quad of quads) {
      // 3.1) If the quad's subject is a blank node that does not match
      // identifier, set hash to the result of the Hash Related Blank Node
      // algorithm, passing the blank node identifier for subject as related,
      // quad, path identifier issuer as issuer, and p as position.
      let position;
      let related;
      if(quad.subject.termType === 'BlankNode' && quad.subject.value !== id) {
        related = quad.subject.value;
        position = 'p';
      } else if(
        quad.object.termType === 'BlankNode' && quad.object.value !== id) {
        // 3.2) Otherwise, if quad's object is a blank node that does not match
        // identifier, to the result of the Hash Related Blank Node algorithm,
        // passing the blank node identifier for object as related, quad, path
        // identifier issuer as issuer, and r as position.
        related = quad.object.value;
        position = 'r';
      } else {
        // 3.3) Otherwise, continue to the next quad.
        continue;
      }
      // Note: batch hashing related blank nodes 100 at a time
      if(++i % 100 === 0) {
        await this._yield();
      }
      // 3.4) Add a mapping of hash to the blank node identifier for the
      // component that matched (subject or object) to hash to related blank
      // nodes map, adding an entry as necessary.
      const hash = await this.hashRelatedBlankNode(
        related, quad, issuer, position);
      const entries = hashToRelated.get(hash);
      if(entries) {
        entries.push(related);
      } else {
        hashToRelated.set(hash, [related]);
      }
    }

    return hashToRelated;
  }
};

},{"./URDNA2015":74}],77:[function(require,module,exports){
/*
 * Copyright (c) 2016-2021 Digital Bazaar, Inc. All rights reserved.
 */
'use strict';

const URDNA2015Sync = require('./URDNA2015Sync');

module.exports = class URDNA2012Sync extends URDNA2015Sync {
  constructor() {
    super();
    this.name = 'URGNA2012';
    this.hashAlgorithm = 'sha1';
  }

  // helper for modifying component during Hash First Degree Quads
  modifyFirstDegreeComponent(id, component, key) {
    if(component.termType !== 'BlankNode') {
      return component;
    }
    if(key === 'graph') {
      return {
        termType: 'BlankNode',
        value: '_:g'
      };
    }
    return {
      termType: 'BlankNode',
      value: (component.value === id ? '_:a' : '_:z')
    };
  }

  // helper for getting a related predicate
  getRelatedPredicate(quad) {
    return quad.predicate.value;
  }

  // helper for creating hash to related blank nodes map
  createHashToRelated(id, issuer) {
    // 1) Create a hash to related blank nodes map for storing hashes that
    // identify related blank nodes.
    const hashToRelated = new Map();

    // 2) Get a reference, quads, to the list of quads in the blank node to
    // quads map for the key identifier.
    const quads = this.blankNodeInfo.get(id).quads;

    // 3) For each quad in quads:
    for(const quad of quads) {
      // 3.1) If the quad's subject is a blank node that does not match
      // identifier, set hash to the result of the Hash Related Blank Node
      // algorithm, passing the blank node identifier for subject as related,
      // quad, path identifier issuer as issuer, and p as position.
      let position;
      let related;
      if(quad.subject.termType === 'BlankNode' && quad.subject.value !== id) {
        related = quad.subject.value;
        position = 'p';
      } else if(
        quad.object.termType === 'BlankNode' && quad.object.value !== id) {
        // 3.2) Otherwise, if quad's object is a blank node that does not match
        // identifier, to the result of the Hash Related Blank Node algorithm,
        // passing the blank node identifier for object as related, quad, path
        // identifier issuer as issuer, and r as position.
        related = quad.object.value;
        position = 'r';
      } else {
        // 3.3) Otherwise, continue to the next quad.
        continue;
      }
      // 3.4) Add a mapping of hash to the blank node identifier for the
      // component that matched (subject or object) to hash to related blank
      // nodes map, adding an entry as necessary.
      const hash = this.hashRelatedBlankNode(related, quad, issuer, position);
      const entries = hashToRelated.get(hash);
      if(entries) {
        entries.push(related);
      } else {
        hashToRelated.set(hash, [related]);
      }
    }

    return hashToRelated;
  }
};

},{"./URDNA2015Sync":75}],78:[function(require,module,exports){
/**
 * An implementation of the RDF Dataset Normalization specification.
 * This library works in the browser and node.js.
 *
 * BSD 3-Clause License
 * Copyright (c) 2016-2021 Digital Bazaar, Inc.
 * All rights reserved.
 *
 * Redistribution and use in source and binary forms, with or without
 * modification, are permitted provided that the following conditions are met:
 *
 * Redistributions of source code must retain the above copyright notice,
 * this list of conditions and the following disclaimer.
 *
 * Redistributions in binary form must reproduce the above copyright
 * notice, this list of conditions and the following disclaimer in the
 * documentation and/or other materials provided with the distribution.
 *
 * Neither the name of the Digital Bazaar, Inc. nor the names of its
 * contributors may be used to endorse or promote products derived from
 * this software without specific prior written permission.
 *
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS
 * IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED
 * TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A
 * PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT
 * HOLDER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL,
 * SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED
 * TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR
 * PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF
 * LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING
 * NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS
 * SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 */
'use strict';

const URDNA2015 = require('./URDNA2015');
const URGNA2012 = require('./URGNA2012');
const URDNA2015Sync = require('./URDNA2015Sync');
const URGNA2012Sync = require('./URGNA2012Sync');

// optional native support
let rdfCanonizeNative;
try {
  rdfCanonizeNative = require('rdf-canonize-native');
} catch(e) {}

const api = {};
module.exports = api;

// expose helpers
api.NQuads = require('./NQuads');
api.IdentifierIssuer = require('./IdentifierIssuer');

/**
 * Get or set native API.
 *
 * @param api the native API.
 *
 * @return the currently set native API.
 */
api._rdfCanonizeNative = function(api) {
  if(api) {
    rdfCanonizeNative = api;
  }
  return rdfCanonizeNative;
};

/**
 * Asynchronously canonizes an RDF dataset.
 *
 * @param dataset the dataset to canonize.
 * @param options the options to use:
 *          algorithm the canonicalization algorithm to use, `URDNA2015` or
 *            `URGNA2012`.
 *          [useNative] use native implementation (default: false).
 *
 * @return a Promise that resolves to the canonicalized RDF Dataset.
 */
api.canonize = async function(dataset, options) {
  // back-compat with legacy dataset
  if(!Array.isArray(dataset)) {
    dataset = api.NQuads.legacyDatasetToQuads(dataset);
  }

  if(options.useNative) {
    if(!rdfCanonizeNative) {
      throw new Error('rdf-canonize-native not available');
    }
    // TODO: convert native algorithm to Promise-based async
    return new Promise((resolve, reject) =>
      rdfCanonizeNative.canonize(dataset, options, (err, canonical) =>
        err ? reject(err) : resolve(canonical)));
  }

  if(options.algorithm === 'URDNA2015') {
    return new URDNA2015(options).main(dataset);
  }
  if(options.algorithm === 'URGNA2012') {
    return new URGNA2012(options).main(dataset);
  }
  if(!('algorithm' in options)) {
    throw new Error('No RDF Dataset Canonicalization algorithm specified.');
  }
  throw new Error(
    'Invalid RDF Dataset Canonicalization algorithm: ' + options.algorithm);
};

/**
 * This method is no longer available in the public API, it is for testing
 * only. It synchronously canonizes an RDF dataset and does not work in the
 * browser.
 *
 * @param dataset the dataset to canonize.
 * @param options the options to use:
 *          algorithm the canonicalization algorithm to use, `URDNA2015` or
 *            `URGNA2012`.
 *          [useNative] use native implementation (default: false).
 *
 * @return the RDF dataset in canonical form.
 */
api._canonizeSync = function(dataset, options) {
  // back-compat with legacy dataset
  if(!Array.isArray(dataset)) {
    dataset = api.NQuads.legacyDatasetToQuads(dataset);
  }

  if(options.useNative) {
    if(rdfCanonizeNative) {
      return rdfCanonizeNative.canonizeSync(dataset, options);
    }
    throw new Error('rdf-canonize-native not available');
  }
  if(options.algorithm === 'URDNA2015') {
    return new URDNA2015Sync(options).main(dataset);
  }
  if(options.algorithm === 'URGNA2012') {
    return new URGNA2012Sync(options).main(dataset);
  }
  if(!('algorithm' in options)) {
    throw new Error('No RDF Dataset Canonicalization algorithm specified.');
  }
  throw new Error(
    'Invalid RDF Dataset Canonicalization algorithm: ' + options.algorithm);
};

},{"./IdentifierIssuer":70,"./NQuads":72,"./URDNA2015":74,"./URDNA2015Sync":75,"./URGNA2012":76,"./URGNA2012Sync":77,"rdf-canonize-native":30}],79:[function(require,module,exports){
// the functions for a class Object
const Term = require("./Term");

/**
 * @typedef filterObject
 * @type {object}
 * @property {boolean} [isSuperseded] - defines the superseded status for the filter (true: only terms that are superseded, false: only terms that are NOT superseded)
 * @property {string|string[]} [fromVocabulary] - defines a set of allowed vocabularies for the filter - vocabularies are given as indicators (e.g. "schema")
 * @property {string|string[]} [termType] - defines a set of allowed term types for the filter (e.g. "Class", "Property")
 */

class Class extends Term {
  /**
   * A Class represents an rdfs:Class. It is identified by its IRI
   *
   * @class
   * @param {string} IRI - The compacted IRI of this Class, e.g. "schema:Book"
   * @param {Graph} graph - The underlying data graph to enable the methods of this Class
   */
  constructor(IRI, graph) {
    super(IRI, graph);
  }

  /**
   * Retrieves the term type (@type) of this Class (is always "rdfs:Class")
   *
   * @returns {string} The term type of this Class -> "rdfs:Class"
   */
  getTermType() {
    return "rdfs:Class";
  }

  /**
   * Retrieves the term object of this Class
   *
   * @returns {string} The term object of this Class
   */
  getTermObj() {
    return this.graph.classes[this.IRI];
  }

  /**
   * Retrieves the explicit/implicit properties (soa:hasProperty) of this Class
   *
   * @param {boolean} [implicit = true] - retrieves also implicit properties (inheritance from super-classes) - (default = true)
   * @param {filterObject} [filter] - (optional) The filter settings to be applied on the result
   * @returns {string[]} The properties of this Class
   */
  getProperties(implicit = true, filter = undefined) {
    const classObj = this.getTermObj();
    const result = [];
    result.push(...classObj["soa:hasProperty"]);
    if (implicit) {
      // add properties from super-classes
      result.push(
        ...this.graph.reasoner.inferPropertiesFromSuperClasses(
          classObj["rdfs:subClassOf"]
        )
      );
    }
    return this.util.applyFilter(
      this.util.uniquifyArray(result),
      filter,
      this.graph
    );
  }

  /**
   * Retrieves the explicit/implicit super-classes (rdfs:subClassOf) of this Class
   *
   * @param {boolean} [implicit = true] - retrieves also implicit super-classes (recursive from super-classes) - (default = true)
   * @param {filterObject} [filter] - (optional) The filter settings to be applied on the result
   * @returns {string[]} The super-classes of this Class
   */
  getSuperClasses(implicit = true, filter = undefined) {
    const classObj = this.getTermObj();
    const result = [];
    if (implicit) {
      result.push(...this.graph.reasoner.inferSuperClasses(this.IRI));
    } else {
      result.push(...classObj["rdfs:subClassOf"]);
    }
    return this.util.applyFilter(
      this.util.uniquifyArray(result),
      filter,
      this.graph
    );
  }

  /**
   * Retrieves the explicit/implicit sub-classes (soa:superClassOf) of this Class
   *
   * @param {boolean} [implicit = true] - retrieves also implicit sub-classes (recursive from sub-classes) - (default = true)
   * @param {filterObject} [filter] - (optional) The filter settings to be applied on the result
   * @returns {string[]} The sub-classes of this Class
   */
  getSubClasses(implicit = true, filter = undefined) {
    const classObj = this.getTermObj();
    const result = [];
    if (implicit) {
      result.push(...this.graph.reasoner.inferSubClasses(this.IRI));
    } else {
      result.push(...classObj["soa:superClassOf"]);
    }
    return this.util.applyFilter(
      this.util.uniquifyArray(result),
      filter,
      this.graph
    );
  }

  /**
   * Retrieves the properties that have this Class as a range
   *
   * @param {boolean} [implicit = true] - includes also implicit data - (default = true)
   * @param {filterObject} [filter] - (optional) The filter settings to be applied on the result
   * @returns {string[]} The properties that have this Class as a range
   */
  isRangeOf(implicit = true, filter = undefined) {
    const result = [];
    if (implicit) {
      result.push(...this.graph.reasoner.inferRangeOf(this.IRI));
    } else {
      result.push(...this.getTermObj()["soa:isRangeOf"]);
    }
    return this.util.applyFilter(
      this.util.uniquifyArray(result),
      filter,
      this.graph
    );
  }

  /**
   * Generates an explicit/implicit JSON representation of this Class.
   *
   * @param {boolean} [implicit = true] - includes also implicit data (e.g. sub-Classes, super-Classes, properties, etc.) - (default = true)
   * @param {filterObject} [filter] - (optional) The filter settings to be applied on the result
   * @returns {object} The JSON representation of this Class
   */
  toJSON(implicit = true, filter = undefined) {
    // (implicit === true) ->
    // properties of all parent classes
    // sub-classes and their subclasses
    // super-classes and their superclasses
    const result = super.toJSON();
    result.superClasses = this.getSuperClasses(implicit, filter);
    result.subClasses = this.getSubClasses(implicit, filter);
    result.properties = this.getProperties(implicit, filter);
    result.rangeOf = this.isRangeOf(implicit, filter);
    return result;
  }
}

module.exports = Class;

},{"./Term":87}],80:[function(require,module,exports){
// the functions for a data type Object
const Term = require("./Term");

/**
 * @typedef filterObject
 * @type {object}
 * @property {boolean} [isSuperseded] - defines the superseded status for the filter (true: only terms that are superseded, false: only terms that are NOT superseded)
 * @property {string|string[]} [fromVocabulary] - defines a set of allowed vocabularies for the filter - vocabularies are given as indicators (e.g. "schema")
 * @property {string|string[]} [termType] - defines a set of allowed term types for the filter (e.g. "Class", "Property")
 */

class DataType extends Term {
  /**
   * A DataType represents an schema:DataType. It is identified by its IRI
   *
   * @class
   * @param {string} IRI - The compacted IRI of this DataType, e.g. "schema:Number"
   * @param {Graph} graph - The underlying data graph to enable the methods of this DataType
   */
  constructor(IRI, graph) {
    super(IRI, graph);
  }

  /**
   * Retrieves the term type (@type) of this DataType (is always "schema:DataType")
   *
   * @returns {string} The term type of this DataType -> "schema:DataType"
   */
  getTermType() {
    return "schema:DataType";
  }

  /**
   * Retrieves the term object of this DataType
   *
   * @returns {string} The term object of this DataType
   */
  getTermObj() {
    return this.graph.dataTypes[this.IRI];
  }

  /**
   * Retrieves the explicit/implicit super-DataTypes (rdfs:subClassOf) of this DataType
   *
   * @param {boolean} [implicit = true] - retrieves also implicit super-DataTypes (recursive from super-DataTypes) - (default = true)
   * @param {filterObject} [filter] - (optional) The filter settings to be applied on the result
   * @returns {string[]} The super-DataTypes of this DataType
   */
  getSuperDataTypes(implicit = true, filter = undefined) {
    const dataTypeObj = this.getTermObj();
    const result = [];
    if (implicit) {
      result.push(...this.graph.reasoner.inferSuperDataTypes(this.IRI));
    } else {
      result.push(...dataTypeObj["rdfs:subClassOf"]);
    }
    return this.util.applyFilter(
      this.util.uniquifyArray(result),
      filter,
      this.graph
    );
  }

  /**
   * Retrieves the explicit/implicit sub-DataTypes (soa:superClassOf) of this DataType
   *
   * @param {boolean} [implicit = true] - retrieves also implicit sub-DataTypes (recursive from sub-DataTypes) - (default = true)
   * @param {filterObject} [filter] - (optional) The filter settings to be applied on the result
   * @returns {string[]} The sub-DataTypes of this DataType
   */
  getSubDataTypes(implicit = true, filter = undefined) {
    const dataTypeObj = this.getTermObj();
    const result = [];
    if (implicit) {
      result.push(...this.graph.reasoner.inferSubDataTypes(this.IRI));
    } else {
      result.push(...dataTypeObj["soa:superClassOf"]);
    }
    return this.util.applyFilter(
      this.util.uniquifyArray(result),
      filter,
      this.graph
    );
  }

  /**
   * Retrieves the properties that have this DataType as a range
   *
   * @param {boolean} [implicit = true] - includes also implicit data - (default = true)
   * @param {filterObject} [filter] - (optional) The filter settings to be applied on the result
   * @returns {string[]} The properties that have this DataType as a range
   */
  isRangeOf(implicit = true, filter = undefined) {
    const result = [];
    if (implicit) {
      result.push(...this.graph.reasoner.inferRangeOf(this.IRI));
    } else {
      result.push(...this.getTermObj()["soa:isRangeOf"]);
    }
    return this.util.applyFilter(
      this.util.uniquifyArray(result),
      filter,
      this.graph
    );
  }

  /**
   * Generates an explicit/implicit JSON representation of this DataType.
   *
   * @param {boolean} [implicit = true]  - includes also implicit data (e.g. sub-DataTypes, super-DataTypes) - (default = true)
   * @param {filterObject} [filter] - (optional) The filter settings to be applied on the result
   * @returns {object} The JSON representation of this DataType
   */
  toJSON(implicit = true, filter = undefined) {
    const result = super.toJSON();
    result.superDataTypes = this.getSuperDataTypes(implicit, filter);
    result.subDataTypes = this.getSubDataTypes(implicit, filter);
    result.rangeOf = this.isRangeOf(implicit, filter);
    return result;
  }
}

module.exports = DataType;

},{"./Term":87}],81:[function(require,module,exports){
// the functions for a enumeration Object
const Class = require("./Class");

/**
 * @typedef filterObject
 * @type {object}
 * @property {boolean} [isSuperseded] - defines the superseded status for the filter (true: only terms that are superseded, false: only terms that are NOT superseded)
 * @property {string|string[]} [fromVocabulary] - defines a set of allowed vocabularies for the filter - vocabularies are given as indicators (e.g. "schema")
 * @property {string|string[]} [termType] - defines a set of allowed term types for the filter (e.g. "Class", "Property")
 */

class Enumeration extends Class {
  /**
   * An Enumeration represents a schema:Enumeration, which is also a sub-type of an rdfs:Class. It is identified by its IRI
   *
   * @class
   * @param {string} IRI - The compacted IRI of this Enumeration, e.g. "schema:DayOfWeek"
   * @param {Graph} graph - The underlying data graph to enable the methods of this Enumeration
   */
  constructor(IRI, graph) {
    super(IRI, graph);
  }

  /**
   * Retrieves the term type (@type) of this Enumeration (is always "schema:Enumeration")
   *
   * @returns {string} The term type of this Enumeration -> "schema:Enumeration"
   */
  getTermType() {
    return "schema:Enumeration";
  }

  /**
   * Retrieves the term object of this Enumeration
   *
   * @returns {string} The term object of this Enumeration
   */
  getTermObj() {
    return this.graph.enumerations[this.IRI];
  }

  /**
   * Retrieves the enumeration members (soa:hasEnumerationMember) of this Enumeration
   *
   * @param {boolean} [implicit = true] - retrieves also implicit enumeration members (inheritance from sub-enumerations) - (default = false)
   * @param {filterObject} [filter] - (optional) The filter settings to be applied on the result
   * @returns {string[]} The enumeration members of this Enumeration
   */
  getEnumerationMembers(implicit = false, filter = undefined) {
    const result = [];
    result.push(...this.getTermObj()["soa:hasEnumerationMember"]);
    if (implicit) {
      const subClasses = this.getSubClasses(true);
      for (const actSubClass of subClasses) {
        const actualEnumeration = this.graph.enumerations[actSubClass];
        if (!this.util.isNil(actualEnumeration)) {
          result.push(...actualEnumeration["soa:hasEnumerationMember"]);
        }
      }
    }
    return this.util.applyFilter(
      this.util.uniquifyArray(result),
      filter,
      this.graph
    );
  }

  /**
   * Generates an explicit/implicit JSON representation of this Enumeration
   *
   * @param {boolean} [implicit = true] - includes also implicit data - (default = true)
   * @param {filterObject} [filter] - (optional) The filter settings to be applied on the result
   * @returns {object} The JSON representation of this Enumeration
   */
  toJSON(implicit = true, filter = undefined) {
    const result = super.toJSON(implicit, filter);
    result.enumerationMembers = this.getEnumerationMembers(implicit, filter);
    return result;
  }
}

module.exports = Enumeration;

},{"./Class":79}],82:[function(require,module,exports){
// the functions for a enumeration member Object
const Term = require("./Term");

/**
 * @typedef filterObject
 * @type {object}
 * @property {boolean} [isSuperseded] - defines the superseded status for the filter (true: only terms that are superseded, false: only terms that are NOT superseded)
 * @property {string|string[]} [fromVocabulary] - defines a set of allowed vocabularies for the filter - vocabularies are given as indicators (e.g. "schema")
 * @property {string|string[]} [termType] - defines a set of allowed term types for the filter (e.g. "Class", "Property")
 */

class EnumerationMember extends Term {
  /**
   * An EnumerationMember represents a possible value for a schema:Enumeration. It is identified by its IRI
   *
   * @class
   * @param {string} IRI - The compacted IRI of this EnumerationMember, e.g. "schema:Friday"
   * @param {Graph} graph - The underlying data graph to enable the methods of this EnumerationMember
   */
  constructor(IRI, graph) {
    super(IRI, graph);
  }

  /**
   * Retrieves the term type (@type) of this EnumerationMember (is always "schema:Enumeration")
   *
   * @returns {string} The term type of this EnumerationMember -> "soa:EnumerationMember" //there is no explicit type for enumeration members in the Schema.org Meta, so we use our own definition
   */
  getTermType() {
    return "soa:EnumerationMember";
  }

  /**
   * Retrieves the term object of this Enumeration Member
   *
   * @returns {string} The term object of this Enumeration Member
   */
  getTermObj() {
    return this.graph.enumerationMembers[this.IRI];
  }

  /**
   * Retrieves the domain enumerations (soa:enumerationDomainIncludes) of this EnumerationMember
   *
   * @param {boolean} [implicit = true] - retrieves also implicit domain enumerations (inheritance from super-enumerations) - (default = false)
   * @param {filterObject} [filter] - (optional) The filter settings to be applied on the result
   * @returns {string[]} The domain enumerations of this EnumerationMember
   */
  getDomainEnumerations(implicit = false, filter = undefined) {
    let enumObj = this.getTermObj();
    let result = [];
    result.push(...enumObj["soa:enumerationDomainIncludes"]);
    if (implicit) {
      let domainEnumerationsToCheck = this.util.copByVal(result);
      for (const actDE of domainEnumerationsToCheck) {
        result.push(...this.graph.reasoner.inferSuperClasses(actDE));
      }
      result = this.util.applyFilter(
        this.util.uniquifyArray(result),
        { termType: "Enumeration" },
        this.graph
      );
    }
    return this.util.applyFilter(
      this.util.uniquifyArray(result),
      filter,
      this.graph
    );
  }

  /**
   * Generates a JSON representation of this EnumerationMember
   *
   * @param {boolean} [implicit = true] - includes also implicit data - (default = false)
   * @param {filterObject} [filter] - (optional) The filter settings to be applied on the result
   * @returns {object} The JSON representation of this EnumerationMember
   */
  toJSON(implicit = false, filter = undefined) {
    const result = super.toJSON();
    result["domainEnumerations"] = this.getDomainEnumerations(implicit, filter);
    return result;
  }
}

module.exports = EnumerationMember;

},{"./Term":87}],83:[function(require,module,exports){
const Class = require("./Class");
const Property = require("./Property");
const Enumeration = require("./Enumeration");
const EnumerationMember = require("./EnumerationMember");
const DataType = require("./DataType");
const ReasoningEngine = require("./ReasoningEngine");

/**
 * @typedef filterObject
 * @type {object}
 * @property {boolean} [isSuperseded] - defines the superseded status for the filter (true: only terms that are superseded, false: only terms that are NOT superseded)
 * @property {string|string[]} [fromVocabulary] - defines a set of allowed vocabularies for the filter - vocabularies are given as indicators (e.g. "schema")
 * @property {string|string[]} [termType] - defines a set of allowed term types for the filter (e.g. "Class", "Property")
 */

class Graph {
  /**
   * @class
   * @param {any} sdoAdapter - The parent sdoAdapter-class to which this Graph belongs
   */
  constructor(sdoAdapter) {
    this.sdoAdapter = sdoAdapter;
    this.util = require("./utilities");
    this.reasoner = new ReasoningEngine(this);
    // Simply speaking, a context is used to map terms to IRIs. Terms are case sensitive and any valid string that is not a reserved JSON-LD keyword can be used as a term.
    // soa:superClassOf is an inverse of rdfs:subClassOf that should help us
    // soa:superPropertyOf is an inverse of rdfs:subPropertyOf that should help us
    // soa:hasProperty is an inverse of schema:domainIncludes
    // soa:isRangeOf is an inverse of schema:rangeIncludes
    // soa:hasEnumerationMember is used for enumerations to list all its enumeration members (their @type includes the @id of the enumeration)
    // soa:enumerationDomainIncludes is an inverse of soa:hasEnumerationMember
    // soa:EnumerationMember is introduced as meta type for the members of an schema:Enumeration
    this.context = {
      rdf: "http://www.w3.org/1999/02/22-rdf-syntax-ns#",
      rdfs: "http://www.w3.org/2000/01/rdf-schema#",
      xsd: "http://www.w3.org/2001/XMLSchema#",
      dc: "http://purl.org/dc/terms/",
      // schema: 'http://schema.org/', this entry will be generated the first time a vocabulary is added to the graph
      soa: "http://schema-org-adapter.at/vocabTerms/",
      "soa:superClassOf": {
        "@id": "soa:superClassOf",
        "@type": "@id",
      },
      "soa:superPropertyOf": {
        "@id": "soa:superPropertyOf",
        "@type": "@id",
      },
      "soa:hasProperty": {
        "@id": "soa:hasProperty",
        "@type": "@id",
      },
      "soa:isRangeOf": {
        "@id": "soa:isRangeOf",
        "@type": "@id",
      },
      "soa:hasEnumerationMember": {
        "@id": "soa:hasEnumerationMember",
        "@type": "@id",
      },
      "soa:enumerationDomainIncludes": {
        "@id": "soa:enumerationDomainIncludes",
        "@type": "@id",
      },
      "rdfs:subClassOf": {
        "@id": "rdfs:subClassOf",
        "@type": "@id",
      },
      "rdfs:subPropertyOf": {
        "@id": "rdfs:subPropertyOf",
        "@type": "@id",
      },
      "schema:isPartOf": {
        "@id": "schema:isPartOf",
        "@type": "@id",
      },
      "schema:domainIncludes": {
        "@id": "schema:domainIncludes",
        "@type": "@id",
      },
      "schema:rangeIncludes": {
        "@id": "schema:rangeIncludes",
        "@type": "@id",
      },
      "schema:supersededBy": {
        "@id": "schema:supersededBy",
        "@type": "@id",
      },
      "schema:inverseOf": {
        "@id": "schema:inverseOf",
        "@type": "@id",
      },
      "dc:source": {
        "@id": "dc:source",
        "@type": "@id",
      },
      "schema:source": {
        "@id": "schema:source",
        "@type": "@id",
      },
    };
    this.classes = {}; // keys are the compacted IRI
    this.properties = {}; // keys are the compacted IRI
    this.dataTypes = {}; // keys are the compacted IRI
    this.enumerations = {}; // keys are the compacted IRI
    this.enumerationMembers = {}; // keys are the compacted IRI
  }

  /**
   * Adds a new vocabulary (in JSON-LD format) to the graph data
   *
   * @param {object} vocab - The vocabulary to add the graph, in JSON-LD format
   * @param {?string} vocabURL - The URL of the vocabulary
   * @returns {Promise<boolean>} returns true on success
   */
  async addVocabulary(vocab, vocabURL = null) {
    // check which protocol version of schema.org is used in the first vocabulary given to the graph, set that version as the namespace for "schema" in the standard @context
    if (this.context.schema === undefined) {
      this.context.schema =
        this.util.discoverUsedSchemaOrgProtocol(vocab) + "://schema.org/";
    }
    // this algorithm is well-documented in /docu/algorithm.md
    try {
      // A) Pre-process Vocabulary
      // New: In the following any added vocabularies are slightly changed, if the "equateVocabularyProtocols" option is used and the vocabulary includes namespaces that meet the requirements
      if (this.sdoAdapter.equateVocabularyProtocols) {
        // 1. Check if any namespaces from this.context are used in vocab (context and content) with another protocol (http/https). Create a List of those
        const equateNamespaces = this.util.discoverEquateNamespaces(
          this.context,
          vocab
        );
        // 2. If the List is not empty, then the vocab needs to be adapted
        if (equateNamespaces.length > 0) {
          //  - Create adapted context for vocab, which includes IRIs from vocab context + IRIs from the List, use vocab indicators from this.context
          let adaptedContext = this.util.copByVal(vocab["@context"]);
          equateNamespaces.forEach(function (ens) {
            let usedKeyToDelete = Object.keys(adaptedContext).find(
              (el) => adaptedContext[el] === ens
            );
            if (usedKeyToDelete) {
              delete adaptedContext[usedKeyToDelete];
            }
            let keyToUse = Object.keys(this.context).find(
              (el) => this.context[el] === this.util.switchIRIProtocol(ens)
            );
            adaptedContext[keyToUse] = ens;
          }, this);
          //  - jsonld compact vocab with adapted context
          vocab = await this.util.preProcessVocab(vocab, adaptedContext);
          //  - manually change entries of compacted vocab context, so that they use the same protocol as in this.context (the vocab indicators should already be the same)
          equateNamespaces.forEach(function (ens) {
            let keyToUse = Object.keys(this.context).find(
              (el) => this.context[el] === this.util.switchIRIProtocol(ens)
            );
            vocab["@context"][keyToUse] = this.context[keyToUse];
          }, this);
        }
      }
      // create new context
      this.context = this.util.generateContext(this.context, vocab["@context"]);
      // pre-process new vocab
      vocab = await this.util.preProcessVocab(vocab, this.context); // adapt @graph to new context
      const vocabularies = this.sdoAdapter.getVocabularies();
      for (let vocabNode of vocab["@graph"]) {
        vocabNode = this.util.curateVocabNode(vocabNode, vocabularies); // curate nodes
      }
      // B) Classify Input
      /**
       Classify every @graph node based on its @type. The node is transformed to another data-model based on the @type and stored in a new memory storage for an easier further usage. This is the first of two steps for an exact classification of the node, since the @type is not enough for a correct classification. The mapping of our data model and the @type(s) of the corresponding @graph nodes are as follows:
       classes ("@type" = "rdfs:Class")
       properties ("@type" = "rdf:Property")
       dataTypes ("@type" = "rdfs:Class" + "schema:DataType")
       enumerations ("@type" = "rdfs:Class", has "schema:Enumeration" as implicit super-class)
       enumerationMembers ("@type" = @id(s) of enumeration(s))
       */
      for (let i = 0; i < vocab["@graph"].length; i++) {
        const curNode = this.util.copByVal(vocab["@graph"][i]);
        if (this.util.isString(curNode["@type"])) {
          switch (curNode["@type"]) {
            case "rdfs:Class":
              this.addGraphNode(this.classes, curNode, vocabURL);
              break;
            case "rdf:Property":
              this.addGraphNode(this.properties, curNode, vocabURL);
              break;
            default:
              // @type is not something expected -> assume enumerationMember
              this.addGraphNode(this.enumerationMembers, curNode, vocabURL);
              break;
          }
        } else if (this.util.isArray(curNode["@type"])) {
          // @type is not a string -> datatype or enumeration
          // [
          //     "rdfs:Class",
          //     "schema:DataType"
          // ]
          // [
          //   "schema:MedicalImagingTechnique",
          //   "schema:MedicalSpecialty"
          // ]
          if (
            curNode["@type"].includes("rdfs:Class") &&
            curNode["@type"].includes("schema:DataType")
          ) {
            // datatype
            this.addGraphNode(this.dataTypes, curNode, vocabURL);
          } else {
            // enumeration member
            this.addGraphNode(this.enumerationMembers, curNode, vocabURL);
          }
        } else {
          this.sdoAdapter.onError(
            "unexpected @type format for the following node: " +
              JSON.stringify(curNode, null, 2)
          );
        }
      }
      // C) Classification cleaning
      /* To have a correct classification for our data model it is needed to clean the data generated in the previous step. Inaccurate records include:
                         Enumerations which are handled as Classes.
                         DataTypes which are handled as Classes.
                         */

      // C.1)  Extract enumerations from classes memory
      // For each entry in the classes memory check if its superClasses contain Enumeration or another Enumeration. If this is the case, it is known that this class is an enumeration.
      let newEnum;
      do {
        newEnum = false;
        const classesKeys = Object.keys(this.classes);
        const enumKeys = Object.keys(this.enumerations);
        for (const actClassKey of classesKeys) {
          if (this.classes[actClassKey]["rdfs:subClassOf"] !== undefined) {
            const subClassArray = this.classes[actClassKey]["rdfs:subClassOf"];
            for (const actSubClass of subClassArray) {
              if (
                actSubClass === "schema:Enumeration" ||
                enumKeys.includes(actSubClass)
              ) {
                if (
                  this.classes[actClassKey] &&
                  !this.enumerations[actClassKey]
                ) {
                  newEnum = true;
                  this.enumerations[actClassKey] = this.util.copByVal(
                    this.classes[actClassKey]
                  );
                  delete this.classes[actClassKey];
                }
              }
            }
          }
        }
      } while (newEnum);
      // C.2) check if there are subclasses of dataTypes which are in the classes data, put them in dataType data
      let newDatatype;
      do {
        newDatatype = false;
        const classesKeys = Object.keys(this.classes);
        const dtKeys = Object.keys(this.dataTypes);
        for (const actClassKey of classesKeys) {
          if (this.classes[actClassKey]["rdfs:subClassOf"] !== undefined) {
            const subClassArray = this.classes[actClassKey]["rdfs:subClassOf"];
            for (const actSubClass of subClassArray) {
              if (
                actSubClass === "schema:DataType" ||
                dtKeys.includes(actSubClass)
              ) {
                if (this.classes[actClassKey] && !this.dataTypes[actClassKey]) {
                  newDatatype = true;
                  this.dataTypes[actClassKey] = this.util.copByVal(
                    this.classes[actClassKey]
                  );
                  delete this.classes[actClassKey];
                }
              }
            }
          }
        }
      } while (newDatatype);
      // C.3) change the @type of data-types to a single value, which is "schema:DataType"
      const dtKeys = Object.keys(this.dataTypes);
      for (const actDtKey of dtKeys) {
        this.dataTypes[actDtKey]["@type"] = "schema:DataType";
      }

      // D) Inheritance
      /*    Schema.org's Inheritance design states if an entity is the superClass/superProperty of another entity. In our data model design we also hold the information if an entity is the subClass/subProperty of another entity. In this step this inheritance information is generated. */
      // D.1) Add subClasses for Classes and Enumerations
      // check superclasses for all classes and enumerations. Add these classes/enumerations as subclasses (soa:superClassOf) for the parent class/enumeration
      let classesKeys = Object.keys(this.classes);
      for (const actClassKey of classesKeys) {
        const superClasses = this.classes[actClassKey]["rdfs:subClassOf"];
        // add empty superClassOf if not defined
        if (!this.classes[actClassKey]["soa:superClassOf"]) {
          this.classes[actClassKey]["soa:superClassOf"] = [];
        }
        for (const actSuperClass of superClasses) {
          let superClass = this.classes[actSuperClass];
          if (!superClass) {
            superClass = this.enumerations[actSuperClass];
          }
          if (superClass) {
            if (superClass["soa:superClassOf"]) {
              if (!superClass["soa:superClassOf"].includes(actClassKey)) {
                superClass["soa:superClassOf"].push(actClassKey);
              }
            } else {
              superClass["soa:superClassOf"] = [actClassKey];
            }
          }
        }
      }
      let enumKeys = Object.keys(this.enumerations);
      for (const actEnumKey of enumKeys) {
        const superClasses = this.enumerations[actEnumKey]["rdfs:subClassOf"];
        // add empty superClassOf if not defined
        if (!this.enumerations[actEnumKey]["soa:superClassOf"]) {
          this.enumerations[actEnumKey]["soa:superClassOf"] = [];
        }
        for (const actSuperClass of superClasses) {
          let superClass = this.classes[actSuperClass];
          if (!superClass) {
            superClass = this.enumerations[actSuperClass];
          }
          if (superClass) {
            if (superClass["soa:superClassOf"]) {
              if (!superClass["soa:superClassOf"].includes(actEnumKey)) {
                superClass["soa:superClassOf"].push(actEnumKey);
              }
            } else {
              superClass["soa:superClassOf"] = [actEnumKey];
            }
          }
        }
      }
      // D.2) Add subClasses for DataTypes
      // For each entry in the dataTypes memory the superClasses are checked (if they are in dataTypes memory) and those super types add the actual entry in their subClasses.
      let dataTypeKeys = Object.keys(this.dataTypes);
      for (const actDtKey of dataTypeKeys) {
        const superClasses = this.dataTypes[actDtKey]["rdfs:subClassOf"];
        // add empty superClassOf if not defined
        if (!this.dataTypes[actDtKey]["soa:superClassOf"]) {
          this.dataTypes[actDtKey]["soa:superClassOf"] = [];
        }
        // add empty subClassOf if not defined
        if (!superClasses) {
          this.dataTypes[actDtKey]["rdfs:subClassOf"] = [];
        } else {
          for (const actSuperClass of superClasses) {
            const superClass = this.dataTypes[actSuperClass];
            if (superClass) {
              if (superClass["soa:superClassOf"]) {
                if (!superClass["soa:superClassOf"].includes(actDtKey)) {
                  superClass["soa:superClassOf"].push(actDtKey);
                }
              } else {
                superClass["soa:superClassOf"] = [actDtKey];
              }
            }
          }
        }
      }
      // D.3) Add subProperties for Properties
      // For each entry in the properties memory the superProperties are checked (if they are in properties memory) and those super properties add the actual entry in their subProperties. (soa:superPropertyOf)
      let propertyKeys = Object.keys(this.properties);
      for (const actPropKey of propertyKeys) {
        const superProperties =
          this.properties[actPropKey]["rdfs:subPropertyOf"];
        // add empty superPropertyOf if not defined
        if (!this.properties[actPropKey]["soa:superPropertyOf"]) {
          this.properties[actPropKey]["soa:superPropertyOf"] = [];
        }
        // add empty subPropertyOf if not defined
        if (!superProperties) {
          this.properties[actPropKey]["rdfs:subPropertyOf"] = [];
        } else {
          for (const actSuperProp of superProperties) {
            const superClass = this.properties[actSuperProp];
            if (superClass) {
              if (superClass["soa:superPropertyOf"]) {
                if (!superClass["soa:superPropertyOf"].includes(actPropKey)) {
                  superClass["soa:superPropertyOf"].push(actPropKey);
                }
              } else {
                superClass["soa:superPropertyOf"] = [actPropKey];
              }
            }
          }
        }
      }
      // E) Relationships
      /*  In this step additional fields are added to certain data entries to add links to other data entries, which should make it easier to use the generated data set.#
                        soa:hasProperty is an inverse of schema:domainIncludes
                        soa:isRangeOf is an inverse of schema:rangeIncludes
                        soa:hasEnumerationMember is used for enumerations to list all its enumeration members (their @type includes the @id of the enumeration)
                        soa:enumerationDomainIncludes is an inverse of soa:hasEnumerationMember */
      // E.0) add empty arrays for the relationships
      classesKeys = Object.keys(this.classes);
      for (const actClassKey of classesKeys) {
        if (!this.classes[actClassKey]["soa:hasProperty"]) {
          this.classes[actClassKey]["soa:hasProperty"] = [];
        }
        if (!this.classes[actClassKey]["soa:isRangeOf"]) {
          this.classes[actClassKey]["soa:isRangeOf"] = [];
        }
      }
      enumKeys = Object.keys(this.enumerations);
      for (const actEnumKey of enumKeys) {
        if (!this.enumerations[actEnumKey]["soa:hasEnumerationMember"]) {
          this.enumerations[actEnumKey]["soa:hasEnumerationMember"] = [];
        }
        if (!this.enumerations[actEnumKey]["soa:isRangeOf"]) {
          this.enumerations[actEnumKey]["soa:isRangeOf"] = [];
        }
        if (!this.enumerations[actEnumKey]["soa:hasProperty"]) {
          this.enumerations[actEnumKey]["soa:hasProperty"] = [];
        }
      }
      dataTypeKeys = Object.keys(this.dataTypes);
      for (const actDataTypeKey of dataTypeKeys) {
        if (!this.dataTypes[actDataTypeKey]["soa:isRangeOf"]) {
          this.dataTypes[actDataTypeKey]["soa:isRangeOf"] = [];
        }
      }
      let enumMemKeys = Object.keys(this.enumerationMembers);
      for (const actEnumMemKey of enumMemKeys) {
        if (
          !this.enumerationMembers[actEnumMemKey][
            "soa:enumerationDomainIncludes"
          ]
        ) {
          this.enumerationMembers[actEnumMemKey][
            "soa:enumerationDomainIncludes"
          ] = [];
        }
      }
      /* E.1) Add explicit hasProperty and isRangeOf to classes, enumerations, and data types
                        For each entry in the classes/enumeration/dataType memory, the soa:hasProperty field is added.
                        This data field holds all properties which belong to this class/enumeration (class/enumeration is domain for property).
                        Also the soa:isRangeOf field is added -> holds all properties which use to this class/enumeration/dataType as range (class/enumeration/dataType is range for property). */
      propertyKeys = Object.keys(this.properties);
      for (const actPropKey of propertyKeys) {
        const domainIncludesArray =
          this.properties[actPropKey]["schema:domainIncludes"];
        if (this.util.isArray(domainIncludesArray)) {
          for (const actDomain of domainIncludesArray) {
            let target = this.classes[actDomain];
            if (!target) {
              target = this.enumerations[actDomain];
            }
            if (
              target &&
              this.util.isArray(target["soa:hasProperty"]) &&
              !target["soa:hasProperty"].includes(actPropKey)
            ) {
              target["soa:hasProperty"].push(actPropKey);
            }
          }
        }
        const rangeIncludesArray =
          this.properties[actPropKey]["schema:rangeIncludes"];
        if (this.util.isArray(rangeIncludesArray)) {
          for (const actRange of rangeIncludesArray) {
            let target =
              this.classes[actRange] ||
              this.enumerations[actRange] ||
              this.dataTypes[actRange];
            if (
              target &&
              this.util.isArray(target["soa:isRangeOf"]) &&
              !target["soa:isRangeOf"].includes(actPropKey)
            ) {
              target["soa:isRangeOf"].push(actPropKey);
            }
          }
        }
      }
      /* E.2) Add soa:hasEnumerationMember to enumerations and soa:enumerationDomainIncludes to enumerationMembers
                        For each entry in the enumeration memory the soa:hasEnumerationMember field is added, this data field holds all enumeration members which belong to this enumeration.
                        For each entry in the enumerationMembers memory the soa:enumerationDomainIncludes field is added, this data field holds all enumerations that are a domain for this enumerationMember
                        */
      enumMemKeys = Object.keys(this.enumerationMembers);
      for (const actEnumMemKey of enumMemKeys) {
        const enumMem = this.enumerationMembers[actEnumMemKey];
        let enumMemTypeArray = enumMem["@type"];
        if (!this.util.isArray(enumMemTypeArray)) {
          enumMemTypeArray = [enumMemTypeArray];
        }
        for (const actEnumMemType of enumMemTypeArray) {
          const target = this.enumerations[actEnumMemType];
          if (
            target &&
            this.util.isArray(target["soa:hasEnumerationMember"]) &&
            !target["soa:hasEnumerationMember"].includes(actEnumMemKey)
          ) {
            target["soa:hasEnumerationMember"].push(actEnumMemKey);
            if (this.util.isArray(enumMem["soa:enumerationDomainIncludes"])) {
              enumMem["soa:enumerationDomainIncludes"].push(actEnumMemType);
            } else {
              enumMem["soa:enumerationDomainIncludes"] = [actEnumMemType];
            }
          }
        }
      }
      return true;
    } catch (e) {
      this.sdoAdapter.onError(e);
      return false;
    }
  }

  /**
   * Creates/Updates a node in the graph
   *
   * @param {object} memory - The memory object where the new node should be added (Classes, Properties, Enumerations, EnumerationMembers, DataTypes)
   * @param {object} newNode - The node in JSON-LD format to be added
   * @param {string} [vocabURL] - The vocabulary URL of the node
   * @returns {boolean} returns true on success
   */
  addGraphNode(memory, newNode, vocabURL = undefined) {
    try {
      if (!memory[newNode["@id"]]) {
        memory[newNode["@id"]] = newNode;
        if (vocabURL) {
          memory[newNode["@id"]]["vocabURLs"] = [vocabURL];
        }
      } else {
        // merging algorithm
        const oldNode = memory[newNode["@id"]];
        // @id stays the same
        // @type should stay the same (we already defined the memory to save it)
        // schema:isPartOf -> overwrite
        if (!this.util.isNil(newNode["schema:isPartOf"])) {
          oldNode["schema:isPartOf"] = newNode["schema:isPartOf"];
        }
        // dc:source/schema:source -> overwrite
        if (!this.util.isNil(newNode["dc:source"])) {
          oldNode["dc:source"] = newNode["dc:source"];
        }
        if (!this.util.isNil(newNode["schema:source"])) {
          oldNode["schema:source"] = newNode["schema:source"];
        }
        // schema:category -> overwrite
        if (!this.util.isNil(newNode["schema:category"])) {
          oldNode["schema:category"] = newNode["schema:category"];
        }
        // schema:supersededBy -> overwrite
        if (!this.util.isNil(newNode["schema:supersededBy"])) {
          oldNode["schema:supersededBy"] = newNode["schema:supersededBy"];
        }
        // rdfs:label -> add new languages, overwrite old ones if needed
        if (!this.util.isNil(newNode["rdfs:label"])) {
          const labelKeysNew = Object.keys(newNode["rdfs:label"]);
          for (const actLabelKey of labelKeysNew) {
            oldNode["rdfs:label"][actLabelKey] =
              newNode["rdfs:label"][actLabelKey];
          }
        }
        // rdfs:comment -> add new languages, overwrite old ones if needed
        if (!this.util.isNil(newNode["rdfs:comment"])) {
          const commentKeysNew = Object.keys(newNode["rdfs:comment"]);
          for (const actCommentKey of commentKeysNew) {
            oldNode["rdfs:comment"][actCommentKey] =
              newNode["rdfs:comment"][actCommentKey];
          }
        }
        // rdfs:subClassOf -> add new ids
        if (!this.util.isNil(newNode["rdfs:subClassOf"])) {
          for (const actSuperClass of newNode["rdfs:subClassOf"]) {
            if (!oldNode["rdfs:subClassOf"].includes(actSuperClass)) {
              // add new entry
              oldNode["rdfs:subClassOf"].push(actSuperClass);
            }
          }
        }
        // soa:superClassOf -> add new ids
        if (!this.util.isNil(newNode["soa:superClassOf"])) {
          for (const actSubClass of newNode["soa:superClassOf"]) {
            if (!oldNode["soa:superClassOf"].includes(actSubClass)) {
              // add new entry
              oldNode["soa:superClassOf"].push(actSubClass);
            }
          }
        }
        // soa:hasProperty -> add new ids
        if (!this.util.isNil(newNode["soa:hasProperty"])) {
          for (const actProp of newNode["soa:hasProperty"]) {
            if (!oldNode["soa:hasProperty"].includes(actProp)) {
              // add new entry
              oldNode["soa:hasProperty"].push(actProp);
            }
          }
        }
        // soa:isRangeOf -> add new ids
        if (!this.util.isNil(newNode["soa:isRangeOf"])) {
          for (const actProp of newNode["soa:isRangeOf"]) {
            if (!oldNode["soa:isRangeOf"].includes(actProp)) {
              // add new entry
              oldNode["soa:isRangeOf"].push(actProp);
            }
          }
        }
        // soa:enumerationDomainIncludes -> add new ids
        if (!this.util.isNil(newNode["soa:enumerationDomainIncludes"])) {
          for (const actEnum of newNode["soa:enumerationDomainIncludes"]) {
            if (!oldNode["soa:enumerationDomainIncludes"].includes(actEnum)) {
              // add new entry
              oldNode["soa:enumerationDomainIncludes"].push(actEnum);
            }
          }
        }
        // soa:hasEnumerationMember -> add new ids
        if (!this.util.isNil(newNode["soa:hasEnumerationMember"])) {
          for (const actEnumMem of newNode["soa:hasEnumerationMember"]) {
            if (!oldNode["soa:hasEnumerationMember"].includes(actEnumMem)) {
              // add new entry
              oldNode["soa:hasEnumerationMember"].push(actEnumMem);
            }
          }
        }
        // rdfs:subPropertyOf -> add new ids
        if (!this.util.isNil(newNode["rdfs:subPropertyOf"])) {
          for (const actProp of newNode["rdfs:subPropertyOf"]) {
            if (!oldNode["rdfs:subPropertyOf"].includes(actProp)) {
              // add new entry
              oldNode["rdfs:subPropertyOf"].push(actProp);
            }
          }
        }
        // schema:domainIncludes -> add new ids
        if (!this.util.isNil(newNode["schema:domainIncludes"])) {
          for (const actDomain of newNode["schema:domainIncludes"]) {
            if (!oldNode["schema:domainIncludes"].includes(actDomain)) {
              // add new entry
              oldNode["schema:domainIncludes"].push(actDomain);
            }
          }
        }
        // schema:rangeIncludes -> add new ids
        if (!this.util.isNil(newNode["schema:rangeIncludes"])) {
          for (const actRange of newNode["schema:rangeIncludes"]) {
            if (!oldNode["schema:rangeIncludes"].includes(actRange)) {
              // add new entry
              oldNode["schema:rangeIncludes"].push(actRange);
            }
          }
        }
        // soa:superPropertyOf-> add new ids
        if (!this.util.isNil(newNode["schema:superPropertyOf"])) {
          for (const actProp of newNode["schema:superPropertyOf"]) {
            if (!oldNode["schema:superPropertyOf"].includes(actProp)) {
              // add new entry
              oldNode["schema:superPropertyOf"].push(actProp);
            }
          }
        }

        if (vocabURL) {
          if (oldNode["vocabURLs"]) {
            if (!oldNode["vocabURLs"].includes(vocabURL)) {
              oldNode["vocabURLs"].push(vocabURL);
            }
          } else {
            oldNode["vocabURLs"] = [vocabURL];
          }
        }
      }

      return true;
    } catch (e) {
      this.sdoAdapter.onError(e);
      return false;
    }
  }

  /**
   * Creates a corresponding JS-Class for the given IRI, depending on its category in the Graph
   *
   * @param {string} id - The id of the wished term, can be an IRI (absolute or compact) or a label
   * @param {filterObject} [filter] - (optional) The filter settings to be applied on the result
   * @returns {Term} the JS-Class for the given IRI
   */
  getTerm(id, filter = undefined) {
    const compactIRI = this.discoverCompactIRI(id);
    let targetObj;
    let targetType;
    let tryCounter = 0;
    do {
      switch (tryCounter) {
        case 0:
          targetObj = this.classes[compactIRI];
          targetType = "Class";
          break;
        case 1:
          targetObj = this.properties[compactIRI];
          targetType = "Property";
          break;
        case 2:
          targetObj = this.dataTypes[compactIRI];
          targetType = "DataType";
          break;
        case 3:
          targetObj = this.enumerations[compactIRI];
          targetType = "Enumeration";
          break;
        case 4:
          targetObj = this.enumerationMembers[compactIRI];
          targetType = "EnumerationMember";
          break;
      }
      tryCounter++;
    } while (!targetObj && tryCounter < 6);

    if (targetObj) {
      targetObj = this.util.applyFilter([targetObj["@id"]], filter, this);
      if (targetObj.length === 0) {
        throw new Error("There is no term with that IRI and filter settings.");
      } else {
        switch (targetType) {
          case "Class":
            return new Class(compactIRI, this);
          case "Property":
            return new Property(compactIRI, this);
          case "Enumeration":
            return new Enumeration(compactIRI, this);
          case "EnumerationMember":
            return new EnumerationMember(compactIRI, this);
          case "DataType":
            return new DataType(compactIRI, this);
        }
      }
    } else {
      throw new Error("There is no term with the IRI " + id);
    }
  }

  /**
   * Creates a JS-Class for a Class of the Graph
   *
   * @param {string} id - The id of the wished Class-node, can be an IRI (absolute or compact) or a label
   * @param {filterObject} [filter] - (optional) The filter settings to be applied on the result
   * @returns {Class|Enumeration} the JS-Class for the given IRI
   */
  getClass(id, filter = undefined) {
    const compactIRI = this.discoverCompactIRI(id);
    if (compactIRI) {
      let classObj = this.classes[compactIRI];
      if (classObj) {
        classObj = this.util.applyFilter([compactIRI], filter, this);
        if (classObj.length === 0) {
          throw new Error(
            "There is no class with that IRI and filter settings."
          );
        } else {
          return new Class(compactIRI, this);
        }
      } else {
        // enumerations can also be counted as classes
        classObj = this.enumerations[compactIRI];
        if (classObj) {
          try {
            return this.getEnumeration(compactIRI, filter);
          } catch (e) {
            throw new Error(
              "There is no class with that IRI and filter settings."
            );
          }
        }
      }
    }
    throw new Error("There is no class with the IRI " + id);
  }

  /**
   * Creates a JS-Class for a Property of the Graph
   *
   * @param {string} id - The id of the wished Property-node, can be an IRI (absolute or compact) or a label
   * @param {filterObject} [filter] - (optional) The filter settings to be applied on the result
   * @returns {Property} the JS-Class for the given IRI
   */
  getProperty(id, filter = undefined) {
    const compactIRI = this.discoverCompactIRI(id);
    if (compactIRI) {
      let propertyObj = this.properties[compactIRI];
      if (propertyObj) {
        propertyObj = this.util.applyFilter([compactIRI], filter, this);
        if (propertyObj.length === 0) {
          throw new Error(
            "There is no property with that URI and filter settings."
          );
        } else {
          return new Property(compactIRI, this);
        }
      }
    }
    throw new Error("There is no property with that URI.");
  }

  /**
   * Creates a JS-Class for a DataType of the Graph
   *
   * @param {string} id - The id of the wished DataType-node, can be an IRI (absolute or compact) or a label
   * @param {filterObject} [filter] - (optional) The filter settings to be applied on the result
   * @returns {DataType} the JS-Class for the given IRI
   */
  getDataType(id, filter = undefined) {
    const compactIRI = this.discoverCompactIRI(id);
    if (compactIRI) {
      let dataTypeObj = this.dataTypes[compactIRI];
      if (dataTypeObj) {
        dataTypeObj = this.util.applyFilter([compactIRI], filter, this);
        if (dataTypeObj.length === 0) {
          throw new Error(
            "There is no data-type with that IRI and filter settings."
          );
        } else {
          return new DataType(compactIRI, this);
        }
      }
    }
    throw new Error("There is no data-type with the IRI " + id);
  }

  /**
   * Creates a JS-Class for an Enumeration of the Graph
   *
   * @param {string} id - The id of the wished Enumeration-node, can be an IRI (absolute or compact) or a label
   * @param {filterObject} [filter] - (optional) The filter settings to be applied on the result
   * @returns {Enumeration} the JS-Class for the given IRI
   */
  getEnumeration(id, filter = undefined) {
    const compactIRI = this.discoverCompactIRI(id);
    if (compactIRI) {
      let enumObj = this.enumerations[compactIRI];
      if (enumObj) {
        enumObj = this.util.applyFilter([compactIRI], filter, this);
        if (enumObj.length === 0) {
          throw new Error(
            "There is no enumeration with that IRI and filter settings."
          );
        } else {
          return new Enumeration(compactIRI, this);
        }
      }
    }
    throw new Error("There is no enumeration with the IRI " + id);
  }

  /**
   * Creates a JS-Class for an EnumerationMember of the Graph
   *
   * @param {string} id - The id of the wished EnumerationMember-node, can be an IRI (absolute or compact) or a label
   * @param {filterObject} [filter] - (optional) The filter settings to be applied on the result
   * @returns {EnumerationMember} the JS-Class for the given IRI
   */
  getEnumerationMember(id, filter = undefined) {
    const compactIRI = this.discoverCompactIRI(id);
    if (compactIRI) {
      let enumObj = this.enumerationMembers[compactIRI];
      if (enumObj) {
        enumObj = this.util.applyFilter([compactIRI], filter, this);
        if (enumObj.length === 0) {
          throw new Error(
            "There is no EnumerationMember with that IRI and filter settings."
          );
        } else {
          return new EnumerationMember(compactIRI, this);
        }
      }
    }
    throw new Error("There is no EnumerationMember with the IRI " + id);
  }

  /**
   * Transforms/Discovers the right compact IRI for a given input, which may be a already a compact IRI, or an absolute IRI, or a term label for a vocabulary member
   *
   * @param {string} input - The input string to discover (if label) or transform (if absolute IRI)
   * @returns {?string} the corresponding compact IRI (null if input is not valid)
   */
  discoverCompactIRI(input) {
    if (input.includes(":")) {
      // is iri
      const terms = Object.keys(this.context);
      for (const actTerm of terms) {
        const absoluteIRI = this.context[actTerm];
        if (this.util.isString(absoluteIRI)) {
          if (input.startsWith(actTerm)) {
            // is compactIRI
            return input;
          } else if (
            input.startsWith(absoluteIRI) ||
            (this.sdoAdapter.equateVocabularyProtocols &&
              input.startsWith(this.util.switchIRIProtocol(absoluteIRI)))
          ) {
            // is absoluteIRI
            return this.util.toCompactIRI(
              input,
              this.context,
              this.sdoAdapter.equateVocabularyProtocols
            );
          }
        }
      }
    } else {
      // is label
      const classesKeys = Object.keys(this.classes);
      for (const actClassKey of classesKeys) {
        if (this.containsLabel(this.classes[actClassKey], input) === true) {
          return actClassKey;
        }
      }
      const propertiesKeys = Object.keys(this.properties);
      for (const actPropKey of propertiesKeys) {
        if (this.containsLabel(this.properties[actPropKey], input) === true) {
          return actPropKey;
        }
      }
      const dataTypeKeys = Object.keys(this.dataTypes);
      for (const actDtKey of dataTypeKeys) {
        if (this.containsLabel(this.dataTypes[actDtKey], input) === true) {
          return actDtKey;
        }
      }
      const enumerationKeys = Object.keys(this.enumerations);
      for (const actEnumKey of enumerationKeys) {
        if (this.containsLabel(this.enumerations[actEnumKey], input) === true) {
          return actEnumKey;
        }
      }
      const enumerationMemberKeys = Object.keys(this.enumerationMembers);
      for (const actEnumMemKey of enumerationMemberKeys) {
        if (
          this.containsLabel(this.enumerationMembers[actEnumMemKey], input) ===
          true
        ) {
          return actEnumMemKey;
        }
      }
    }
    // if nothing was found yet, the input is invalid
    return null;
  }

  /**
   * Checks if a given term object contains a given label string. Helper function for discoverCompactIRI()
   *
   * @param {object} termObj - the term node
   * @param {string} label - the language to check
   * @returns {boolean} returns true, if the termObj uses the given label (in any language)
   */
  containsLabel(termObj, label) {
    if (termObj && this.util.isObject(termObj["rdfs:label"])) {
      const langKeys = Object.keys(termObj["rdfs:label"]);
      for (const actLangKey of langKeys) {
        if (termObj["rdfs:label"][actLangKey] === label) {
          return true;
        }
      }
    }
    return false;
  }
}

module.exports = Graph;

},{"./Class":79,"./DataType":80,"./Enumeration":81,"./EnumerationMember":82,"./Property":84,"./ReasoningEngine":85,"./utilities":88}],84:[function(require,module,exports){
// the functions for a property Object
const Term = require("./Term");

/**
 * @typedef filterObject
 * @type {object}
 * @property {boolean} [isSuperseded] - defines the superseded status for the filter (true: only terms that are superseded, false: only terms that are NOT superseded)
 * @property {string|string[]} [fromVocabulary] - defines a set of allowed vocabularies for the filter - vocabularies are given as indicators (e.g. "schema")
 * @property {string|string[]} [termType] - defines a set of allowed term types for the filter (e.g. "Class", "Property")
 */

class Property extends Term {
  /**
   * A Property represents an rdf:Property. It is identified by its IRI
   *
   * @class
   * @param {string} IRI - The compacted IRI of this Property, e.g. "schema:address"
   * @param {Graph} graph - The underlying data graph to enable the methods of this Property
   */
  constructor(IRI, graph) {
    super(IRI, graph);
  }

  /**
   * Retrieves the term type of this Property (is always "rdf:Property")
   *
   * @returns {string} The term type of this Property -> "rdf:Property"
   */
  getTermType() {
    return "rdf:Property";
  }

  /**
   * Retrieves the term object of this Property
   *
   * @returns {string} The term object of this Property
   */
  getTermObj() {
    return this.graph.properties[this.IRI];
  }

  /**
   * Retrieves the explicit/implicit ranges (schema:rangeIncludes) of this Property
   *
   * @param {boolean} [implicit = true] - retrieves also implicit ranges (inheritance from sub-classes of the ranges) - (default = true)
   * @param {filterObject} [filter] - (optional) The filter settings to be applied on the result
   * @returns {string[]} The ranges of this Property
   */
  getRanges(implicit = true, filter = undefined) {
    let propertyObj = this.getTermObj();
    let result = [];
    result.push(...propertyObj["schema:rangeIncludes"]);
    if (implicit) {
      // add sub-classes and sub-datatypes from ranges
      for (const actRes of result) {
        result.push(...this.graph.reasoner.inferSubDataTypes(actRes));
      }
      for (const actRes of result) {
        result.push(...this.graph.reasoner.inferSubClasses(actRes));
      }
    }
    return this.util.applyFilter(
      this.util.uniquifyArray(result),
      filter,
      this.graph
    );
  }

  /**
   * Retrieves the explicit/implicit domains (schema:domainIncludes) of this Property
   *
   * @param {boolean} [implicit = true] - retrieves also implicit domains (inheritance from sub-classes of the domains) - (default = true)
   * @param {filterObject} [filter] - (optional) The filter settings to be applied on the result
   * @returns {string[]} The domains of this Property
   */
  getDomains(implicit = true, filter = undefined) {
    let propertyObj = this.getTermObj();
    let result = [];
    result.push(...propertyObj["schema:domainIncludes"]);
    if (implicit) {
      // add sub-classes from ranges
      let inferredSubClasses = [];
      for (const actRes of result) {
        inferredSubClasses.push(...this.graph.reasoner.inferSubClasses(actRes));
      }
      result.push(...inferredSubClasses);
    }
    return this.util.applyFilter(
      this.util.uniquifyArray(result),
      filter,
      this.graph
    );
  }

  /**
   * Retrieves the explicit/implicit super-properties (rdfs:subPropertyOf) of this Property
   *
   * @param {boolean} [implicit = true] - retrieves also implicit super-properties (recursive from super-properties) - (default = true)
   * @param {filterObject} [filter] - (optional) The filter settings to be applied on the result
   * @returns {string[]} The super-properties of this Property
   */
  getSuperProperties(implicit = true, filter = undefined) {
    let propertyObj = this.getTermObj();
    let result = [];

    if (implicit) {
      result.push(...this.graph.reasoner.inferSuperProperties(this.IRI));
    } else {
      result.push(...propertyObj["rdfs:subPropertyOf"]);
    }
    return this.util.applyFilter(
      this.util.uniquifyArray(result),
      filter,
      this.graph
    );
  }

  /**
   * Retrieves the explicit/implicit sub-properties (soa:superPropertyOf) of this Property
   *
   * @param {boolean} [implicit = true] - retrieves also implicit sub-properties (recursive from sub-properties) - (default = true)
   * @param {filterObject} [filter] - (optional) The filter settings to be applied on the result
   * @returns {string[]} The sub-properties of this Property
   */
  getSubProperties(implicit = true, filter = undefined) {
    let propertyObj = this.getTermObj();
    let result = [];

    if (implicit) {
      result.push(...this.graph.reasoner.inferSubProperties(this.IRI));
    } else {
      result.push(...propertyObj["soa:superPropertyOf"]);
    }
    return this.util.applyFilter(
      this.util.uniquifyArray(result),
      filter,
      this.graph
    );
  }

  /**
   * Retrieves the inverse Property (schema:inverseOf) of this Property
   *
   * @returns {string} The IRI of the inverse Property of this Property
   */
  getInverseOf() {
    let propertyObj = this.getTermObj();
    return propertyObj["schema:inverseOf"];
  }

  /**
   * Generates an explicit/implicit JSON representation of this Property.
   *
   * @param {boolean} [implicit = true] - includes also implicit data (e.g. domains, ranges, etc.) - (default = true)
   * @param {filterObject} [filter] - (optional) The filter settings to be applied on the result
   * @returns {object} The JSON representation of this Class
   */
  toJSON(implicit = true, filter = undefined) {
    const result = super.toJSON();
    result["ranges"] = this.getRanges(implicit, filter);
    result["domains"] = this.getDomains(implicit, filter);
    result["superProperties"] = this.getSuperProperties(implicit, filter);
    result["subProperties"] = this.getSubProperties(implicit, filter);
    result["inverseOf"] = this.getInverseOf();
    return result;
  }
}

module.exports = Property;

},{"./Term":87}],85:[function(require,module,exports){
class ReasoningEngine {
  /**
   * This internal js-class offers reasoning-related functions that can be used by the other js-classes of this library
   *
   * @class
   * @param {Graph} graph The parent Graph-class to which this ReasoningEngine belongs
   */
  constructor(graph) {
    this.graph = graph;
    this.util = require("./utilities");
  }

  /**
   * Infers all properties that can be used by the given classes and all their implicit and explicit superClasses
   *
   * @param {string[]} superClasses - Array with IRIs of classes/enumerations
   * @returns {string[]} Array of IRIs of all properties from the given classes and their implicit and explicit superClasses
   */
  inferPropertiesFromSuperClasses(superClasses) {
    const result = [];
    for (const superClass of superClasses) {
      let superClassObj =
        this.graph.classes[superClass] || this.graph.enumerations[superClass];
      if (superClassObj) {
        result.push(...superClassObj["soa:hasProperty"]);
        if (superClassObj["rdfs:subClassOf"].length !== 0) {
          result.push(
            ...this.inferPropertiesFromSuperClasses(
              superClassObj["rdfs:subClassOf"]
            )
          );
        }
      }
    }
    return this.util.uniquifyArray(result);
  }

  /**
   * Infers all implicit and explicit superClasses of a given Class/Enumeration
   *
   * @param {string} classIRI - IRI of a Class/Enumeration
   * @returns {string[]} Array of IRI of all implicit and explicit superClasses
   */
  inferSuperClasses(classIRI) {
    let result = [];
    const classObj =
      this.graph.classes[classIRI] || this.graph.enumerations[classIRI];
    if (classObj) {
      result.push(...classObj["rdfs:subClassOf"]);
      let addition = this.util.copByVal(result); // make a copy
      do {
        let newAddition = [];
        for (const curAdd of addition) {
          let parentClassObj =
            this.graph.classes[curAdd] || this.graph.enumerations[curAdd];
          if (parentClassObj) {
            newAddition.push(...parentClassObj["rdfs:subClassOf"]);
          }
        }
        newAddition = this.util.uniquifyArray(newAddition);
        addition = this.util.copByVal(newAddition);
        result.push(...newAddition);
      } while (addition.length !== 0);
      result = this.util.uniquifyArray(result);
    }
    return result;
  }

  /**
   * Infers all implicit and explicit subClasses of a given Class/Enumeration
   *
   * @param {string} classIRI - IRI of a Class/Enumeration
   * @returns {string[]} Array of IRI of all implicit and explicit subClasses
   */
  inferSubClasses(classIRI) {
    let result = [];
    const classObj =
      this.graph.classes[classIRI] || this.graph.enumerations[classIRI];
    if (classObj) {
      result.push(...classObj["soa:superClassOf"]);
      let addition = this.util.copByVal(result); // make a copy
      do {
        let newAddition = [];
        for (const curAdd of addition) {
          let parentClassObj =
            this.graph.classes[curAdd] || this.graph.enumerations[curAdd];
          if (parentClassObj) {
            newAddition.push(...parentClassObj["soa:superClassOf"]);
          }
        }
        newAddition = this.util.uniquifyArray(newAddition);
        addition = this.util.copByVal(newAddition);
        result.push(...newAddition);
      } while (addition.length !== 0);
      result = this.util.uniquifyArray(result);
    }
    return result;
  }

  /**
   * Infers all implicit and explicit superDataTypes of a given DataType
   *
   * @param {string} dataTypeIRI - IRI of a DataType
   * @returns {string[]} Array of IRI of all implicit and explicit superDataTypes
   */
  inferSuperDataTypes(dataTypeIRI) {
    let result = [];
    const dataTypeObj = this.graph.dataTypes[dataTypeIRI];
    if (dataTypeObj) {
      result.push(...dataTypeObj["rdfs:subClassOf"]);
      let addition = this.util.copByVal(result); // make a copy
      do {
        let newAddition = [];
        for (const curAdd of addition) {
          const parentDataTypeObj = this.graph.dataTypes[curAdd];
          if (parentDataTypeObj) {
            newAddition.push(...parentDataTypeObj["rdfs:subClassOf"]);
          }
        }
        newAddition = this.util.uniquifyArray(newAddition);
        addition = this.util.copByVal(newAddition);
        result.push(...newAddition);
      } while (addition.length !== 0);
      result = this.util.uniquifyArray(result);
    }
    return result;
  }

  /**
   * Infers all implicit and explicit subDataTypes of a given DataType
   *
   * @param {string} dataTypeIRI - IRI of a DataType
   * @returns {string[]} Array of IRI of all implicit and explicit subDataTypes
   */
  inferSubDataTypes(dataTypeIRI) {
    let result = [];
    const dataTypeObj = this.graph.dataTypes[dataTypeIRI];
    if (dataTypeObj) {
      result.push(...dataTypeObj["soa:superClassOf"]);
      let addition = this.util.copByVal(result); // make a copy
      do {
        let newAddition = [];
        for (const curAdd of addition) {
          const childDataTypeObj = this.graph.dataTypes[curAdd];
          if (childDataTypeObj) {
            newAddition.push(...childDataTypeObj["soa:superClassOf"]);
          }
        }
        newAddition = this.util.uniquifyArray(newAddition);
        addition = this.util.copByVal(newAddition);
        result.push(...newAddition);
      } while (addition.length !== 0);
      result = this.util.uniquifyArray(result);
    }
    return result;
  }

  /**
   * Infers all implicit and explicit superProperties of a given Property
   *
   * @param {string} propertyIRI - IRI of a Property
   * @returns {string[]} Array of IRI of all implicit and explicit superProperties
   */
  inferSuperProperties(propertyIRI) {
    let result = [];
    const propertyObj = this.graph.properties[propertyIRI];
    if (propertyObj) {
      result.push(...propertyObj["rdfs:subPropertyOf"]);
      let addition = this.util.copByVal(result); // make a copy
      do {
        let newAddition = [];
        for (let curAdd of addition) {
          const parentPropertyObj = this.graph.properties[curAdd];
          if (parentPropertyObj) {
            newAddition.push(...parentPropertyObj["rdfs:subPropertyOf"]);
          }
        }
        newAddition = this.util.uniquifyArray(newAddition);
        addition = this.util.copByVal(newAddition);
        result.push(...newAddition);
      } while (addition.length !== 0);
      result = this.util.uniquifyArray(result);
    }
    return result;
  }

  /**
   * Infers all implicit and explicit subProperties of a given Property
   *
   * @param {string} propertyIRI - IRI of a Property
   * @returns {string[]} Array of IRI of all implicit and explicit subProperties
   */
  inferSubProperties(propertyIRI) {
    let result = [];
    const propertyObj = this.graph.properties[propertyIRI];
    if (propertyObj) {
      result.push(...propertyObj["soa:superPropertyOf"]);
      let addition = this.util.copByVal(result); // make a copy
      do {
        let newAddition = [];
        for (const curAdd of addition) {
          const parentPropertyObj = this.graph.properties[curAdd];
          if (parentPropertyObj) {
            newAddition.push(...parentPropertyObj["soa:superPropertyOf"]);
          }
        }
        newAddition = this.util.uniquifyArray(newAddition);
        addition = this.util.copByVal(newAddition);
        result.push(...newAddition);
      } while (addition.length !== 0);
      result = this.util.uniquifyArray(result);
    }
    return result;
  }

  /**
   * Infers all implicit and explicit properties that can have the given Class/Enumeration/DataType as range
   *
   * @param {string} rangeIRI - IRI of the range (Class/Enumeration/DataType)
   * @returns {string[]} Array of IRI of all implicit and explicit properties that can use the given range
   */
  inferRangeOf(rangeIRI) {
    const classObj =
      this.graph.classes[rangeIRI] || this.graph.enumerations[rangeIRI];
    let result = [];
    if (classObj) {
      result.push(...classObj["soa:isRangeOf"]);
      let superClasses = this.inferSuperClasses(rangeIRI);
      for (const superClass of superClasses) {
        let superClassObj =
          this.graph.classes[superClass] || this.graph.enumerations[superClass];
        if (superClassObj) {
          result.push(...superClassObj["soa:isRangeOf"]);
        }
      }
    } else {
      const dataTypeObj = this.graph.dataTypes[rangeIRI];
      if (dataTypeObj) {
        result.push(...dataTypeObj["soa:isRangeOf"]);
        let superDataTypes = this.inferSuperDataTypes(rangeIRI);
        for (const superDataType of superDataTypes) {
          let superDataTypeObj = this.graph.dataTypes[superDataType];
          if (superDataTypeObj) {
            result.push(...superDataTypeObj["soa:isRangeOf"]);
          }
        }
      }
    }
    return this.util.uniquifyArray(result);
  }
}

module.exports = ReasoningEngine;

},{"./utilities":88}],86:[function(require,module,exports){
const Graph = require("./Graph");
const Term = require("./Term");
const Class = require("./Class");
const Property = require("./Property");
const DataType = require("./DataType");
const Enumeration = require("./Enumeration");
const EnumerationMember = require("./EnumerationMember");
const axios = require("axios");

const URI_SEMANTIFY_GITHUB =
  "https://raw.githubusercontent.com/semantifyit/schemaorg/main/";
const URI_SEMANTIFY_RELEASES = URI_SEMANTIFY_GITHUB + "data/releases/";
const URI_SEMANTIFY_VERSIONS = URI_SEMANTIFY_GITHUB + "versions.json";

/**
 * @typedef SDOAdapterParameterObject
 * @type {object}
 * @property {string} [commitBase] - The commit string from https://github.com/schemaorg/schemaorg which is the base for the adapter (if not given, we take the latest commit of our fork at https://github.com/semantifyit/schemaorg)
 * @property {boolean} [schemaHttps = true] - Enables the use of the https version of the schema.org vocabulary, it defaults to true. Only available for schema.org version 9.0 upwards.
 * @property {boolean} [equateVocabularyProtocols = false] - If true, treat namespaces as equal even if their protocols (http/https) are different, it defaults to false.
 * @property {Function} [onError] - A callback function(string) that is called when an unexpected error happens
 */

/**
 * @typedef filterObject
 * @type {object}
 * @property {boolean} [isSuperseded] - defines the superseded status for the filter (true: only terms that are superseded, false: only terms that are NOT superseded)
 * @property {string|string[]} [fromVocabulary] - defines a set of allowed vocabularies for the filter - vocabularies are given as indicators (e.g. "schema")
 * @property {string|string[]} [termType] - defines a set of allowed term types for the filter (e.g. "Class", "Property")
 */

class SDOAdapter {
  /**
   * The SDOAdapter is a JS-Class that represents the interface between the user and this library. Its methods enable to add vocabularies to its memory as well as retrieving vocabulary items. It is possible to create multiple instances of this JS-Class which use different vocabularies.
   *
   * @class
   * @param {SDOAdapterParameterObject} [parameterObject] - an optional parameter object with optional options for the constructor.
   */
  constructor(parameterObject = undefined) {
    this.util = require("./utilities");
    this.retrievalMemory = {
      versionsFile: null,
      latest: null,
    };
    // option commitBase - defaults to undefined
    if (parameterObject && parameterObject.commitBase) {
      this.commitBase = parameterObject.commitBase;
    }
    // option onError - defaults to a function that does nothing
    if (parameterObject && typeof parameterObject.onError === "function") {
      this.onError = parameterObject.onError;
    } else {
      this.onError = function () {
        // do nothing; The users should pass their own function to handle errors, they have else no way to hide automatic error messages once the SDO Adapter is compiled
      };
    }
    // option schemaHttps - defaults to true
    if (parameterObject && parameterObject.schemaHttps !== undefined) {
      this.schemaHttps = parameterObject.schemaHttps;
    } else {
      this.schemaHttps = true;
    }
    // option equateVocabularyProtocols - defaults to false
    if (
      parameterObject &&
      parameterObject.equateVocabularyProtocols !== undefined
    ) {
      this.equateVocabularyProtocols =
        parameterObject.equateVocabularyProtocols;
    } else {
      this.equateVocabularyProtocols = false;
    }
    this.graph = new Graph(this);
  }

  /**
   * Adds vocabularies (in JSON-LD format or as URL) to the memory of this SDOAdapter. The function "constructSDOVocabularyURL()" helps you to construct URLs for the schema.org vocabulary
   *
   * @param {string[]|object[]|string|object} vocabArray - The vocabular(y/ies) to add the graph, in JSON-LD format. Given directly as JSON or by a URL to fetch.
   * @returns {Promise<boolean>} This is an async function, returns true when done.
   */
  async addVocabularies(vocabArray) {
    if (
      !this.util.isArray(vocabArray) &&
      (this.util.isString(vocabArray) || this.util.isObject(vocabArray))
    ) {
      vocabArray = [vocabArray];
    }
    if (this.util.isArray(vocabArray)) {
      // check every vocab if it is a valid JSON-LD. If string -> try to JSON.parse()
      for (const vocab of vocabArray) {
        if (this.util.isString(vocab)) {
          if (vocab.startsWith("www") || vocab.startsWith("http")) {
            // assume it is a URL
            try {
              let fetchedVocab = await this.fetchVocabularyFromURL(vocab);
              if (this.util.isString(fetchedVocab)) {
                fetchedVocab = JSON.parse(fetchedVocab); // try to parse the fetched content as JSON
              }
              await this.graph.addVocabulary(fetchedVocab, vocab);
            } catch (e) {
              console.log(e);
              throw new Error(
                "The given URL " +
                  vocab +
                  " did not contain a valid JSON-LD vocabulary."
              );
            }
          } else {
            // assume it is a string-version of a JSON-LD
            try {
              await this.graph.addVocabulary(JSON.parse(vocab));
            } catch (e) {
              throw new Error(
                "Parsing of vocabulary string produced an invalid JSON-LD."
              );
            }
          }
        } else if (this.util.isObject(vocab)) {
          await this.graph.addVocabulary(vocab);
        } else {
          // invalid argument type!
          throw new Error(
            "The first argument of the function must be an Array of vocabularies or a single vocabulary (JSON-LD as Object/String)"
          );
        }
      }
    } else {
      throw new Error(
        "The first argument of the function must be an Array of vocabularies or a single vocabulary (JSON-LD as Object/String)"
      );
    }
    return true;
  }

  /**
   * Fetches a vocabulary from the given URL.
   *
   * @param {string} url - the URL from which the vocabulary should be fetched
   * @returns {Promise<object|string>} The fetched vocabulary object (or string, if the server returns a string instead of an object)
   */
  async fetchVocabularyFromURL(url) {
    return new Promise(function (resolve, reject) {
      axios
        .get(url, {
          headers: {
            Accept: "application/ld+json, application/json",
          },
        })
        .then(function (res) {
          resolve(res.data);
        })
        .catch(function () {
          reject("Could not find any resource at the given URL.");
        });
    });
  }

  /**
   * Creates a corresponding JS-Class for the given IRI, depending on its term-category
   *
   * @param {string} id - The id of the wished term, can be an IRI (absolute or compact) or a label
   * @param {filterObject} [filter] - (optional) The filter settings to be applied on the result
   * @returns {Term} The JS-Class for the given IRI
   */
  getTerm(id, filter = undefined) {
    return this.graph.getTerm(id, filter);
  }

  /**
   * Creates an array of JS-Classes for all vocabulary Terms (corresponding JS-Classes depending on the Term types)
   *
   * @param {filterObject} [filter] - (optional) The filter settings to be applied on the result
   * @returns {Class[]} An array of JS-Classes representing all vocabulary Terms
   */
  getAllTerms(filter = undefined) {
    const result = [];
    const classesIRIList = this.getListOfClasses(filter);
    const enumerationsIRIList = this.getListOfEnumerations(filter);
    const propertiesIRIList = this.getListOfProperties(filter);
    const dataTypesIRIList = this.getListOfDataTypes(filter);
    const enumerationMembersIRIList = this.getListOfEnumerationMembers(filter);
    for (let c of classesIRIList) {
      try {
        result.push(this.getClass(c));
      } catch (e) {
        throw new Error("There is no class with the IRI " + c);
      }
    }
    for (let en of enumerationsIRIList) {
      try {
        result.push(this.getEnumeration(en));
      } catch (e) {
        throw new Error("There is no enumeration with the IRI " + en);
      }
    }
    for (let p of propertiesIRIList) {
      try {
        result.push(this.getProperty(p));
      } catch (e) {
        throw new Error("There is no property with the IRI " + p);
      }
    }
    for (let dt of dataTypesIRIList) {
      try {
        result.push(this.getDataType(dt));
      } catch (e) {
        throw new Error("There is no data type with the IRI " + dt);
      }
    }
    for (let enm of enumerationMembersIRIList) {
      try {
        result.push(this.getEnumerationMember(enm));
      } catch (e) {
        throw new Error("There is no enumeration member with the IRI " + enm);
      }
    }
    return result;
  }

  /**
   * Creates an array of IRIs for all vocabulary Terms
   *
   * @param {filterObject} [filter] - (optional) The filter settings to be applied on the result
   * @returns {string[]} An array of IRIs representing all vocabulary Terms
   */
  getListOfTerms(filter = undefined) {
    // do not include enumerations
    let result = [];
    result.push(...Object.keys(this.graph.classes));
    result.push(...Object.keys(this.graph.enumerations));
    result.push(...Object.keys(this.graph.properties));
    result.push(...Object.keys(this.graph.dataTypes));
    result.push(...Object.keys(this.graph.enumerationMembers));
    return this.util.applyFilter(result, filter, this.graph);
  }

  /**
   * Creates a JS-Class for a vocabulary Class by the given identifier (@id) or name
   *
   * @param {string} id - The identifier of the wished Class. It can be either a compact IRI -> "schema:Hotel", an absolute IRI -> "http://schema.org/Hotel", or the name (rdfs:label) -> "name" of the class (which may be ambiguous if multiple vocabularies/languages are used).
   * @param {filterObject} [filter] - (optional) The filter settings to be applied on the result
   * @returns {Class|Enumeration} The JS-Class representing a Class of an Enumeration (depending on the given id)
   */
  getClass(id, filter = undefined) {
    // returns also enumerations
    return this.graph.getClass(id, filter);
  }

  /**
   * Creates an array of JS-Classes for all vocabulary Classes
   *
   * @param {filterObject} [filter] - (optional) The filter settings to be applied on the result
   * @returns {Class[]} An array of JS-Classes representing all vocabulary Classes, does not include Enumerations
   */
  getAllClasses(filter = undefined) {
    const result = [];
    const classesIRIList = this.getListOfClasses(filter);
    for (let c of classesIRIList) {
      try {
        result.push(this.getClass(c));
      } catch (e) {
        throw new Error("There is no class with the IRI " + c);
      }
    }
    return result;
  }

  /**
   * Creates an array of IRIs for all vocabulary Classes
   *
   * @param {filterObject} [filter] - (optional) The filter settings to be applied on the result
   * @returns {string[]} An array of IRIs representing all vocabulary Classes, does not include Enumerations
   */
  getListOfClasses(filter = undefined) {
    // do not include enumerations
    return this.util.applyFilter(
      Object.keys(this.graph.classes),
      filter,
      this.graph
    );
  }

  /**
   * Creates a JS-Class for a vocabulary Property by the given identifier (@id) or name
   *
   * @param {string} id - The identifier of the wished Property. It can be either a compact IRI -> "schema:address", an absolute IRI -> "http://schema.org/address", or the name (rdfs:label) -> "address" of the Property (which may be ambiguous if multiple vocabularies/languages are used).
   * @param {filterObject} [filter] - (optional) The filter settings to be applied on the result
   * @returns {Property} The JS-Class representing a Property
   */
  getProperty(id, filter = undefined) {
    return this.graph.getProperty(id, filter);
  }

  /**
   * Creates an array of JS-Classes for all vocabulary Properties
   *
   * @param {filterObject} [filter] - (optional) The filter settings to be applied on the result
   * @returns {Property[]} An array of JS-Classes representing all vocabulary Properties
   */
  getAllProperties(filter = undefined) {
    const result = [];
    const propertiesIRIList = this.getListOfProperties(filter);
    for (let p of propertiesIRIList) {
      try {
        result.push(this.getProperty(p));
      } catch (e) {
        throw new Error("There is no property with the IRI " + p);
      }
    }
    return result;
  }

  /**
   * Creates an array of IRIs for all vocabulary Properties
   *
   * @param {filterObject} [filter] - (optional) The filter settings to be applied on the result
   * @returns {string[]} An array of IRIs representing all vocabulary Properties
   */
  getListOfProperties(filter = undefined) {
    return this.util.applyFilter(
      Object.keys(this.graph.properties),
      filter,
      this.graph
    );
  }

  /**
   * Creates a JS-Class for a vocabulary DataType by the given identifier (@id) or name
   *
   * @param {string} id - The identifier of the wished DataType. It can be either a compact IRI -> "schema:Number", an absolute IRI -> "http://schema.org/Number", or the name (rdfs:label) -> "Number" of the DataType (which may be ambiguous if multiple vocabularies/languages are used).
   * @param {filterObject} [filter] - (optional) The filter settings to be applied on the result
   * @returns {DataType} The JS-Class representing a DataType
   */
  getDataType(id, filter = undefined) {
    return this.graph.getDataType(id, filter);
  }

  /**
   * Creates an array of JS-Classes for all vocabulary DataTypes
   *
   * @param {filterObject} [filter] - (optional) The filter settings to be applied on the result
   * @returns {DataType[]} An array of JS-Classes representing all vocabulary DataTypes
   */
  getAllDataTypes(filter = undefined) {
    const result = [];
    const dataTypesIRIList = this.getListOfDataTypes(filter);
    for (let dt of dataTypesIRIList) {
      try {
        result.push(this.getDataType(dt));
      } catch (e) {
        throw new Error("There is no data type with the IRI " + dt);
      }
    }
    return result;
  }

  /**
   * Creates an array of IRIs for all vocabulary DataTypes
   *
   * @param {filterObject} [filter] - (optional) The filter settings to be applied on the result
   * @returns {string[]} An array of IRIs representing all vocabulary DataTypes
   */
  getListOfDataTypes(filter = undefined) {
    return this.util.applyFilter(
      Object.keys(this.graph.dataTypes),
      filter,
      this.graph
    );
  }

  /**
   * Creates a JS-Class for a vocabulary Enumeration by the given identifier (@id) or name
   *
   * @param {string} id - The identifier of the wished Enumeration. It can be either a compact IRI -> "schema:DayOfWeek", an absolute IRI -> "http://schema.org/DayOfWeek", or the name (rdfs:label) -> "DayOfWeek" of the Enumeration (which may be ambiguous if multiple vocabularies/languages are used).
   * @param {filterObject} [filter] - (optional) The filter settings to be applied on the result
   * @returns {Enumeration} The JS-Class representing an Enumeration
   */
  getEnumeration(id, filter = undefined) {
    return this.graph.getEnumeration(id, filter);
  }

  /**
   * Creates an array of JS-Classes for all vocabulary Enumerations
   *
   * @param {filterObject} [filter] - (optional) The filter settings to be applied on the result
   * @returns {Enumeration[]} An array of JS-Classes representing all vocabulary Enumerations
   */
  getAllEnumerations(filter = undefined) {
    const result = [];
    const enumerationsIRIList = this.getListOfEnumerations(filter);
    for (let en of enumerationsIRIList) {
      try {
        result.push(this.getEnumeration(en));
      } catch (e) {
        throw new Error("There is no enumeration with the IRI " + en);
      }
    }
    return result;
  }

  /**
   * Creates an array of IRIs for all vocabulary Enumerations
   *
   * @param {filterObject} [filter] - (optional) The filter settings to be applied on the result
   * @returns {string[]} An array of IRIs representing all vocabulary Enumerations
   */
  getListOfEnumerations(filter = undefined) {
    return this.util.applyFilter(
      Object.keys(this.graph.enumerations),
      filter,
      this.graph
    );
  }

  /**
   * Creates a JS-Class for a vocabulary EnumerationMember by the given identifier (@id) or name
   *
   * @param {string} id - The identifier of the wished EnumerationMember. It can be either a compact IRI -> "schema:Friday", an absolute IRI -> "http://schema.org/Friday", or the name (rdfs:label) -> "Friday" of the EnumerationMember (which may be ambiguous if multiple vocabularies/languages are used).
   * @param {filterObject} [filter] - (optional) The filter settings to be applied on the result
   * @returns {EnumerationMember} The JS-Class representing an EnumerationMember
   */
  getEnumerationMember(id, filter = undefined) {
    return this.graph.getEnumerationMember(id, filter);
  }

  /**
   * Creates an array of JS-Classes for all vocabulary EnumerationMember
   *
   * @param {filterObject} [filter] - (optional) The filter settings to be applied on the result
   * @returns {EnumerationMember[]} An array of JS-Classes representing all vocabulary EnumerationMember
   */
  getAllEnumerationMembers(filter = undefined) {
    const result = [];
    const enumerationMembersIRIList = this.getListOfEnumerationMembers(filter);
    for (let enm of enumerationMembersIRIList) {
      try {
        result.push(this.getEnumerationMember(enm));
      } catch (e) {
        throw new Error("There is no enumeration member with the IRI " + enm);
      }
    }
    return result;
  }

  /**
   * Creates an array of IRIs for all vocabulary EnumerationMember
   *
   * @param {filterObject} [filter] - (optional) The filter settings to be applied on the result
   * @returns {string[]} An array of IRIs representing all vocabulary EnumerationMember
   */
  getListOfEnumerationMembers(filter = undefined) {
    return this.util.applyFilter(
      Object.keys(this.graph.enumerationMembers),
      filter,
      this.graph
    );
  }

  /**
   * Returns key-value pairs of the vocabularies used in this SDOAdapter
   *
   * @returns {object} An object containing the key-value pairs representing the used vocabularies
   */
  getVocabularies() {
    const vocabKeys = Object.keys(this.graph.context);
    const result = {};
    const blacklist = ["soa", "xsd", "rdf", "rdfa", "rdfs", "dc"]; // standard vocabs that should not be exposed
    for (let i = 0; i < vocabKeys.length; i++) {
      if (this.util.isString(this.graph.context[vocabKeys[i]])) {
        if (blacklist.indexOf(vocabKeys[i]) === -1) {
          result[vocabKeys[i]] = this.graph.context[vocabKeys[i]];
        }
      }
    }
    return result;
  }

  /**
   * Creates a URL pointing to the Schema.org vocabulary (the wished version can be specified). This URL can then be added to the SDOAdapter to retrieve the Schema.org vocabulary. Invalid version argument will result in errors, check https://schema.org/docs/developers.html for more information
   * To achieve this, the Schema.org version listing on https://raw.githubusercontent.com/schemaorg/schemaorg/main/versions.json is used.
   *
   * @param {string} [version = latest] - the wished Schema.org vocabulary version for the resulting URL (e.g. "5.0", "3.7", or "latest"). default: "latest"
   * @returns {Promise<string>} The URL to the Schema.org vocabulary
   */
  async constructSDOVocabularyURL(version = "latest") {
    if (version === "latest") {
      try {
        if (!this.retrievalMemory.versionsFile) {
          // retrieve versionFile if needed (checks for latest and valid version)
          await this.getSDOVersionFile();
        }
        version = this.retrievalMemory.latest;
      } catch (e) {
        console.error(
          "Could not determine/retrieve the latest version of schema.org"
        );
        throw e;
      }
    }
    const fileName = this.util.getFileNameForSchemaOrgVersion(
      version,
      this.schemaHttps
    ); // This can throw an error if the version is <= 3.0
    return this.getReleasesURI() + version + "/" + fileName;
    // e.g. "https://raw.githubusercontent.com/schemaorg/schemaorg/main/data/releases/3.9/all-layers.jsonld";
  }

  /**
   * Retrieves the schema.org version listing at https://raw.githubusercontent.com/schemaorg/schemaorg/main/versions.json
   * and saves it in the local memory. Also sends head-requests to determine if the 'latest' version is really 'fetch-able'.
   * If not, this head-requests are done again for older versions until the latest valid version is determined and saved in the memory.
   *
   * @returns {Promise<boolean>} Returns true when the process ends
   */
  async getSDOVersionFile() {
    let versionFile;
    // 1. retrieve versions file
    try {
      versionFile = await axios.get(this.getVersionFileURI());
    } catch (e) {
      this.onError(
        "Unable to retrieve the schema.org versions file at " +
          this.getVersionFileURI()
      );
      throw e;
    }
    // 2. determine the latest valid version
    if (versionFile && versionFile.data) {
      this.retrievalMemory.versionsFile = versionFile.data;
      if (this.retrievalMemory.versionsFile.schemaversion) {
        if (
          await this.checkURL(
            await this.constructSDOVocabularyURL(
              this.retrievalMemory.versionsFile.schemaversion
            )
          )
        ) {
          this.retrievalMemory.latest =
            this.retrievalMemory.versionsFile.schemaversion;
        } else {
          // If the version stated as latest by schema.org doesnt exist, then try the other versions given in the release log until we find a valid one
          if (this.retrievalMemory.versionsFile.releaseLog) {
            const sortedArray = this.util.sortReleaseEntriesByDate(
              this.retrievalMemory.versionsFile.releaseLog
            );
            // Sort release entries by the date. latest is first in array
            for (const currVersion of sortedArray) {
              if (
                await this.checkURL(
                  await this.constructSDOVocabularyURL(currVersion[0])
                )
              ) {
                this.retrievalMemory.latest = currVersion[0];
                break;
              }
            }
          }
          if (!this.retrievalMemory.latest) {
            let errMsg =
              'Could not find any valid vocabulary file in the Schema.org versions file (to be declared as "latest".';
            this.onError(errMsg);
            throw new Error(errMsg);
          }
        }
        return true;
      }
      let errMsg = "Schema.org versions file has an unexpected structure!";
      this.onError(errMsg + " -> " + this.getVersionFileURI());
      throw new Error(errMsg);
    }
    return true;
  }

  /**
   * Sends a head-request to the given URL, checking if content exists.
   *
   * @param {string} url - the URL to check
   * @returns {Promise<boolean>} Returns true if there is content
   */
  async checkURL(url) {
    try {
      await axios.head(url);
      return true;
    } catch (e) {
      return false;
    }
  }

  /**
   * Returns the latest version number of the schema.org vocabulary
   * To achieve this, the Schema.org version listing on https://raw.githubusercontent.com/schemaorg/schemaorg/main/versions.json is used.
   *
   * @returns {Promise<string>} The latest version of the schema.org vocabulary
   */
  async getLatestSDOVersion() {
    if (!this.retrievalMemory.latest) {
      // retrieve versions file if needed (checks for latest and valid version)
      await this.getSDOVersionFile();
    }
    return this.retrievalMemory.latest;
  }

  /**
   * Returns the base part of respective release URI
   *
   * @returns {string} The base part of respective release URI
   */
  getReleasesURI() {
    return this.commitBase
      ? "https://raw.githubusercontent.com/schemaorg/schemaorg/" +
          this.commitBase +
          "/data/releases/"
      : URI_SEMANTIFY_RELEASES;
  }

  /**
   * Returns the URI of the respective versions file
   *
   * @returns {string} The URI of the respective versions file
   */
  getVersionFileURI() {
    return this.commitBase
      ? "https://raw.githubusercontent.com/schemaorg/schemaorg/" +
          this.commitBase +
          "/versions.json"
      : URI_SEMANTIFY_VERSIONS;
  }
}

module.exports = SDOAdapter;

},{"./Class":79,"./DataType":80,"./Enumeration":81,"./EnumerationMember":82,"./Graph":83,"./Property":84,"./Term":87,"./utilities":88,"axios":1}],87:[function(require,module,exports){
const Graph = require("./Graph");

// the functions for a term Object
class Term {
  /**
   * A vocabulary term. It is identified by its IRI.
   *
   * @class
   * @param {string} IRI - The compacted IRI of this Term
   * @param {Graph} graph - The underlying data graph to enable the methods of this Term
   */
  constructor(IRI, graph) {
    this.IRI = IRI;
    this.graph = graph;
    this.util = require("./utilities");
  }

  /**
   * Retrieves the IRI (@id) of this Term in compact/absolute form
   *
   * @param {boolean} [compactForm = false] - if true -> return compact IRI -> "schema:Friday", if false -> return absolute IRI -> "http://schema.org/Friday" (default: false)
   * @returns {string} The IRI (@id) of this Term
   */
  getIRI(compactForm = false) {
    if (compactForm) {
      return this.IRI;
    }
    return this.util.toAbsoluteIRI(this.IRI, this.graph.context);
  }

  /**
   * Retrieves the term type (@type) of this Term
   *
   * @abstract
   * @returns {string} The term type of this Term
   */
  getTermType() {
    throw new Error("must be implemented by subclass!");
  }

  /**
   * Retrieves the term object of this Term
   *
   * @abstract
   * @returns {string} The term object of this Term
   */
  getTermObj() {
    throw new Error("must be implemented by subclass!");
  }

  /**
   * Retrieves the original vocabulary urls of this Term
   *
   * @returns {Array|null} The original vocabulary urls of this Term
   */
  getVocabURLs() {
    let termObj = this.getTermObj();
    if (!this.util.isNil(termObj["vocabURLs"])) {
      return termObj["vocabURLs"];
    }
    return null;
  }

  /**
   * Retrieves the original vocabulary (schema:isPartOf) of this Term
   *
   * @returns {?string} The vocabulary IRI given by the "schema:isPartOf" of this Term
   */
  getVocabulary() {
    let termObj = this.getTermObj();
    if (!this.util.isNil(termObj["schema:isPartOf"])) {
      return termObj["schema:isPartOf"];
    }
    return null;
  }

  /**
   * Retrieves the source (dc:source) of this Term
   *
   * @returns {string|Array|null} The source IRI given by the "dc:source" of this Term (null if none)
   */
  getSource() {
    let termObj = this.getTermObj();
    if (!this.util.isNil(termObj["dc:source"])) {
      return termObj["dc:source"];
    } else if (!this.util.isNil(termObj["schema:source"])) {
      return termObj["schema:source"];
    }
    return null;
  }

  /**
   * Retrieves the Term superseding (schema:supersededBy) this Term
   *
   * @returns {?string} The Term superseding this Term (null if none)
   */
  isSupersededBy() {
    let termObj = this.getTermObj();
    if (this.util.isString(termObj["schema:supersededBy"])) {
      return termObj["schema:supersededBy"];
    }
    return null;
  }

  /**
   * Retrieves the name (rdfs:label) of this Term in a wished language (optional)
   *
   * @param {string} [language = en] - the wished language for the name (default = "en")
   * @returns {?string} The name of this Term (null if not given for specified language)
   */
  getName(language = "en") {
    let termObj = this.getTermObj()["rdfs:label"];
    if (this.util.isNil(termObj) || this.util.isNil(termObj[language])) {
      return null;
    }
    return termObj[language];
  }

  /**
   * Retrieves the description (rdfs:comment) of this Term in a wished language (optional)
   *
   * @param {string} [language = en] - the wished language for the description (default = "en")
   * @returns {?string} The description of this Term (null if not given for specified language)
   */
  getDescription(language = "en") {
    let termObj = this.getTermObj()["rdfs:comment"];
    if (this.util.isNil(termObj) || this.util.isNil(termObj[language])) {
      return null;
    }
    return termObj[language];
  }

  /**
   * Generates a string representation of this Term (Based on its JSON representation)
   *
   * @returns {string} The string representation of this Term
   */
  toString() {
    return JSON.stringify(this.toJSON(false, null), null, 2);
  }

  /**
   * Generates a JSON representation of this Term
   *
   * @returns {object} The JSON representation of this Term
   */
  toJSON() {
    const result = {};
    result["id"] = this.getIRI(true);
    result["IRI"] = this.getIRI();
    result["type"] = this.getTermType();
    result["vocabURLs"] = this.getVocabURLs();
    result["vocabulary"] = this.getVocabulary();
    result["source"] = this.getSource();
    result["supersededBy"] = this.isSupersededBy();
    result["name"] = this.getName();
    result["description"] = this.getDescription();
    return result;
  }
}

module.exports = Term;

},{"./Graph":83,"./utilities":88}],88:[function(require,module,exports){
const jsonld = require("jsonld");
// eslint-disable-next-line no-unused-vars
const Graph = require("./Graph");

/**
 * @typedef filterObject
 * @type {object}
 * @property {boolean} [isSuperseded] - defines the superseded status for the filter (true: only terms that are superseded, false: only terms that are NOT superseded)
 * @property {string|string[]} [fromVocabulary] - defines a set of allowed vocabularies for the filter - vocabularies are given as indicators (e.g. "schema")
 * @property {string|string[]} [termType] - defines a set of allowed term types for the filter (e.g. "Class", "Property")
 */

/**
 * Applies a filter to the IRIs in the given Array
 *
 * @param {string[]} dataArray - Array of IRIs that should be filtered
 * @param {filterObject} filter - The filter settings used to filter the dataArray (can be undefined to return all data back)
 * @param {Graph} graph - the graph calling this function
 * @returns {string[]} Array of IRIs that are in compliance with the given filter options
 */
function applyFilter(dataArray, filter, graph) {
  if (
    !Array.isArray(dataArray) ||
    dataArray.length === 0 ||
    !filter ||
    Object.keys(filter).length === 0
  ) {
    return dataArray;
  }
  const result = [];
  // check if given value is absolute IRI, if yes, get the vocab indicator for it
  const context = graph.context;
  if (isString(filter.fromVocabulary)) {
    for (const actKey of Object.keys(context)) {
      if (context[actKey] === filter.fromVocabulary) {
        filter.fromVocabulary = actKey;
        break;
      }
    }
  } else if (isArray(filter.fromVocabulary)) {
    for (let v = 0; v < filter.fromVocabulary.length; v++) {
      for (let vi = 0; vi < Object.keys(context).length; vi++) {
        if (context[Object.keys(context)[vi]] === filter.fromVocabulary[v]) {
          filter.fromVocabulary[v] = Object.keys(context)[vi];
          break;
        }
      }
    }
  }
  // check for every term, if it passes the filter conditions
  for (let i = 0; i < dataArray.length; i++) {
    const actualTerm = graph.getTerm(dataArray[i]);
    // superseded
    if (filter.isSuperseded !== undefined) {
      if (
        filter.isSuperseded === false &&
        actualTerm.isSupersededBy() != null
      ) {
        continue; // skip this element
      } else if (
        filter.isSuperseded === true &&
        actualTerm.isSupersededBy() == null
      ) {
        continue; // skip this element
      }
    }
    // partOf - vocabularies are given as indicators (e.g. "schema")
    if (filter.fromVocabulary) {
      let matchFound = false;
      if (isString(filter.fromVocabulary)) {
        if (filter.fromVocabulary)
          if (actualTerm.getIRI(true).startsWith(filter.fromVocabulary)) {
            matchFound = true;
          }
      } else if (isArray(filter.fromVocabulary)) {
        for (let v = 0; v < filter.fromVocabulary.length; v++) {
          if (actualTerm.getIRI(true).startsWith(filter.fromVocabulary[v])) {
            matchFound = true;
          }
        }
      }
      if (!matchFound) {
        continue; // skip this element
      }
    }
    // termType
    if (filter.termType) {
      let matchFound = false;
      let toCheck = [];
      if (isString(filter.termType)) {
        toCheck.push(filter.termType);
      } else if (isArray(filter.termType)) {
        toCheck = filter.termType;
      }
      for (let t = 0; t < toCheck.length; t++) {
        let typeIRI;
        switch (toCheck[t]) {
          case "Class":
            typeIRI = "rdfs:Class";
            break;
          case "Property":
            typeIRI = "rdf:Property";
            break;
          case "Enumeration":
            typeIRI = "schema:Enumeration";
            break;
          case "EnumerationMember":
            typeIRI = "soa:EnumerationMember";
            break;
          case "DataType":
            typeIRI = "schema:DataType";
            break;
          default:
            throw new Error("Invalid filter.termType " + toCheck[t]);
        }
        if (typeIRI === actualTerm.getTermType()) {
          matchFound = true;
          break;
        }
      }
      if (!matchFound) {
        continue; // skip this element
      }
    }

    result.push(dataArray[i]);
  }
  return result;
}

/**
 * Creates a copy-by-value of a JSON element
 *
 * @param {any} element - the JSON element that should be copied
 * @returns {any} copy of the given JSON element
 */
function copByVal(element) {
  if (element === undefined) {
    return undefined; // causes error for JSON functions
  }
  return JSON.parse(JSON.stringify(element));
}

/**
 * Checks if the given input is a JS object
 *
 * @param {any} value - the input element to check
 * @returns {boolean} true if the given input is a JS object
 */
function isObject(value) {
  if (Array.isArray(value)) {
    return false;
  }
  if (isNil(value)) {
    return false;
  }
  return typeof value === "object";
}

/**
 * Checks if the given input is undefined or null
 *
 * @param {any} value - the input element to check
 * @returns {boolean} true if the given input is undefined or null
 */
function isNil(value) {
  return value === undefined || value === null;
}

/**
 * Checks if the given input is a string
 *
 * @param {any} value - the input element to check
 * @returns {boolean} true if the given input is a string
 */
function isString(value) {
  if (isNil(value)) {
    return false;
  }
  return typeof value === "string" || value instanceof String;
}

/**
 * Checks if the given input is a JS array
 *
 * @param {any} value - the input element to check
 * @returns {boolean} true if the given input is a JS array
 */
function isArray(value) {
  return Array.isArray(value);
}

//
/**
 * Removes duplicates from a given Array
 *
 * @param {Array} array - the input array
 * @returns {Array} the input array without duplicates
 */
function uniquifyArray(array) {
  const seen = {};
  const result = [];
  for (const item of array) {
    if (!seen[item]) {
      seen[item] = 1;
      result.push(item);
    }
  }
  return result;
}

/**
 * Merges 2 JSON-LD context objects into a new one
 *
 * @param {object} currentContext - the first context object
 * @param {object} newContext - the second context object
 * @returns {object} the resulting context object
 */
function generateContext(currentContext, newContext) {
  const keysCurrentContext = Object.keys(currentContext);
  const keysNewContext = Object.keys(newContext);
  // add all of the old context
  let resultContext = copByVal(currentContext);
  // add vocabs of new context that are not already used (value is URI)
  for (const keyNC of keysNewContext) {
    if (isString(newContext[keyNC])) {
      // first: check if the URI is already used, with any indicator
      let foundMatch = false;
      for (const keyCC of keysCurrentContext) {
        if (isString(resultContext[keyCC])) {
          if (resultContext[keyCC] === newContext[keyNC]) {
            // found match, the URI is already covered
            foundMatch = true;
            break;
          }
        }
      }
      if (foundMatch) {
        continue; // URI is already covered, continue with next
      }
      if (!resultContext[keyNC]) {
        // add new vocab indicator
        resultContext[keyNC] = newContext[keyNC];
      } else {
        // check if the URI is the same, if not: add new uri under new vocab indicator
        if (resultContext[keyNC] !== newContext[keyNC]) {
          let foundFreeName = false;
          let counter = 1;
          while (foundFreeName === false) {
            const newVocabIndicator = keyNC + counter++;
            if (!resultContext[newVocabIndicator]) {
              foundFreeName = true;
              resultContext[newVocabIndicator] = newContext[keyNC];
            }
          }
        }
      }
    }
  }
  // sort vocab URIs by alphabet
  const ordered = {};
  Object.keys(resultContext)
    .sort()
    .forEach(function (key) {
      ordered[key] = resultContext[key];
    });
  // reorder context: Vocab Indicators first (value = string), then term handlers (value = object)
  resultContext = ordered;
  const keysResultContext = Object.keys(resultContext);
  const orderedResultContext = {};
  // add the Vocab Indicators (value = string)
  for (const keyRC of keysResultContext) {
    if (isString(resultContext[keyRC])) {
      orderedResultContext[keyRC] = resultContext[keyRC];
    }
  }
  // add the term handlers (value = object)
  for (const keyRC of keysResultContext) {
    if (isObject(resultContext[keyRC])) {
      orderedResultContext[keyRC] = resultContext[keyRC];
    }
  }
  return orderedResultContext;
}

/**
 * Transforms a given vocabulary to a wished format (including a given JSON-LD context)
 *
 * @param {object} vocab - the vocabulary to process
 * @param {object} newContext - the wished JSON-LD context that the vocabulary should have
 * @returns {object} the transformed vocabulary
 */
async function preProcessVocab(vocab, newContext) {
  // recursively put all nodes from inner @graphs to the outermost @graph (is the case for older schema.jsonld versions)
  let foundInnerGraph = false;
  do {
    const newGraph = [];
    foundInnerGraph = false;
    for (let i = 0; i < vocab["@graph"].length; i++) {
      if (vocab["@graph"][i]["@graph"] !== undefined) {
        newGraph.push(...copByVal(vocab["@graph"][i]["@graph"])); // copy all elements of the inner @graph into the outer @graph
        foundInnerGraph = true;
      } else {
        newGraph.push(copByVal(vocab["@graph"][i])); // copy this element to the outer @graph
      }
    }
    vocab["@graph"] = copByVal(newGraph);
  } while (foundInnerGraph === true);

  // compact to apply the new context (which is supposed to have been merged before with the old context through the function generateContext())
  // option "graph": true not feasible here, because then vocabs with "@id" result in inner @graphs again
  // solution: edge case handling (see below)
  const compactedVocab = await jsonld.compact(vocab, newContext);

  // edge case: @graph had only one node, so values of @graph are in outermost layer
  if (compactedVocab["@graph"] === undefined) {
    delete compactedVocab["@context"];
    return {
      "@context": newContext,
      "@graph": [compactedVocab],
    };
  } else {
    return compactedVocab;
  }
}

/**
 * Processes a given vocabulary node to a wished format (we call this process "curation")
 *
 * @param {object} vocabNode - the input vocabulary node
 * @param {Array} vocabularies - the vocabularies used by the graph so far
 * @returns {object} the curated node
 */
function curateVocabNode(vocabNode, vocabularies) {
  if (vocabNode["rdfs:comment"] !== undefined) {
    // make a vocab object with "en" as the standard value
    if (isString(vocabNode["rdfs:comment"])) {
      // standard -> "en"
      vocabNode["rdfs:comment"] = {
        en: vocabNode["rdfs:comment"],
      };
    } else if (isObject(vocabNode["rdfs:comment"])) {
      const newVal = {};
      newVal[vocabNode["rdfs:comment"]["@language"]] =
        vocabNode["rdfs:comment"]["@value"];
      vocabNode["rdfs:comment"] = copByVal(newVal);
    } else if (isArray(vocabNode["rdfs:comment"])) {
      const newVal = {};
      for (let i = 0; i < vocabNode["rdfs:comment"].length; i++) {
        if (isObject(vocabNode["rdfs:comment"][i])) {
          newVal[vocabNode["rdfs:comment"][i]["@language"]] =
            vocabNode["rdfs:comment"][i]["@value"];
        }
      }
      vocabNode["rdfs:comment"] = copByVal(newVal);
    }
  } else {
    vocabNode["rdfs:comment"] = {};
  }
  if (vocabNode["rdfs:label"] !== undefined) {
    // make a vocab object with "en" as the standard value
    if (isString(vocabNode["rdfs:label"])) {
      // "rdfs:label": "transcript"
      // standard -> "en"
      vocabNode["rdfs:label"] = {
        en: vocabNode["rdfs:label"],
      };
    } else if (isObject(vocabNode["rdfs:label"])) {
      // "rdfs:label": {
      //   "@language": "en",
      //   "@value": "translationOfWork"
      // }
      const newVal = {};
      newVal[vocabNode["rdfs:label"]["@language"]] =
        vocabNode["rdfs:label"]["@value"];
      vocabNode["rdfs:label"] = copByVal(newVal);
    } else if (isArray(vocabNode["rdfs:label"])) {
      // "rdfs:label": [{
      //   "@language": "en",
      //   "@value": "translationOfWork"
      // },
      // {
      //   "@language": "de",
      //   "@value": "UebersetzungsArbeit"
      // }]
      const newVal = {};
      for (let i = 0; i < vocabNode["rdfs:label"].length; i++) {
        if (isObject(vocabNode["rdfs:label"][i])) {
          newVal[vocabNode["rdfs:label"][i]["@language"]] =
            vocabNode["rdfs:label"][i]["@value"];
        }
      }
      vocabNode["rdfs:label"] = copByVal(newVal);
    }
  } else {
    vocabNode["rdfs:label"] = {};
  }
  // make arrays for some terms in any case
  if (isString(vocabNode["rdfs:subClassOf"])) {
    vocabNode["rdfs:subClassOf"] = [vocabNode["rdfs:subClassOf"]];
  } else if (
    vocabNode["rdfs:subClassOf"] === undefined &&
    vocabNode["@type"] === "rdfs:Class"
  ) {
    vocabNode["rdfs:subClassOf"] = [];
  }
  if (isString(vocabNode["rdfs:subPropertyOf"])) {
    vocabNode["rdfs:subPropertyOf"] = [vocabNode["rdfs:subPropertyOf"]];
  } else if (
    vocabNode["rdfs:subPropertyOf"] === undefined &&
    vocabNode["@type"] === "rdf:Property"
  ) {
    vocabNode["rdfs:subPropertyOf"] = [];
  }
  if (isString(vocabNode["schema:domainIncludes"])) {
    vocabNode["schema:domainIncludes"] = [vocabNode["schema:domainIncludes"]];
  } else if (
    vocabNode["schema:domainIncludes"] === undefined &&
    vocabNode["@type"] === "rdf:Property"
  ) {
    vocabNode["schema:domainIncludes"] = [];
  }
  if (isString(vocabNode["schema:rangeIncludes"])) {
    vocabNode["schema:rangeIncludes"] = [vocabNode["schema:rangeIncludes"]];
  } else if (
    vocabNode["schema:rangeIncludes"] === undefined &&
    vocabNode["@type"] === "rdf:Property"
  ) {
    vocabNode["schema:rangeIncludes"] = [];
  }
  if (
    vocabNode["schema:inverseOf"] === undefined &&
    vocabNode["@type"] === "rdf:Property"
  ) {
    vocabNode["schema:inverseOf"] = null;
  }
  if (!isString(vocabNode["schema:isPartOf"])) {
    const vocabKeys = Object.keys(vocabularies);
    let vocab;
    for (let i = 0; i < vocabKeys.length; i++) {
      if (
        vocabNode["@id"].substring(0, vocabNode["@id"].indexOf(":")) ===
        vocabKeys[i]
      ) {
        vocab = vocabularies[vocabKeys[i]];
        break;
      }
    }
    if (vocab !== undefined) {
      let newChange;
      do {
        newChange = false;
        if (vocab.endsWith("/") || vocab.endsWith("#")) {
          vocab = vocab.substring(0, vocab.length - 1);
          newChange = true;
        }
      } while (newChange === true);
      vocabNode["schema:isPartOf"] = vocab;
    }
  }
  return vocabNode;
}

/*
term - A term is a short word defined in a context that MAY be expanded to an IRI
compact IRI - A compact IRI has the form of prefix:suffix and is used as a way of expressing an IRI without needing to define separate term definitions for each IRI contained within a common vocabulary identified by prefix.
prefix - A prefix is the first component of a compact IRI which comes from a term that maps to a string that, when prepended to the suffix of the compact IRI results in an absolute IRI. */

/**
 * Returns the compact IRI from a given absolute IRI and a corresponding context. If the context does not contain the used namespace, then 'null' is returned
 *
 * @param {string} absoluteIRI - the absolute IRI to transform
 * @param {object} context - the context object holding key-value pairs that represent indicator-namespace pairs
 * @param {boolean} [equateVocabularyProtocols = false] - treats namespaces as equal even if their protocols (http/https) are different, it defaults to false.
 * @returns {?string} the compact IRI (null, if given context does not contain the used namespace)
 */
function toCompactIRI(absoluteIRI, context, equateVocabularyProtocols = false) {
  for (const contextTerm of Object.keys(context)) {
    const vocabIRI = context[contextTerm];
    if (isString(vocabIRI) && absoluteIRI.startsWith(vocabIRI)) {
      return contextTerm + ":" + absoluteIRI.substring(vocabIRI.length);
    }
    if (equateVocabularyProtocols && isString(vocabIRI)) {
      const protocolSwitchedIRI = switchIRIProtocol(vocabIRI);
      if (absoluteIRI.startsWith(protocolSwitchedIRI)) {
        return (
          contextTerm + ":" + absoluteIRI.substring(protocolSwitchedIRI.length)
        );
      }
    }
  }
  return null;
}

/**
 * Returns the absolute IRI from a given compact IRI and a corresponding context. If the context does not contain the used namespace, then 'null' is returned
 *
 * @param {string} compactIRI - the compact IRI to transform
 * @param {object} context - the context object holding key-value pairs that represent indicator-namespace pairs
 * @returns {?string} the absolute IRI (null, if given context does not contain the used namespace)
 */
function toAbsoluteIRI(compactIRI, context) {
  const terms = Object.keys(context);
  for (let i = 0; i < terms.length; i++) {
    const vocabIRI = context[terms[i]];
    if (compactIRI.substring(0, compactIRI.indexOf(":")) === terms[i]) {
      return vocabIRI.concat(compactIRI.substring(compactIRI.indexOf(":") + 1));
    }
  }
  return null;
}

/**
 * Returns a sorted Array of Arrays that have a schema.org vocabulary version as first entry and it's release date as second entry. Latest is first in array.
 *
 * @param {object} releaseLog - the releaseLog object from the versionsFile of schema.org
 * @returns {Array} - Array with sorted release Arrays -> [version, date]
 */
function sortReleaseEntriesByDate(releaseLog) {
  let versionEntries = Object.entries(releaseLog);
  return versionEntries.sort((a, b) => new Date(b[1]) - new Date(a[1]));
}

/**
 * Returns the jsonld filename that holds the schema.org vocabulary for a given version.
 *
 * @param {string} version - the schema.org version
 * @param {boolean} [schemaHttps = true] - use https as protocol for the schema.org vocabulary - works only from version 9.0 upwards
 * @returns {string} - the corresponding jsonld filename
 */
function getFileNameForSchemaOrgVersion(version, schemaHttps = true) {
  switch (version) {
    case "2.0":
    case "2.1":
    case "2.2":
    case "3.0":
      throw new Error("There is no jsonld file for that schema.org version.");
    case "3.1":
    case "3.2":
    case "3.3":
    case "3.4":
    case "3.5":
    case "3.6":
    case "3.7":
    case "3.8":
    case "3.9":
    case "4.0":
    case "5.0":
    case "6.0":
    case "7.0":
    case "7.01":
    case "7.02":
    case "7.03":
    case "7.04":
    case "8.0":
      return "all-layers.jsonld";
    case "9.0":
      if (schemaHttps) {
        return "schemaorg-all-https.jsonld";
      } else {
        return "schemaorg-all-http.jsonld";
      }
    default:
      // this is expected for newer releases that are not covered yet
      if (schemaHttps) {
        return "schemaorg-all-https.jsonld";
      } else {
        return "schemaorg-all-http.jsonld";
      }
  }
}

/**
 * Returns the protocol version used for schema.org in the given vocabulary. Returns "https" as the default
 *
 * @param {object} vocabulary - the vocabulary in question
 * @returns {?string} - the corresponding protocol version, either "http" or "https"
 */
function discoverUsedSchemaOrgProtocol(vocabulary) {
  const httpsIRI = "https://schema.org/";
  const httpIRI = "http://schema.org/";
  // 1. check if namespace is used in @context
  if (vocabulary["@context"]) {
    for (const contextEntry of Object.values(vocabulary["@context"])) {
      if (isObject(contextEntry) && contextEntry["@vocab"]) {
        if (contextEntry["@vocab"] === httpsIRI) {
          return "https";
        } else if (contextEntry["@vocab"] === httpIRI) {
          return "http";
        }
      } else if (isString(contextEntry)) {
        if (contextEntry === httpsIRI) {
          return "https";
        } else if (contextEntry === httpIRI) {
          return "http";
        }
      }
    }
  }
  // 2. easiest way -> make a string and count occurrences for each protocol version
  const stringifiedVocab = JSON.stringify(vocabulary);
  const amountHttps = stringifiedVocab.split(httpsIRI).length - 1;
  const amountHttp = stringifiedVocab.split(httpIRI).length - 1;
  if (amountHttps > amountHttp) {
    return "https";
  } else if (amountHttp > amountHttps) {
    return "http";
  } else {
    return httpsIRI; // default case
  }
}

/**
 * Checks if the given vocabulary uses terms (in context or content) that are present in the current given context but with another protocol (http/https), and returns those in a list
 *
 * @param {object} currentContext - the current context
 * @param {object} vocabulary - the vocabulary to be analyzed
 * @returns {string[]} - an array with the found equate namespaces
 */
function discoverEquateNamespaces(currentContext, vocabulary) {
  let result = new Set();
  // 1. Make List of protocol switched namespaces from the current context
  let protocolSwitchedNamespaces = [];
  Object.values(currentContext).forEach(function (el) {
    if (isString(el)) {
      protocolSwitchedNamespaces.push(switchIRIProtocol(el));
    }
  });
  // 2. Look in vocabulary context if any protocol switched namespaces are present
  if (vocabulary["@context"]) {
    Object.values(vocabulary["@context"]).forEach(function (el) {
      if (isString(el) && protocolSwitchedNamespaces.includes(el)) {
        result.add(el);
      }
    });
  }
  // 3. Look in vocabulary content if any protocol switched namespaces are present (everywhere, where @ids are expected)
  if (Array.isArray(vocabulary["@graph"])) {
    vocabulary["@graph"].forEach(function (vocabNode) {
      checkIfNamespaceFromListIsUsed(
        vocabNode["@id"],
        protocolSwitchedNamespaces,
        result
      );
      checkIfNamespaceFromListIsUsed(
        vocabNode["@type"],
        protocolSwitchedNamespaces,
        result
      );
      // super class
      checkIfNamespaceFromListIsUsed(
        vocabNode["rdfs:subClassOf"],
        protocolSwitchedNamespaces,
        result
      );
      checkIfNamespaceFromListIsUsed(
        vocabNode["http://www.w3.org/2000/01/rdf-schema#subClassOf"],
        protocolSwitchedNamespaces,
        result
      );
      // domain class
      checkIfNamespaceFromListIsUsed(
        vocabNode["schema:domainIncludes"],
        protocolSwitchedNamespaces,
        result
      );
      checkIfNamespaceFromListIsUsed(
        vocabNode["http://schema.org/domainIncludes"],
        protocolSwitchedNamespaces,
        result
      );
      checkIfNamespaceFromListIsUsed(
        vocabNode["https://schema.org/domainIncludes"],
        protocolSwitchedNamespaces,
        result
      );
      // range class
      checkIfNamespaceFromListIsUsed(
        vocabNode["schema:rangeIncludes"],
        protocolSwitchedNamespaces,
        result
      );
      checkIfNamespaceFromListIsUsed(
        vocabNode["http://schema.org/rangeIncludes"],
        protocolSwitchedNamespaces,
        result
      );
      checkIfNamespaceFromListIsUsed(
        vocabNode["https://schema.org/rangeIncludes"],
        protocolSwitchedNamespaces,
        result
      );
      // super property
      checkIfNamespaceFromListIsUsed(
        vocabNode["rdfs:subPropertyOf"],
        protocolSwitchedNamespaces,
        result
      );
      checkIfNamespaceFromListIsUsed(
        vocabNode["http://www.w3.org/2000/01/rdf-schema#subPropertyOf"],
        protocolSwitchedNamespaces,
        result
      );
      // inverse property
      checkIfNamespaceFromListIsUsed(
        vocabNode["schema:inverseOf"],
        protocolSwitchedNamespaces,
        result
      );
      checkIfNamespaceFromListIsUsed(
        vocabNode["http://schema.org/inverseOf"],
        protocolSwitchedNamespaces,
        result
      );
      checkIfNamespaceFromListIsUsed(
        vocabNode["https://schema.org/inverseOf"],
        protocolSwitchedNamespaces,
        result
      );
    });
  }
  return Array.from(result);
}

/**
 * Checks if the value includes an absolute IRI that is present in the given namespaceArray. If so, that match is added to the given result Set.
 *
 * @param {any} value - the value to check, is expected to be either an array, an object, or a string.
 * @param {string[]} namespaceArray - an array of IRIs to search for
 * @param {Set} result - a Set to save the found matches
 */
function checkIfNamespaceFromListIsUsed(value, namespaceArray, result) {
  if (Array.isArray(value)) {
    value.forEach(function (val) {
      checkIfNamespaceFromListIsUsed(val, namespaceArray, result);
    });
  } else {
    let toCheck;
    if (isObject(value) && isString(value["@id"])) {
      toCheck = value["@id"];
    } else if (isString(value)) {
      toCheck = value;
    }
    if (isString(toCheck) && toCheck.startsWith("http")) {
      let match = namespaceArray.find((el) => toCheck.startsWith(el));
      if (match && !result.has(match)) {
        result.add(match);
      }
    }
  }
}

/**
 * Returns the given absolute IRI, but with the opposite protocol (http vs. https)
 *
 * @param  {string}IRI - the IRI that should be transformed
 * @returns {string} - the resulting transformed IRI
 */
function switchIRIProtocol(IRI) {
  if (IRI.startsWith("https://")) {
    return "http" + IRI.substring(5);
  } else if (IRI.startsWith("http://")) {
    return "https" + IRI.substring(4);
  }
  return IRI;
}

module.exports = {
  applyFilter,
  copByVal,
  isArray,
  isString,
  isObject,
  isNil,
  uniquifyArray,
  preProcessVocab,
  generateContext,
  curateVocabNode,
  toCompactIRI,
  toAbsoluteIRI,
  sortReleaseEntriesByDate,
  getFileNameForSchemaOrgVersion,
  discoverUsedSchemaOrgProtocol,
  discoverEquateNamespaces,
  switchIRIProtocol,
};

},{"./Graph":83,"jsonld":58}],89:[function(require,module,exports){
(function (process,global){(function (){
(function (global, undefined) {
    "use strict";

    if (global.setImmediate) {
        return;
    }

    var nextHandle = 1; // Spec says greater than zero
    var tasksByHandle = {};
    var currentlyRunningATask = false;
    var doc = global.document;
    var registerImmediate;

    function setImmediate(callback) {
      // Callback can either be a function or a string
      if (typeof callback !== "function") {
        callback = new Function("" + callback);
      }
      // Copy function arguments
      var args = new Array(arguments.length - 1);
      for (var i = 0; i < args.length; i++) {
          args[i] = arguments[i + 1];
      }
      // Store and register the task
      var task = { callback: callback, args: args };
      tasksByHandle[nextHandle] = task;
      registerImmediate(nextHandle);
      return nextHandle++;
    }

    function clearImmediate(handle) {
        delete tasksByHandle[handle];
    }

    function run(task) {
        var callback = task.callback;
        var args = task.args;
        switch (args.length) {
        case 0:
            callback();
            break;
        case 1:
            callback(args[0]);
            break;
        case 2:
            callback(args[0], args[1]);
            break;
        case 3:
            callback(args[0], args[1], args[2]);
            break;
        default:
            callback.apply(undefined, args);
            break;
        }
    }

    function runIfPresent(handle) {
        // From the spec: "Wait until any invocations of this algorithm started before this one have completed."
        // So if we're currently running a task, we'll need to delay this invocation.
        if (currentlyRunningATask) {
            // Delay by doing a setTimeout. setImmediate was tried instead, but in Firefox 7 it generated a
            // "too much recursion" error.
            setTimeout(runIfPresent, 0, handle);
        } else {
            var task = tasksByHandle[handle];
            if (task) {
                currentlyRunningATask = true;
                try {
                    run(task);
                } finally {
                    clearImmediate(handle);
                    currentlyRunningATask = false;
                }
            }
        }
    }

    function installNextTickImplementation() {
        registerImmediate = function(handle) {
            process.nextTick(function () { runIfPresent(handle); });
        };
    }

    function canUsePostMessage() {
        // The test against `importScripts` prevents this implementation from being installed inside a web worker,
        // where `global.postMessage` means something completely different and can't be used for this purpose.
        if (global.postMessage && !global.importScripts) {
            var postMessageIsAsynchronous = true;
            var oldOnMessage = global.onmessage;
            global.onmessage = function() {
                postMessageIsAsynchronous = false;
            };
            global.postMessage("", "*");
            global.onmessage = oldOnMessage;
            return postMessageIsAsynchronous;
        }
    }

    function installPostMessageImplementation() {
        // Installs an event handler on `global` for the `message` event: see
        // * https://developer.mozilla.org/en/DOM/window.postMessage
        // * http://www.whatwg.org/specs/web-apps/current-work/multipage/comms.html#crossDocumentMessages

        var messagePrefix = "setImmediate$" + Math.random() + "$";
        var onGlobalMessage = function(event) {
            if (event.source === global &&
                typeof event.data === "string" &&
                event.data.indexOf(messagePrefix) === 0) {
                runIfPresent(+event.data.slice(messagePrefix.length));
            }
        };

        if (global.addEventListener) {
            global.addEventListener("message", onGlobalMessage, false);
        } else {
            global.attachEvent("onmessage", onGlobalMessage);
        }

        registerImmediate = function(handle) {
            global.postMessage(messagePrefix + handle, "*");
        };
    }

    function installMessageChannelImplementation() {
        var channel = new MessageChannel();
        channel.port1.onmessage = function(event) {
            var handle = event.data;
            runIfPresent(handle);
        };

        registerImmediate = function(handle) {
            channel.port2.postMessage(handle);
        };
    }

    function installReadyStateChangeImplementation() {
        var html = doc.documentElement;
        registerImmediate = function(handle) {
            // Create a <script> element; its readystatechange event will be fired asynchronously once it is inserted
            // into the document. Do so, thus queuing up the task. Remember to clean up once it's been called.
            var script = doc.createElement("script");
            script.onreadystatechange = function () {
                runIfPresent(handle);
                script.onreadystatechange = null;
                html.removeChild(script);
                script = null;
            };
            html.appendChild(script);
        };
    }

    function installSetTimeoutImplementation() {
        registerImmediate = function(handle) {
            setTimeout(runIfPresent, 0, handle);
        };
    }

    // If supported, we should attach to the prototype of global, since that is where setTimeout et al. live.
    var attachTo = Object.getPrototypeOf && Object.getPrototypeOf(global);
    attachTo = attachTo && attachTo.setTimeout ? attachTo : global;

    // Don't get fooled by e.g. browserify environments.
    if ({}.toString.call(global.process) === "[object process]") {
        // For Node.js before 0.9
        installNextTickImplementation();

    } else if (canUsePostMessage()) {
        // For non-IE10 modern browsers
        installPostMessageImplementation();

    } else if (global.MessageChannel) {
        // For web workers, where supported
        installMessageChannelImplementation();

    } else if (doc && "onreadystatechange" in doc.createElement("script")) {
        // For IE 6–8
        installReadyStateChangeImplementation();

    } else {
        // For older browsers
        installSetTimeoutImplementation();
    }

    attachTo.setImmediate = setImmediate;
    attachTo.clearImmediate = clearImmediate;
}(typeof self === "undefined" ? typeof global === "undefined" ? this : global : self));

}).call(this)}).call(this,require('_process'),typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"_process":68}],90:[function(require,module,exports){
(function (setImmediate,clearImmediate){(function (){
var nextTick = require('process/browser.js').nextTick;
var apply = Function.prototype.apply;
var slice = Array.prototype.slice;
var immediateIds = {};
var nextImmediateId = 0;

// DOM APIs, for completeness

exports.setTimeout = function() {
  return new Timeout(apply.call(setTimeout, window, arguments), clearTimeout);
};
exports.setInterval = function() {
  return new Timeout(apply.call(setInterval, window, arguments), clearInterval);
};
exports.clearTimeout =
exports.clearInterval = function(timeout) { timeout.close(); };

function Timeout(id, clearFn) {
  this._id = id;
  this._clearFn = clearFn;
}
Timeout.prototype.unref = Timeout.prototype.ref = function() {};
Timeout.prototype.close = function() {
  this._clearFn.call(window, this._id);
};

// Does not start the time, just sets up the members needed.
exports.enroll = function(item, msecs) {
  clearTimeout(item._idleTimeoutId);
  item._idleTimeout = msecs;
};

exports.unenroll = function(item) {
  clearTimeout(item._idleTimeoutId);
  item._idleTimeout = -1;
};

exports._unrefActive = exports.active = function(item) {
  clearTimeout(item._idleTimeoutId);

  var msecs = item._idleTimeout;
  if (msecs >= 0) {
    item._idleTimeoutId = setTimeout(function onTimeout() {
      if (item._onTimeout)
        item._onTimeout();
    }, msecs);
  }
};

// That's not how node.js implements it but the exposed api is the same.
exports.setImmediate = typeof setImmediate === "function" ? setImmediate : function(fn) {
  var id = nextImmediateId++;
  var args = arguments.length < 2 ? false : slice.call(arguments, 1);

  immediateIds[id] = true;

  nextTick(function onNextTick() {
    if (immediateIds[id]) {
      // fn.call() is faster so we optimize for the common use-case
      // @see http://jsperf.com/call-apply-segu
      if (args) {
        fn.apply(null, args);
      } else {
        fn.call(null);
      }
      // Prevent ids from leaking
      exports.clearImmediate(id);
    }
  });

  return id;
};

exports.clearImmediate = typeof clearImmediate === "function" ? clearImmediate : function(id) {
  delete immediateIds[id];
};
}).call(this)}).call(this,require("timers").setImmediate,require("timers").clearImmediate)
},{"process/browser.js":68,"timers":90}],91:[function(require,module,exports){
'use strict'
module.exports = function (Yallist) {
  Yallist.prototype[Symbol.iterator] = function* () {
    for (let walker = this.head; walker; walker = walker.next) {
      yield walker.value
    }
  }
}

},{}],92:[function(require,module,exports){
'use strict'
module.exports = Yallist

Yallist.Node = Node
Yallist.create = Yallist

function Yallist (list) {
  var self = this
  if (!(self instanceof Yallist)) {
    self = new Yallist()
  }

  self.tail = null
  self.head = null
  self.length = 0

  if (list && typeof list.forEach === 'function') {
    list.forEach(function (item) {
      self.push(item)
    })
  } else if (arguments.length > 0) {
    for (var i = 0, l = arguments.length; i < l; i++) {
      self.push(arguments[i])
    }
  }

  return self
}

Yallist.prototype.removeNode = function (node) {
  if (node.list !== this) {
    throw new Error('removing node which does not belong to this list')
  }

  var next = node.next
  var prev = node.prev

  if (next) {
    next.prev = prev
  }

  if (prev) {
    prev.next = next
  }

  if (node === this.head) {
    this.head = next
  }
  if (node === this.tail) {
    this.tail = prev
  }

  node.list.length--
  node.next = null
  node.prev = null
  node.list = null

  return next
}

Yallist.prototype.unshiftNode = function (node) {
  if (node === this.head) {
    return
  }

  if (node.list) {
    node.list.removeNode(node)
  }

  var head = this.head
  node.list = this
  node.next = head
  if (head) {
    head.prev = node
  }

  this.head = node
  if (!this.tail) {
    this.tail = node
  }
  this.length++
}

Yallist.prototype.pushNode = function (node) {
  if (node === this.tail) {
    return
  }

  if (node.list) {
    node.list.removeNode(node)
  }

  var tail = this.tail
  node.list = this
  node.prev = tail
  if (tail) {
    tail.next = node
  }

  this.tail = node
  if (!this.head) {
    this.head = node
  }
  this.length++
}

Yallist.prototype.push = function () {
  for (var i = 0, l = arguments.length; i < l; i++) {
    push(this, arguments[i])
  }
  return this.length
}

Yallist.prototype.unshift = function () {
  for (var i = 0, l = arguments.length; i < l; i++) {
    unshift(this, arguments[i])
  }
  return this.length
}

Yallist.prototype.pop = function () {
  if (!this.tail) {
    return undefined
  }

  var res = this.tail.value
  this.tail = this.tail.prev
  if (this.tail) {
    this.tail.next = null
  } else {
    this.head = null
  }
  this.length--
  return res
}

Yallist.prototype.shift = function () {
  if (!this.head) {
    return undefined
  }

  var res = this.head.value
  this.head = this.head.next
  if (this.head) {
    this.head.prev = null
  } else {
    this.tail = null
  }
  this.length--
  return res
}

Yallist.prototype.forEach = function (fn, thisp) {
  thisp = thisp || this
  for (var walker = this.head, i = 0; walker !== null; i++) {
    fn.call(thisp, walker.value, i, this)
    walker = walker.next
  }
}

Yallist.prototype.forEachReverse = function (fn, thisp) {
  thisp = thisp || this
  for (var walker = this.tail, i = this.length - 1; walker !== null; i--) {
    fn.call(thisp, walker.value, i, this)
    walker = walker.prev
  }
}

Yallist.prototype.get = function (n) {
  for (var i = 0, walker = this.head; walker !== null && i < n; i++) {
    // abort out of the list early if we hit a cycle
    walker = walker.next
  }
  if (i === n && walker !== null) {
    return walker.value
  }
}

Yallist.prototype.getReverse = function (n) {
  for (var i = 0, walker = this.tail; walker !== null && i < n; i++) {
    // abort out of the list early if we hit a cycle
    walker = walker.prev
  }
  if (i === n && walker !== null) {
    return walker.value
  }
}

Yallist.prototype.map = function (fn, thisp) {
  thisp = thisp || this
  var res = new Yallist()
  for (var walker = this.head; walker !== null;) {
    res.push(fn.call(thisp, walker.value, this))
    walker = walker.next
  }
  return res
}

Yallist.prototype.mapReverse = function (fn, thisp) {
  thisp = thisp || this
  var res = new Yallist()
  for (var walker = this.tail; walker !== null;) {
    res.push(fn.call(thisp, walker.value, this))
    walker = walker.prev
  }
  return res
}

Yallist.prototype.reduce = function (fn, initial) {
  var acc
  var walker = this.head
  if (arguments.length > 1) {
    acc = initial
  } else if (this.head) {
    walker = this.head.next
    acc = this.head.value
  } else {
    throw new TypeError('Reduce of empty list with no initial value')
  }

  for (var i = 0; walker !== null; i++) {
    acc = fn(acc, walker.value, i)
    walker = walker.next
  }

  return acc
}

Yallist.prototype.reduceReverse = function (fn, initial) {
  var acc
  var walker = this.tail
  if (arguments.length > 1) {
    acc = initial
  } else if (this.tail) {
    walker = this.tail.prev
    acc = this.tail.value
  } else {
    throw new TypeError('Reduce of empty list with no initial value')
  }

  for (var i = this.length - 1; walker !== null; i--) {
    acc = fn(acc, walker.value, i)
    walker = walker.prev
  }

  return acc
}

Yallist.prototype.toArray = function () {
  var arr = new Array(this.length)
  for (var i = 0, walker = this.head; walker !== null; i++) {
    arr[i] = walker.value
    walker = walker.next
  }
  return arr
}

Yallist.prototype.toArrayReverse = function () {
  var arr = new Array(this.length)
  for (var i = 0, walker = this.tail; walker !== null; i++) {
    arr[i] = walker.value
    walker = walker.prev
  }
  return arr
}

Yallist.prototype.slice = function (from, to) {
  to = to || this.length
  if (to < 0) {
    to += this.length
  }
  from = from || 0
  if (from < 0) {
    from += this.length
  }
  var ret = new Yallist()
  if (to < from || to < 0) {
    return ret
  }
  if (from < 0) {
    from = 0
  }
  if (to > this.length) {
    to = this.length
  }
  for (var i = 0, walker = this.head; walker !== null && i < from; i++) {
    walker = walker.next
  }
  for (; walker !== null && i < to; i++, walker = walker.next) {
    ret.push(walker.value)
  }
  return ret
}

Yallist.prototype.sliceReverse = function (from, to) {
  to = to || this.length
  if (to < 0) {
    to += this.length
  }
  from = from || 0
  if (from < 0) {
    from += this.length
  }
  var ret = new Yallist()
  if (to < from || to < 0) {
    return ret
  }
  if (from < 0) {
    from = 0
  }
  if (to > this.length) {
    to = this.length
  }
  for (var i = this.length, walker = this.tail; walker !== null && i > to; i--) {
    walker = walker.prev
  }
  for (; walker !== null && i > from; i--, walker = walker.prev) {
    ret.push(walker.value)
  }
  return ret
}

Yallist.prototype.splice = function (start, deleteCount, ...nodes) {
  if (start > this.length) {
    start = this.length - 1
  }
  if (start < 0) {
    start = this.length + start;
  }

  for (var i = 0, walker = this.head; walker !== null && i < start; i++) {
    walker = walker.next
  }

  var ret = []
  for (var i = 0; walker && i < deleteCount; i++) {
    ret.push(walker.value)
    walker = this.removeNode(walker)
  }
  if (walker === null) {
    walker = this.tail
  }

  if (walker !== this.head && walker !== this.tail) {
    walker = walker.prev
  }

  for (var i = 0; i < nodes.length; i++) {
    walker = insert(this, walker, nodes[i])
  }
  return ret;
}

Yallist.prototype.reverse = function () {
  var head = this.head
  var tail = this.tail
  for (var walker = head; walker !== null; walker = walker.prev) {
    var p = walker.prev
    walker.prev = walker.next
    walker.next = p
  }
  this.head = tail
  this.tail = head
  return this
}

function insert (self, node, value) {
  var inserted = node === self.head ?
    new Node(value, null, node, self) :
    new Node(value, node, node.next, self)

  if (inserted.next === null) {
    self.tail = inserted
  }
  if (inserted.prev === null) {
    self.head = inserted
  }

  self.length++

  return inserted
}

function push (self, item) {
  self.tail = new Node(item, self.tail, null, self)
  if (!self.head) {
    self.head = self.tail
  }
  self.length++
}

function unshift (self, item) {
  self.head = new Node(item, null, self.head, self)
  if (!self.tail) {
    self.tail = self.head
  }
  self.length++
}

function Node (value, prev, next, list) {
  if (!(this instanceof Node)) {
    return new Node(value, prev, next, list)
  }

  this.list = list
  this.value = value

  if (prev) {
    prev.next = this
    this.prev = prev
  } else {
    this.prev = null
  }

  if (next) {
    next.prev = this
    this.next = next
  } else {
    this.next = null
  }
}

try {
  // add if support for Symbol.iterator is present
  require('./iterator.js')(Yallist)
} catch (er) {}

},{"./iterator.js":91}],93:[function(require,module,exports){
const SDOAdapter = require("schema-org-adapter");
const DsUtilities = require("ds-utilities");
const DSBrowserIFrameContent = require("./templates/DSBrowserIFrameContent.js");
const Util = require("./Util");
const DSHandler = require("./DSHandler");

const SharedFunctions = require("./SharedFunctions.js");
const ListView = require("./views/ListView.js");
const SHACLView = require("./views/SHACLView.js");
const NativeView = require("./views/NativeView.js");
const TreeView = require("./views/TreeView.js");

class DSBrowser {
  constructor(params) {
    this.dsCache = {}; // cache for already fetched DS - if already opened DS is viewed, it has not to be fetched again
    this.sdoCache = []; // cache for already created SDO Adapter - if already used vocabulary combination is needed, it has not to be initialized again
    this.util = new Util(this);
    this.dsHandler = new DSHandler(this);

    this.sharedFunctions = new SharedFunctions(this);
    this.listView = new ListView(this);
    this.shaclView = new SHACLView(this);
    this.nativeView = new NativeView(this);
    this.treeView = new TreeView(this);

    this.editFunction = params.editFunction;
    this.targetElement = params.targetElement;
    this.locationControl = params.locationControl !== false;
    this.selfFileHost = params.selfFileHost === true; // if this is true, the list and ds files are being fetched from the same host where the ds browser is being served (e.g. to make localhost/staging work). Makes only sense if locationControl = true
    if (this.locationControl) {
      // if locationControl is true -> read parameters from URL - the ds browser is assumed to be at the domain level of a url (not inside a path /something/ ) and have complete control over the routes /ds/* and /list/*
      this.readStateFromUrl();
    } else {
      // if locationControl is false -> read parameters from initialization, at least dsId or listId must be given!
      this.listId = params.listId || null;
      this.dsId = params.dsId || null;
      this.path = params.path || null;
      this.viewMode = params.viewMode || null;
      this.format = params.format || null;
    }

    // the desired size of the iFrame -> the standard height for the iFrame is given by the containing element, if any (must be a set height property). Else the standard height of 100% of the viewport is assumed
    this.frameSize = this.targetElement.style.height
      ? this.targetElement.style.height
      : "100vh";

    if (this.locationControl) {
      window.addEventListener("popstate", async () => {
        this.readStateFromUrl();
        await this.render();
      });
    }
    this.initIFrame();
    console.log(this); // todo delete debug
  }

  async initIFrame() {
    this.targetElement.innerHTML = this.frame();
    this.dsbFrame = document.getElementById("ds-browser-iframe");
    this.dsbFrame.style.height = this.frameSize;
    this.dsbContext = this.dsbFrame.contentWindow.document;
    this.dsbContext.open();
    this.dsbContext.write(DSBrowserIFrameContent);
    this.dsbContext.close();
    // give the browser some time to render the iFrame
    setTimeout(
      function () {
        this.dsbContainer = this.dsbContext.getElementById(
          "ds-browser-main-container"
        );
        this.render();
      }.bind(this),
      250
    );
  }

  // returns the html frame for this element, which is required to be rendered in a later point of the process
  frame() {
    return `<div><iframe id="ds-browser-iframe" width="100%" frameborder="0" scrolling="no"></iframe></div>`;
  }

  async render() {
    this.dsbContainer.innerHTML = this.util.createHtmlLoading();
    await this.renderInit();
    if (this.format === "shacl") {
      // render raw SHACL of DS
      this.shaclView.render();
    } else if (
      this.dsId &&
      this.viewMode !== "tree" &&
      this.viewMode !== "table"
    ) {
      // render DS with native view
      this.nativeView.render();
    } else if (this.dsId && this.viewMode === "tree") {
      // render DS with tree view
      this.treeView.render();
    } else if (this.listId) {
      // render List as table
      this.listView.render();
    } else {
      throw new Error("Input parameters invalid.");
    }
    this.addJSLinkEventListener();
    document.body.scrollTop = document.documentElement.scrollTop = 0;
  }

  async renderInit() {
    // Init List
    if (
      this.listId &&
      (!this.list || !this.list["@id"].endsWith(this.listId))
    ) {
      await this.initList();
    }
    // Init DS
    if (
      this.dsId &&
      (!this.ds || !this.util.getDSRootNode(this.ds)["@id"].endsWith(this.dsId))
    ) {
      await this.initDS();
      // Init DS Node
    }
    if (this.ds) {
      this.dsRootNode = this.util.getDSRootNode(this.ds);
      this.dsNode = this.dsHandler.getDSNodeForPath();
    }
  }

  async initList() {
    this.list = await this.util.parseToObject(
      this.util.getFileHost() + "/list/" + this.listId + "?representation=lean"
    );
  }

  async initDS() {
    if (this.dsCache[this.dsId]) {
      this.ds = this.dsCache[this.dsId].populated;
      this.dsUnpopulated = this.dsCache[this.dsId].unpopulated;
    } else {
      let ds = await this.util.parseToObject(
        this.util.getFileHost() + "/ds/" + this.dsId + "?populate=true"
      );

      let dsUnpopulated;
      const myDsUtil = DsUtilities.getDsUtilitiesForDs(ds);
      if (myDsUtil.getDsSpecificationVersion(ds) === "5.0") {
        ds = await this.util.parseToObject(
          this.util.getFileHost() +
            "/api/v2/domainspecifications/dsv7/" +
            this.dsId +
            "?populate=true"
        );
        this.dsUnpopulated = null;
      } else {
        dsUnpopulated = await this.util.parseToObject(
          this.util.getFileHost() + "/ds/" + this.dsId + "?populate=false"
        );
      }
      this.dsCache[this.dsId] = {};
      this.dsCache[this.dsId].populated = ds;
      this.dsCache[this.dsId].unpopulated = dsUnpopulated;
      this.ds = ds;
      this.dsUnpopulated = dsUnpopulated;
    }
    if (!this.sdoAdapter) {
      // create an empty sdo adapter at the start in order to create vocabulary URLs
      this.sdoAdapter = new SDOAdapter({ schemaHttps: true });
    }
    const neededVocabUrls = await this.getVocabUrlsForDS();
    let sdoAdapterNeeded = this.util.getSdoAdapterFromCache(neededVocabUrls);
    if (!sdoAdapterNeeded) {
      sdoAdapterNeeded = new SDOAdapter({
        schemaHttps: true,
        equateVocabularyProtocols: true,
      });
      await sdoAdapterNeeded.addVocabularies(neededVocabUrls);
      this.sdoCache.push({
        vocabUrls: neededVocabUrls,
        sdoAdapter: sdoAdapterNeeded,
      });
    }
    this.dsUtil = DsUtilities.getDsUtilitiesForDs(this.ds);
    this.sdoAdapter = sdoAdapterNeeded;
  }

  /**
   * Extracts the URLs needed for the SDO-Adapter to handle the data of the given DS
   * @return {[String]} - The Array of URLs where the vocabularies can be fetched (for the SDO Adapter)
   */
  async getVocabUrlsForDS() {
    if (!this.ds) {
      return [];
    }
    let vocabs = [];
    const dsRootNode = this.util.getDSRootNode(this.ds);
    if (dsRootNode && Array.isArray(dsRootNode["ds:usedVocabulary"])) {
      vocabs = this.util.cloneJson(dsRootNode["ds:usedVocabulary"]);
    }
    if (dsRootNode && dsRootNode["schema:schemaVersion"]) {
      const sdoVersion = this.getSDOVersion(dsRootNode["schema:schemaVersion"]);
      vocabs.push(await this.sdoAdapter.constructSDOVocabularyURL(sdoVersion));
    }
    return vocabs;
  }

  getSDOVersion(schemaVersionValue) {
    if (schemaVersionValue.startsWith("http")) {
      let versionRegex = /.*schema\.org\/version\/([0-9.]+)\//g;
      let match = versionRegex.exec(schemaVersionValue);
      if (match && match[1]) {
        return match[1];
      }
    }
    return schemaVersionValue;
  }

  /**
   * Add an 'EventListener' to every JavaScript link in the HTML element.
   * Depending on the user action, the link will either open a new window or trigger the 'render' method.
   */
  addJSLinkEventListener() {
    const aJSLinks = this.dsbContext.getElementsByClassName("a-js-link");
    for (const aJSLink of aJSLinks) {
      // forEach() not possible for HTMLCollections
      aJSLink.addEventListener("click", async (event) => {
        if (this.locationControl) {
          if (event.ctrlKey) {
            window.open(aJSLink.href); // disabled in non control location
          } else {
            history.pushState(null, null, aJSLink.href); // disabled in non control location
            this.navigate(
              JSON.parse(
                decodeURIComponent(aJSLink.getAttribute("data-state-changes"))
              )
            );
            // await this.render();
          }
        } else {
          this.navigate(
            JSON.parse(
              decodeURIComponent(aJSLink.getAttribute("data-state-changes"))
            )
          );
        }
      });
    }
  }

  readStateFromUrl() {
    const searchParams = new URLSearchParams(window.location.search);
    this.path = searchParams.get("path") || null;
    // fix for MTE path in url -> " + " is written as "%20+%20" which is not correctly returned by the URLSearchParams class
    if (this.path && this.path.includes("   ")) {
      this.path = this.path.replace(new RegExp(" {3}", "g"), " + ");
    }
    this.format = searchParams.get("format") || null;
    this.viewMode = searchParams.get("mode") || null;
    if (window.location.pathname.includes("/ds/")) {
      this.listId = null;
      let dsId = window.location.pathname.substring("/ds/".length);
      if (this.dsId !== dsId) {
        this.dsId = dsId;
        this.ds = null;
        this.dsUnpopulated = null;
      }
    } else if (window.location.pathname.includes("/list/")) {
      let listId = window.location.pathname.substring("/list/".length);
      if (this.listId !== listId) {
        this.listId = listId;
        this.list = null;
      }
      let dsId = searchParams.get("ds") || null;
      if (this.dsId !== dsId) {
        this.dsId = dsId;
        this.ds = null;
        this.dsUnpopulated = null;
      }
    } else {
      this.listId = null;
      this.list = null;
      this.dsId = null;
      this.ds = null;
      this.dsUnpopulated = null;
    }
  }

  navigate(newState) {
    if (newState.listId !== undefined) {
      this.listId = newState.listId;
    }
    if (newState.dsId !== undefined) {
      this.dsId = newState.dsId;
    }
    if (newState.path !== undefined) {
      this.path = newState.path;
    }
    if (newState.viewMode !== undefined) {
      this.viewMode = newState.viewMode;
    }
    if (newState.format !== undefined) {
      this.format = newState.format;
    }
    // If there is no listId, there shall be no list
    if (this.listId === null) {
      this.list = undefined;
    }
    // If there is no dsId, there shall be no ds
    if (this.dsId === null) {
      this.ds = undefined;
      this.dsUnpopulated = undefined;
    }
    // If there is no ds, there shall be no path
    if (!this.ds) {
      this.path = null;
    }
    this.render();
  }
}

module.exports = DSBrowser;

},{"./DSHandler":94,"./SharedFunctions.js":95,"./Util":96,"./templates/DSBrowserIFrameContent.js":98,"./views/ListView.js":106,"./views/NativeView.js":107,"./views/SHACLView.js":108,"./views/TreeView.js":109,"ds-utilities":33,"schema-org-adapter":86}],94:[function(require,module,exports){
class DSHandler {
  constructor(browser) {
    this.browser = browser;
    this.util = browser.util;
  }

  getDSNodeForPath() {
    // DSNode is then the corresponding node from the domain specification
    let currentNode = this.browser.dsRootNode;
    let result = {
      type: "",
      node: {},
    };
    // Check if DS provided
    if (currentNode) {
      if (this.browser.path) {
        let pathSteps = this.browser.path.split("-");
        for (let i = 0; i < pathSteps.length; i++) {
          if (pathSteps[i] === "") {
            continue;
          }
          let currPathStepWithoutIndicator;
          if (pathSteps[i].indexOf(":") >= 0) {
            currPathStepWithoutIndicator = pathSteps[i].substring(
              pathSteps[i].indexOf(":") + 1
            );
          } else {
            currPathStepWithoutIndicator = pathSteps[i];
          }
          if (
            currPathStepWithoutIndicator.charAt(0).toUpperCase() ===
            currPathStepWithoutIndicator.charAt(0)
          ) {
            // Is uppercase -> class or Enum
            if (currentNode) {
              currentNode = this.getClass(currentNode["sh:or"], pathSteps[i]);
            }
          } else {
            // Property should not be the last part of an URL, skip to show containing class!
            // Although the redirectCheck() would fire before this function
            if (currentNode && i !== pathSteps.length - 1) {
              currentNode = this.getProperty(
                currentNode["sh:property"],
                pathSteps[i]
              );
            }
          }
        }
        try {
          this.browser.sdoAdapter.getTerm(currentNode["sh:class"][0]);
          if (
            this.browser.sdoAdapter
              .getTerm(currentNode["sh:class"][0])
              .getTermType() === "schema:Enumeration"
          ) {
            result.type = "Enumeration";
          } else {
            result.type = "Class";
          }
        } catch (e) {
          result.type = "error";
        }
      } else {
        // Root class
        result.type = "Class";
      }
    } else {
      // No DS
      result.type = "error";
    }
    result.node = currentNode;
    return result;
  }

  // Get the class or enumeration with that name
  getClass(DSNode, name) {
    for (const orRange of DSNode) {
      if (!orRange["sh:node"]) {
        continue;
      }
      let classNode = this.util.getClassNodeIfExists(orRange);
      if (
        classNode["sh:class"] &&
        this.rangesToString(classNode["sh:class"]) === name
      ) {
        return classNode;
      }
    }
    return null;
  }

  // Get the property with that name
  getProperty(propertyArray, name) {
    return propertyArray.find(
      (el) => this.rangesToString(el["sh:path"]) === name
    );
  }

  // Get the corresponding SDO datatype from a given SHACL XSD datatype
  dataTypeMapperFromSHACL(dataType) {
    switch (dataType) {
      case "xsd:string":
        return "https://schema.org/Text";
      case "rdf:langString":
        return "https://schema.org/Text";
      case "rdf:HTML":
        return "https://schema.org/Text";
      case "xsd:boolean":
        return "https://schema.org/Boolean";
      case "xsd:date":
        return "https://schema.org/Date";
      case "xsd:dateTime":
        return "https://schema.org/DateTime";
      case "xsd:time":
        return "https://schema.org/Time";
      case "xsd:double":
        return "https://schema.org/Number";
      case "xsd:float":
        return "https://schema.org/Float";
      case "xsd:integer":
        return "https://schema.org/Integer";
      case "xsd:anyURI":
        return "https://schema.org/URL";
    }
    return null; // If no match
  }

  // Converts a range array/string into a string usable in functions
  rangesToString(ranges) {
    if (Array.isArray(ranges)) {
      return ranges
        .map((range) => {
          return this.util.prettyPrintIri(range);
        })
        .join(" + ");
    } else {
      return this.util.prettyPrintIri(ranges); // Is already string
    }
  }

  createHtmlCardinality(minCount, maxCount) {
    let title,
      cardinality = "";
    if (minCount && minCount !== 0) {
      if (maxCount && maxCount !== 0) {
        if (minCount !== maxCount) {
          title =
            "This property is required. It must have between " +
            minCount +
            " and " +
            maxCount +
            " value(s).";
          cardinality = minCount + ".." + maxCount;
        } else {
          title =
            "This property is required. It must have " +
            minCount +
            " value(s).";
          cardinality = minCount;
        }
      } else {
        title =
          "This property is required. It must have at least " +
          minCount +
          " value(s).";
        cardinality = minCount + "..N";
      }
    } else {
      if (maxCount && maxCount !== 0) {
        title =
          "This property is optional. It must have at most " +
          maxCount +
          " value(s).";
        cardinality = "0.." + maxCount;
      } else {
        title = "This property is optional. It may have any amount of values.";
        cardinality = "0..N";
      }
    }
    return `<span title="${title}">${cardinality}</span>`;
  }

  generateDsClass(classNode, closed, showOptional, depth = 0) {
    let dsClass = {};
    const targetClass = classNode["sh:targetClass"] || classNode["sh:class"];
    dsClass.text = targetClass
      ? this.util.prettyPrintClassDefinition(targetClass)
      : "";
    dsClass.icon = "glyphicon glyphicon-list-alt";
    if (!closed) {
      dsClass.state = { opened: true };
    }
    let description;
    try {
      if (dsClass.text.indexOf(",") === -1) {
        description = this.util.repairLinksInHTMLCode(
          this.browser.sdoAdapter.getClass(dsClass.text).getDescription()
        );
      } else {
        description = "No description found.";
      }
    } catch (e) {
      description = "No description found.";
    }
    dsClass.data = {};
    dsClass.data.dsDescription = description;
    dsClass.children = this.processChildren(classNode, showOptional, depth + 1);
    return dsClass;
  }

  processChildren(classNode, showOptional, depth) {
    const children = [];
    let propertyNodes = classNode["sh:property"];
    if (propertyNodes) {
      propertyNodes.forEach((propertyNode) => {
        const dsProperty = this.generateDsProperty(
          propertyNode,
          showOptional,
          depth
        );
        if (dsProperty) {
          children.push(dsProperty);
        }
      });
    }
    return children;
  }

  generateDsProperty(propertyObj, showOptional, depth) {
    const dsProperty = {};
    dsProperty.justification = this.util.getLanguageString(
      propertyObj["rdfs:comment"]
    );
    dsProperty.text = this.util.prettyPrintIri(propertyObj["sh:path"]);
    dsProperty.data = {};
    dsProperty.data.minCount = propertyObj["sh:minCount"];
    dsProperty.data.maxCount = propertyObj["sh:maxCount"];
    dsProperty.children = [];

    this.processEnum(dsProperty, propertyObj["sh:or"][0]);
    this.processVisibility(dsProperty, propertyObj["sh:minCount"]);
    this.processRanges(dsProperty, propertyObj["sh:or"], showOptional, depth);

    if (showOptional) {
      // return -> show property anyway (mandatory and optional)
      return dsProperty;
    } else if (!dsProperty.data.isOptional) {
      // return -> show property only if it is mandatory (not optional)
      return dsProperty;
    } else {
      // dont show
      return null;
    }
  }

  processEnum(dsProperty, shOr) {
    dsProperty.isEnum = false;
    let enuWithSdo;
    try {
      const rangeOfProp = shOr["sh:class"];
      enuWithSdo = this.browser.sdoAdapter.getEnumeration(rangeOfProp);
      dsProperty.isEnum = true;
    } catch (e) {
      /* Ignore */
    }

    if (dsProperty.isEnum) {
      const enuMembersArray = this.getEnumMemberArray(
        shOr["sh:in"],
        enuWithSdo
      );

      // Get description
      enuMembersArray.forEach((eachMember) => {
        const enuMemberDesc = this.browser.sdoAdapter.getEnumerationMember(
          eachMember.name
        );
        eachMember.description = this.util.repairLinksInHTMLCode(
          enuMemberDesc.getDescription()
        );
      });

      dsProperty.data.enuMembers = enuMembersArray;
      dsProperty.children = enuMembersArray.map((enuMem) => {
        return {
          children: [],
          data: {
            dsRange: "",
            dsDescription: this.util.repairLinksInHTMLCode(enuMem.description),
          },
          icon: "glyphicon glyphicon-chevron-right",
          text: enuMem.name,
        };
      });
    }
  }

  getEnumMemberArray(shIn, enuWithSdo) {
    if (shIn) {
      // Objects
      return shIn.map((enuMember) => {
        let enuMemberName = enuMember["@id"];
        enuMemberName = enuMemberName.replace("schema:", "");
        return { name: enuMemberName };
      });
    } else {
      // Strings
      const enuMembersArrayString = enuWithSdo.getEnumerationMembers();
      return enuMembersArrayString.map((enuMemName) => {
        return { name: enuMemName };
      });
    }
  }

  processVisibility(dsProperty, minCount) {
    dsProperty.icon = "glyphicon glyphicon-tag";
    if (!minCount > 0) {
      dsProperty.icon += " optional-property";
      dsProperty.data.isOptional = true;
    } else {
      dsProperty.icon += " mandatory-property";
      dsProperty.data.isOptional = false;
    }
  }

  processRanges(dsProperty, rangeNodes, showOptional, depth) {
    let isOpened = false;
    if (rangeNodes) {
      const dsRange = this.generateDsRange(rangeNodes);
      dsProperty.data.dsRange = dsRange.rangeAsString;

      try {
        const description = this.browser.sdoAdapter
          .getProperty(dsProperty.text)
          .getDescription();
        dsProperty.data.dsDescription =
          this.util.repairLinksInHTMLCode(description);
      } catch (e) {
        dsProperty.data.dsDescription = "No description found.";
      }

      rangeNodes.forEach((rangeNode) => {
        const nodeShape = this.util.getClassNodeIfExists(rangeNode);
        if (nodeShape && nodeShape["sh:class"]) {
          isOpened = true;
          // render children only if we are not too deep already
          if (depth < 8) {
            dsProperty.children.push(
              this.generateDsClass(nodeShape, true, showOptional, depth)
            );
          }
        }
      });
    }
    if (isOpened) {
      dsProperty.state = { opened: true };
    }
  }

  generateDsRange(rangeNodes) {
    let returnObj = {
      rangeAsString: "",
    };
    returnObj.rangeAsString = rangeNodes
      .map((rangeNode) => {
        let name, rangePart;
        const datatype = rangeNode["sh:datatype"];
        const nodeShape = this.util.getClassNodeIfExists(rangeNode);
        const shClass =
          nodeShape && nodeShape["sh:class"] ? nodeShape["sh:class"] : null;
        if (datatype) {
          // Datatype
          name = this.util.prettyPrintIri(
            this.dataTypeMapperFromSHACL(datatype)
          );
          rangePart = name;
        } else if (nodeShape && nodeShape["sh:property"]) {
          // Restricted class
          name = this.util.prettyPrintClassDefinition(shClass);
          rangePart = "<strong>" + name + "</strong>";
        } else {
          // Enumeration
          // Standard class
          name = this.util.prettyPrintClassDefinition(shClass);
          rangePart = name;
        }
        return rangePart;
      })
      .join(" or ");

    return returnObj;
  }
}

module.exports = DSHandler;

},{}],95:[function(require,module,exports){
const NavigationBar = require("./templates/NavigationBar.js");

class SharedFunctions {
  constructor(dsBrowser) {
    this.b = dsBrowser;
  }

  // creates the HTML code for the navigation bar
  getNavigationBarHTML() {
    // List button (show only if a list exists and a DS is currently being shown)
    let listName, listBtnClass, listBtnAttributes;
    if (this.b.listId && this.b.dsId) {
      listBtnClass = "";
      if (this.b.list) {
        listName = this.b.list["schema:name"] || "List";
      }
      listBtnAttributes = this.b.util.createInternalLinkAttributes({
        dsId: null,
      });
    } else {
      listBtnClass = "d-none";
      listBtnAttributes = "";
    }
    // View buttons
    let nativeViewBtnAttributes, nativeViewBtnClass;
    let treeViewBtnAttributes, treeViewBtnClass;
    let shaclViewBtnAttributes, shaclViewBtnClass;
    if (this.b.dsId) {
      nativeViewBtnClass = treeViewBtnClass = "";
      shaclViewBtnClass = "d-sm-flex";
      nativeViewBtnAttributes = this.b.util.createInternalLinkAttributes({
        viewMode: null,
      });
      treeViewBtnAttributes = this.b.util.createInternalLinkAttributes({
        viewMode: "tree",
      });
      shaclViewBtnAttributes = this.b.util.createInternalLinkAttributes({
        format: "shacl",
      });
    } else {
      nativeViewBtnClass = treeViewBtnClass = shaclViewBtnClass = "d-none";
      nativeViewBtnAttributes =
        treeViewBtnAttributes =
        shaclViewBtnAttributes =
          "";
    }
    return NavigationBar.replace(/{{listBtnClass}}/g, listBtnClass)
      .replace(/{{listBtnAttributes}}/g, listBtnAttributes)
      .replace(/{{listName}}/g, listName)
      .replace(/{{nativeViewBtnClass}}/g, nativeViewBtnClass)
      .replace(/{{nativeViewBtnAttributes}}/g, nativeViewBtnAttributes)
      .replace(/{{treeViewBtnClass}}/g, treeViewBtnClass)
      .replace(/{{treeViewBtnAttributes}}/g, treeViewBtnAttributes)
      .replace(/{{shaclViewBtnClass}}/g, shaclViewBtnClass)
      .replace(/{{shaclViewBtnAttributes}}/g, shaclViewBtnAttributes);
  }

  setDsTitleHtml(htmlCode) {
    const rootNode = this.b.dsRootNode;
    const ds = this.b.ds;

    // set ds name in title
    htmlCode = htmlCode.replace(
      /{{dsTitleName}}/g,
      this.b.dsUtil.getDsName(ds)
    );

    // schema:description
    htmlCode = htmlCode.replace(
      /{{dsDescription}}/g,
      this.b.dsUtil.getDsDescription(ds)
    );
    // @id
    htmlCode = htmlCode.replace(/{{dsId}}/g, rootNode["@id"]);
    // sh:targetClass
    const htmlTargetClasses = rootNode["sh:targetClass"]
      .map((c) => {
        return "<li>" + this.b.util.createTermLink(c) + "</li>";
      })
      .join("");
    htmlCode = htmlCode.replace(/{{dsTargetClasses}}/g, htmlTargetClasses);
    // ds:subDSOf
    if (rootNode["ds:subDSOf"]) {
      htmlCode = htmlCode.replace(/{{showSuperDs}}/g, "");
      htmlCode = htmlCode.replace(/{{dsSuperDs}}/g, rootNode["ds:subDSOf"]);
    } else {
      htmlCode = htmlCode.replace(/{{showSuperDs}}/g, "d-none");
      htmlCode = htmlCode.replace(/{{dsSuperDs}}/g, "");
    }
    // schema:schemaVersion
    htmlCode = htmlCode.replace(
      /{{dsSdoVersion}}/g,
      this.b.dsUtil.getDsSchemaVersion(ds)
    );
    // ds:usedVocabulary
    if (rootNode["ds:usedVocabulary"]) {
      htmlCode = htmlCode.replace(/{{showExternalVocabularies}}/g, "");
      const htmlExternalVocabs = rootNode["ds:usedVocabulary"]
        .map((v) => {
          return `<li><a href="${v}" target="_blank">${v}</a></li>`;
        })
        .join("");
      htmlCode = htmlCode.replace(
        /{{dsExternalVocabularies}}/g,
        htmlExternalVocabs
      );
    } else {
      htmlCode = htmlCode.replace(/{{showExternalVocabularies}}/g, "d-none");
      htmlCode = htmlCode.replace(/{{dsExternalVocabularies}}/g, "");
    }
    return htmlCode;
  }
}

module.exports = SharedFunctions;

},{"./templates/NavigationBar.js":105}],96:[function(require,module,exports){
class Util {
  constructor(browser) {
    this.browser = browser;
  }

  async parseToObject(variable) {
    if (this.isString(variable)) {
      /**
       * @type string
       */
      let jsonString;
      if (this.isValidUrl(variable)) {
        jsonString = await this.getJson(variable);
      } else {
        jsonString = variable;
      }
      return JSON.parse(jsonString);
    } else {
      return variable;
    }
  }

  isString(variable) {
    return typeof variable === "string" || variable instanceof String;
  }

  isValidUrl(string) {
    try {
      new URL(string);
    } catch (e) {
      return false;
    }
    return true;
  }

  getJson(url) {
    return new Promise(function (resolve, reject) {
      let xhr = new XMLHttpRequest();
      xhr.open("GET", url);
      xhr.setRequestHeader("Accept", "application/json");
      xhr.onload = function () {
        if (this.status >= 200 && this.status < 300) {
          resolve(xhr.response);
        } else {
          reject({
            status: this.status,
            statusText: xhr.statusText,
          });
        }
      };
      xhr.onerror = function () {
        reject({
          status: this.status,
          statusText: xhr.statusText,
        });
      };
      xhr.send();
    });
  }

  /**
   * Replace 'schema:' and escapes characters in iri.
   *
   * @param {string} iri - The IRI that should pretty-printed.
   * @returns {string} The pretty-printed IRI.
   */
  prettyPrintIri(iri) {
    return iri.replace(/^(schema:|https?:\/\/schema.org\/)(.+)/, "$2");
  }

  repairLinksInHTMLCode(htmlCode) {
    let result = htmlCode;
    // absolute links for schema.org - e.g. https://schema.org/gtin13
    result = result.replace(/https?:\/\/schema.org\/([^,.\s]*)/g, (match) => {
      const style = this.createExternalLinkStyle(match);
      return `<a href="${match}" style="${style}" target="_blank">${match}</a>`;
    });
    // html links (including relative links of schema.org) - e.g. <a class="xyz" href="/Text"> ...
    result = result.replace(
      /<a(.*?)href="(.*?)"/g,
      (match, otherLinkAttributes, url) => {
        if (url.startsWith("/")) {
          url = "http://schema.org" + url;
        }
        const style = this.createExternalLinkStyle(url);
        return `<a ${otherLinkAttributes} href="${url}" style="${style}" target="_blank"`;
      }
    );
    // markdown for relative links of schema.org without label - e.g. [[ImageObject]]
    result = result.replace(/\[\[(.*?)]]/g, (match, term) => {
      const url = "http://schema.org/" + term;
      const style = this.createExternalLinkStyle(url);
      return `<a href="${url}" style="${style}" target="_blank">${term}</a>`;
    });
    // markdown for links (including relative schema.org) with label - e.g. [background notes](/docs/datamodel.html#identifierBg) or [WGS 84](https://en.wikipedia.org/wiki/World_Geodetic_System)
    result = result.replace(/\[(.*?)]\((.*?)\)/g, (match, label, url) => {
      if (url.startsWith("/")) {
        url = "http://schema.org/" + url;
      }
      const style = this.createExternalLinkStyle(url);
      return `<a href="${url}" style="${style}" target="_blank">${label}</a>`;
    });
    // new line
    result = result.replace(/\\n/g, () => {
      return "</br>";
    });
    // markdown for bold
    result = result.replace(/__(.*?)__/g, (match, text) => {
      return `<b>${text}</b>`;
    });
    // markdown for code
    result = result.replace(/```(.*?)```/g, (match, code) => {
      return `<code>${code}</code>`;
    });
    return result;
  }

  // returns following attributes for internal links: href, onclick, data-state-changes
  // internal links MUST have the class a-js-link
  createInternalLinkAttributes(navigationChanges) {
    const hrefLink = this.browser.locationControl
      ? this.createInternalHref(navigationChanges)
      : "javascript:void(0)";
    const htmlOnClick = this.browser.locationControl
      ? 'onclick="return false;"'
      : "";
    const htmlState = encodeURIComponent(JSON.stringify(navigationChanges));
    return `href="${hrefLink}" ${htmlOnClick} data-state-changes="${htmlState}"`;
  }

  createInternalLink(navigationChanges, text) {
    text = this.escHtml(text);
    const hrefLink = this.browser.locationControl
      ? this.createInternalHref(navigationChanges)
      : "javascript:void(0)";
    const htmlOnClick = this.browser.locationControl
      ? 'onclick="return false;"'
      : "";
    const htmlState =
      'data-state-changes="' +
      encodeURIComponent(JSON.stringify(navigationChanges)) +
      '"';
    return `<a class="a-js-link" href="${hrefLink}" ${htmlOnClick} ${htmlState}>
        ${text}</a>`;
  }

  createInternalHref(navigationChanges, htmlEscaped = true) {
    let navigationState = this.createNavigationState(navigationChanges);
    let domain =
      window.location.protocol +
      "//" +
      (window.location.host ? window.location.host : "");
    let url;
    let urlParameterArray = [];
    if (navigationState.listId) {
      // is list
      url = domain + "/list/" + navigationState.listId;
      if (navigationState.dsId) {
        urlParameterArray.push(["ds", navigationState.dsId]);
      }
    } else {
      // must be ds
      url = domain + "/ds/" + navigationState.dsId;
    }
    if (navigationState.path) {
      urlParameterArray.push(["path", navigationState.path]);
    }
    if (navigationState.viewMode) {
      urlParameterArray.push(["mode", navigationState.viewMode]);
    }
    if (navigationState.format) {
      urlParameterArray.push(["format", navigationState.format]);
    }
    for (let i = 0; i < urlParameterArray.length; i++) {
      let prefix = "&";
      if (i === 0) {
        prefix = "?";
      }
      url += prefix + urlParameterArray[i][0] + "=" + urlParameterArray[i][1];
    }
    return htmlEscaped ? this.escHtml(url) : url;
  }

  // creates an object with the navigation "coordinates" constructed from the actual navigation position and a given object containing navigation changes
  createNavigationState(navigationChanges) {
    const parameters = ["listId", "dsId", "path", "viewMode", "format"];
    let newState = {};
    for (const p of parameters) {
      if (navigationChanges[p] !== undefined) {
        newState[p] = navigationChanges[p];
      } else {
        newState[p] = this.browser[p];
      }
    }
    return newState;
  }

  /**
   * Escape HTML characters.
   *
   * @param {string} chars - The characters that should be escaped.
   * @returns {string} The escaped characters.
   */
  escHtml(chars) {
    return chars
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  /**
   * Create HTML attributes for elements.
   *
   * @param {object|null} attr - The attributes as key-value pairs.
   * @returns {string} The resulting HTML.
   */
  createHtmlAttr(attr) {
    if (attr) {
      return Object.entries(attr)
        .map((a) => {
          return " " + this.escHtml(a[0]) + '="' + this.escHtml(a[1]) + '"';
        })
        .join("");
    } else {
      return "";
    }
  }

  /**
   * Create a HTML link to an external IRI.
   *
   * @param {string} href - The href value of the link.
   * @param {string|null} text - The text of the link.
   * @param {object|null} attr - The HTML attributes as key-value pairs.
   * @returns {string} The resulting HTML.
   */
  createLink(href, text = null, attr = null) {
    const urlObj = new URL(href);
    if (
      window.location.hostname !== urlObj.hostname ||
      href.includes("/voc/")
    ) {
      let additionalStyles = " " + this.createExternalLinkStyle(href);

      if (!attr) {
        attr = { style: additionalStyles };
        // eslint-disable-next-line no-prototype-builtins
      } else if (!attr.hasOwnProperty("style")) {
        attr["style"] = additionalStyles;
      } else {
        attr["style"] = attr["style"] + additionalStyles;
      }
      attr["target"] = "_blank";
    }

    return (
      '<a href="' +
      this.escHtml(href) +
      '"' +
      this.createHtmlAttr(attr) +
      ">" +
      (text ? this.prettyPrintIri(text) : this.prettyPrintIri(href)) +
      "</a>"
    );
  }

  /**
   * Create HTML attribute 'style' for an external link.
   *
   * @param iri - The IRI of the external link.
   * @return {string} The resulting style attribute.
   */
  createExternalLinkStyle(iri) {
    let style = `background-position: center right; 
            background-repeat: no-repeat;
            background-size: 10px 10px; 
            padding-right: 13px; `;
    if (/^https?:\/\/schema.org/.test(iri)) {
      style +=
        "background-image: url(https://raw.githubusercontent.com/semantifyit/ds-browser/main/images/external-link-icon-red.png);";
    } else {
      style +=
        "background-image: url(https://raw.githubusercontent.com/semantifyit/ds-browser/main/images/external-link-icon-blue.png);";
    }
    return style;
  }

  createHtmlLoading() {
    return `<div class="d-flex align-items-center justify-content-center" style="height: 100%;">
              <div class="spinner-border text-primary" style="width: 4rem; height: 4rem;" role="status">
                <span class="visually-hidden">Loading...</span>
              </div>
            </div>`;
  }

  createTermLink(term) {
    const termObj = this.browser.sdoAdapter.getTerm(term);
    const vocabURLs = termObj.getVocabURLs();
    let href;
    if (vocabURLs) {
      for (const vocabURL of vocabURLs) {
        if (/http(s)?:\/\/.*?\/voc\//.test(vocabURL)) {
          href = vocabURL + "?term=" + term;
          break;
        }
      }
    }
    href = href ? href : termObj.getIRI();
    return this.createLink(href, termObj.getIRI(true));
  }

  prettyPrintClassDefinition(classDef) {
    // ClassDefinition can be a string, or an array of strings (MTE)
    // ClassDefinition include strings with the vocab indicator in them
    // Remove vocab if it is the standard schema:
    // Return a human readable string of the classDefinition
    if (Array.isArray(classDef)) {
      return classDef
        .map((classDefPart) => {
          return this.prettyPrintIri(classDefPart);
        })
        .join(", ");
    } else {
      return this.prettyPrintIri(classDef);
    }
  }

  getSdoAdapterFromCache(vocabUrls) {
    for (const sdoAdapterCacheEntry of this.browser.sdoCache) {
      let match = true;
      for (const voc1 of vocabUrls) {
        if (!sdoAdapterCacheEntry.vocabUrls.includes(voc1)) {
          match = false;
          break;
        }
      }
      for (const voc2 of sdoAdapterCacheEntry.vocabUrls) {
        if (!vocabUrls.includes(voc2)) {
          match = false;
          break;
        }
      }
      if (match) {
        return sdoAdapterCacheEntry.sdoAdapter;
      }
    }
    return null;
  }

  // creates a clone of the given JSON input (without reference to the original input)
  cloneJson(input) {
    if (input === undefined) {
      return undefined;
    }
    return JSON.parse(JSON.stringify(input));
  }

  getFileHost() {
    if (this.browser.selfFileHost) {
      return window.location.origin;
    } else {
      return "https://semantify.it";
    }
  }

  // Returns a string for a meta-data value. This value is expected to have different language-tagged strings. If not, it is expected to be a string, which is returned.
  getLanguageString(value, preferableLanguage = "en") {
    if (Array.isArray(value)) {
      if (value.length === 0) {
        return null;
      }
      let match = value.find((el) => el["@language"] === preferableLanguage);
      if (!match) {
        match = value[0]; // Take value at first position
      }
      return match["@value"];
    }
    return value;
  }

  // Returns the root node of a given DS, returns null if it couldn't be found
  getDSRootNode(ds) {
    if (ds && Array.isArray(ds["@graph"])) {
      const rootNode = ds["@graph"].find(
        (el) => el["@type"] === "ds:DomainSpecification"
      );
      if (rootNode) {
        return rootNode;
      }
    }
    return null;
  }

  // Returns the referenced node shape
  getReferencedNode(id) {
    if (this.browser.ds && Array.isArray(this.browser.ds["@graph"])) {
      return this.browser.ds["@graph"].find((el) => el["@id"] === id) || null;
    }
    return null;
  }

  // Returns the node shape of the actual range, if the range has a node shape
  getClassNodeIfExists(rangeNode) {
    if (
      rangeNode["sh:node"] &&
      rangeNode["sh:node"]["@id"] &&
      Object.keys(rangeNode["sh:node"]).length === 1
    ) {
      // is referenced node
      return this.getReferencedNode(rangeNode["sh:node"]["@id"]);
    } else if (rangeNode["sh:node"] && rangeNode["sh:node"]["sh:class"]) {
      // is not referenced node
      return rangeNode["sh:node"];
    }
    return undefined;
  }
}

module.exports = Util;

},{}],97:[function(require,module,exports){
const DSBrowserStyles = `/* Common */
.optional-property {
    color: #ffa517;
}

.mandatory-property {
    color: #00ce0c;
}

/* New and used */

#ds-browser-main-container {
    background-color: #f5f5f5;
    height: 100%;
}

#ds-browser-main-container > div.withNav {
    height: calc(100% - 60px);
    margin-top: 60px;
    overflow-y: scroll;
}

#ds-browser-main-container > div.noNav {
    height: 100%;
    overflow-y: scroll;
}`;
module.exports = DSBrowserStyles;

},{}],98:[function(require,module,exports){
const documentStyles = require("./../styles/DSBrowserStyles.js");
const DSBrowserIFrameContent = ` 
<head>
    <!-- Font Awesome -->
    <link
      href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/5.15.1/css/all.min.css"
      rel="stylesheet"
    />
    <!-- Google Fonts -->
    <link
      href="https://fonts.googleapis.com/css?family=Roboto:300,400,500,700&display=swap"
      rel="stylesheet"
    />
    <!-- MDB -->
    <link
      href="https://cdnjs.cloudflare.com/ajax/libs/mdb-ui-kit/3.6.0/mdb.min.css"
      rel="stylesheet"
    />
    <style>
      ${documentStyles}
    </style>
</head>
<body id="ds-browser-main-container">
</body>
<!-- MDB -->
<script
  type="text/javascript"
  src="https://cdnjs.cloudflare.com/ajax/libs/mdb-ui-kit/3.6.0/mdb.min.js"
></script>
`;

module.exports = DSBrowserIFrameContent;

},{"./../styles/DSBrowserStyles.js":97}],99:[function(require,module,exports){
const DsTitle = `
  <div class="row">
    <div class="col-12 mt-3 text-dark">
      <h2 class="mb-0">
        <span>{{dsTitleName}}</span>
        <span><a id="ds-title-btn-edit" class="btn btn-floating btn-sm btn-primary ms-1 mb-1" href="#" role="button"><i class="fas fa-pen"></i></a></span>
      </h2>
    </div>
    <div class="col-12">
      <a id="ds-title-link-details" class="ms-1"
       data-mdb-toggle="collapse" href="#ds-title-details-container" role="button" aria-expanded="false" aria-controls="ds-title-details-container">details <i class="fas fa-caret-down"></i></a>
      <!-- Collapsed content -->
      <div class="collapse mt-1" id="ds-title-details-container">
        <div class="card">
          <div class="card-body p-2 ps-3">
            <table class="table table-sm">
              <tbody>
                <tr>
                  <td colspan="2">{{dsDescription}}</td>
                </tr>
                <tr>
                  <th style="width: 190px;">ID</th>
                  <td><a href="{{dsId}}" target="_blank">{{dsId}}</a></td>
                </tr>
                  <tr class="{{showSuperDs}}">
                  <th>Super-DS</th>
                <td><a href="{{dsSuperDs}}" target="_blank">{{dsSuperDs}}</a></td>
                </tr>
                <tr>
                  <th>Target Class(es)</th>
                  <td class="ps-2"><ul class="m-0">{{dsTargetClasses}}</ul></td>
                </tr>
                </tr>
                <tr>
                  <th>Schema.org version</th>
                  <td>{{dsSdoVersion}}</td>
                </tr>
                <tr class="{{showExternalVocabularies}}">
                  <th>External Vocabularies</th>
                  <td class="ps-2"><ul class="m-0">{{dsExternalVocabularies}}</ul></td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  </div>
`;
module.exports = DsTitle;

},{}],100:[function(require,module,exports){
const ListTableDsRow = `
  <tr>
    <th scope="row">{{ds}}</th>
    <td>{{details}}</td>
  </tr>
`;

module.exports = ListTableDsRow;

},{}],101:[function(require,module,exports){
const NativeTableClassHeader = `
  <thead>
    <tr class="bg-primary text-white align-middle">
      <th scope="col">Property</th>
      <th scope="col" class="text-center" style="width: 115px;">Cardinality</th>
      <th scope="col" class="text-center">Expected Type</th>
      <th scope="col">Description</th>
    </tr>
  </thead>
`;

module.exports = NativeTableClassHeader;

},{}],102:[function(require,module,exports){
const NativeTableClassRow = `
  <tr>
    <th scope="row">{{property}}</th>
    <td class="text-center">{{cardinality}}</td>
    <td class="text-center">{{expectedType}}</td>
    <td>{{details}}</td>
  </tr>
`;

module.exports = NativeTableClassRow;

},{}],103:[function(require,module,exports){
const NativeTableEnumerationHeader = `
  <thead>
    <tr class="bg-primary text-white align-middle">
      <th scope="col">Enumeration Member</th>
      <th scope="col">Description</th>
    </tr>
  </thead>
`;

module.exports = NativeTableEnumerationHeader;

},{}],104:[function(require,module,exports){
const NativeTableEnumerationRow = `
  <tr>
    <th scope="row">{{enumerationMember}}</th>
    <td>{{details}}</td>
  </tr>
`;

module.exports = NativeTableEnumerationRow;

},{}],105:[function(require,module,exports){
const NavigationBar = `
<!-- Navbar-->
<nav class="navbar navbar-expand-lg navbar-light bg-light fixed-top">
  <div class="container-xl justify-content-between">
    <!-- Left elements -->
    <ul class="navbar-nav flex-row d-flex" style="min-width: 100px;">
        <li class="nav-item me-3 me-lg-1">
           <a id="nav-list-button" class="nav-link a-js-link {{listBtnClass}}" {{listBtnAttributes}}">
            <span><i class="far fa-list-alt fa-sm"></i></span>
            <span id="nav-list-button-text">{{listName}}</span>
          </a>
        </li>
    </ul>
    <!-- Left elements -->

    <!-- Center elements -->
    <ul class="navbar-nav flex-row d-flex">
      <li class="nav-item me-3 me-lg-1">
        <a class="nav-link a-js-link {{nativeViewBtnClass}}" {{nativeViewBtnAttributes}}>
         Native view
        </a>
      </li>
      <li class="nav-item me-3 me-lg-1">
        <a class="nav-link a-js-link {{treeViewBtnClass}}" {{treeViewBtnAttributes}}>
          Tree view
        </a>
      </li>
      <li class="nav-item me-3 me-lg-1">
        <a class="nav-link a-js-link" href="#">
          Hierarchy view
        </a>
      </li>
    </ul>
    <!-- Center elements -->

    <!-- Right elements -->
    <ul class="navbar-nav flex-row" style="min-width: 100px;">
      <li class="nav-item me-3 me-lg-1">
        <a class="nav-link align-items-sm-center a-js-link {{shaclViewBtnClass}}" {{shaclViewBtnAttributes}}">
         <span><i class="far fa-file-code fa-sm me-1"></i></span>
           <span>SHACL</span>
        </a>
      </li>
    </ul>
    <!-- Right elements -->
  </div>
</nav>
<!-- Navbar -->
`;

module.exports = NavigationBar;

},{}],106:[function(require,module,exports){
const ListTableDsRow = require("../templates/ListTableDsRow.js");

class ListView {
  constructor(dsBrowser) {
    this.b = dsBrowser;
  }

  render() {
    // creates the html code for this view
    let listViewHtml = this.getFrame();

    // set html for navigationBar
    listViewHtml = listViewHtml.replace(
      /{{navigationBar}}/g,
      this.b.sharedFunctions.getNavigationBarHTML()
    );

    // set list title
    listViewHtml = listViewHtml.replace(
      /{{listTitleName}}/g,
      this.b.list["schema:name"] || "List"
    );

    // set list description
    listViewHtml = listViewHtml.replace(
      /{{listDescription}}/g,
      this.b.list["schema:description"] || "No List description available."
    );

    // set ds table body
    const tableBodyHtml =
      "<tbody>" +
      this.b.list["schema:hasPart"]
        .map((ds) => {
          return this.getDsRowHTML(ds);
        })
        .join("") +
      "</tbody>";
    listViewHtml = listViewHtml.replace(/{{tableBody}}/g, tableBodyHtml);

    // append the view to the DSB main container
    this.b.dsbContainer.innerHTML = listViewHtml;
  }

  // returns the base html code for this view
  getFrame() {
    return `<div id="list-view" class="noNav">
      <!--Page content-->
      <div class="container-xl">
        <!--Title-->
        <div class="row">
          <div class="col-12 mt-4 text-dark">
            <h2 class="mb-0">
              <span>{{listTitleName}}</span>
            </h2>
          </div>
          <div class="col-12 mb-3 mt-2">
             {{listDescription}}
          </div>
        </div>
        <!--Table for DS node Content  -->
        <table class="table bg-light rounded shadow-2">
           <thead>
              <tr class="bg-primary text-white align-middle">
                <th scope="col">Domain Specification</th>
                <th scope="col">Description</th>
              </tr>
           </thead>    
           {{tableBody}}
        </table>
      </div>
    </div>
`;
  }

  // returns the html for a ds row in the list table
  getDsRowHTML(ds) {
    // name as link
    const dsName = ds["schema:name"] || "DS with no name";
    const linkAttributes = this.b.util.createInternalLinkAttributes({
      dsId: ds["@id"].substring(ds["@id"].lastIndexOf("/") + 1),
    });
    const linkHtml = `<a class="a-js-link" ${linkAttributes} >${dsName}</a>`;
    // description
    const details = this.b.util.repairLinksInHTMLCode(ds["schema:description"]);

    return ListTableDsRow.replace(/{{ds}}/g, linkHtml).replace(
      /{{details}}/g,
      details
    );
  }
}

module.exports = ListView;

},{"../templates/ListTableDsRow.js":100}],107:[function(require,module,exports){
const DSTitleFrame = require("../templates/DsTitle.js");
const NativeTableClassHeader = require("../templates/NativeTableClassHeader.js");
const NativeTableClassRow = require("../templates/NativeTableClassRow.js");
const NativeTableEnumerationHeader = require("../templates/NativeTableEnumerationHeader.js");
const NativeTableEnumerationRow = require("../templates/NativeTableEnumerationRow.js");

class NativeView {
  constructor(dsBrowser) {
    this.b = dsBrowser;
  }

  // renders (creates and appends) this view
  render() {
    // creates the html code for this view
    let nativeHtml = this.getFrame();

    // set html for navigationBar
    nativeHtml = nativeHtml.replace(
      /{{navigationBar}}/g,
      this.b.sharedFunctions.getNavigationBarHTML()
    );

    // set ds title
    nativeHtml = this.b.sharedFunctions.setDsTitleHtml(nativeHtml);

    // set ds path breadcrumbs
    nativeHtml = nativeHtml.replace(
      /{{dsPathBreadcrumbs}}/g,
      this.getDsPathBreadcrumbsHTML()
    );

    // set table based on node type
    if (this.b.dsNode.type === "Class") {
      // todo what if standard class ? no sh:property
      nativeHtml = nativeHtml.replace(/{{tableHead}}/g, NativeTableClassHeader);
      const tableBodyHtml =
        "<tbody>" +
        this.b.dsNode.node["sh:property"]
          .map((p) => {
            return this.getPropertyRowHTML(p);
          })
          .join("") +
        "</tbody>";
      nativeHtml = nativeHtml.replace(/{{tableBody}}/g, tableBodyHtml);
    } else {
      // todo what if standard enumeration ? no sh:in
      nativeHtml = nativeHtml.replace(
        /{{tableHead}}/g,
        NativeTableEnumerationHeader
      );
      const tableBodyHtml =
        "<tbody>" +
        this.b.dsNode.node["sh:in"]
          .map((em) => {
            return this.getEnumerationMemberRowHTML(em);
          })
          .join("") +
        "</tbody>";
      nativeHtml = nativeHtml.replace(/{{tableBody}}/g, tableBodyHtml);
    }
    // append the view to the DSB main container
    this.b.dsbContainer.innerHTML = nativeHtml;
  }

  // returns the base html code for this view
  getFrame() {
    return `<div id="native-view" class="withNav">
      <!--Navigation Bar-->
      {{navigationBar}}
      <!--Page content-->
      <div class="container-xl">
        <!--Title-->
        ${DSTitleFrame}
        <!--Breadcrumbs for DS Path-->
        <div class="card my-3 shadow-2">
          <div class="card-body d-flex p-2 align-items-center">
            <div title="Current path within the Domain Specification" class="align-items-center px-2">
              <span><i class="fas fa-code-branch"></i></span>
            </div>
            <div id="native-path" class="align-items-center">{{dsPathBreadcrumbs}}</div>
          </div>
        </div>
        <!--Table for DS node Content  -->
        <table id="native-table" class="table bg-light rounded shadow-2">
          {{tableHead}}
          {{tableBody}}
        </table>
      </div>
    </div>`;
  }

  // returns the html for the ds path breadcrumbs
  getDsPathBreadcrumbsHTML() {
    // create first step of the breadcrumbs (always visible), which is the class of the root node
    let htmlBreadcrumbs = this.b.util.createInternalLink(
      { path: null },
      this.b.dsHandler.rangesToString(this.b.dsRootNode["sh:targetClass"])
    );
    // add additional steps for the breadcrumbs if needed (given by the actual path within the ds)
    if (this.b.path) {
      htmlBreadcrumbs =
        htmlBreadcrumbs +
        " > " +
        this.b.path
          .split("-")
          .map((term, index, pathSplit) => {
            if (index % 2 === 0) {
              // property term
              return term;
            } else {
              // class/enumeration term
              const newPath = pathSplit.slice(0, index + 1).join("-");
              return this.b.util.createInternalLink({ path: newPath }, term);
            }
          })
          .join(" > ");
    }
    return ` <span class="breadcrumbs">${htmlBreadcrumbs}</span>`;
  }

  // returns the html for a property table row
  getPropertyRowHTML(p) {
    let isFromSuperDS = this.isPropertyFromSuperDs(p);
    let iconsHtml = "";
    if (isFromSuperDS) {
      iconsHtml = ` <i class="fas fa-angle-double-down" title="This property originates from the Super-DS"></i>`;
    }
    const propertyLink = this.b.util.createTermLink(p["sh:path"]) + iconsHtml;
    const expectedType = this.createHtmlExpectedTypes(p);
    const details = this.createHtmlPropertyDescription(p);
    const cardinality = this.b.dsHandler.createHtmlCardinality(
      p["sh:minCount"],
      p["sh:maxCount"]
    );
    return NativeTableClassRow.replace(/{{property}}/g, propertyLink)
      .replace(/{{cardinality}}/g, cardinality)
      .replace(/{{expectedType}}/g, expectedType)
      .replace(/{{details}}/g, details);
  }

  isPropertyFromSuperDs(p) {
    // properties from a super ds are only considered for the root node
    // if there is no unpopulated version of the DS it means the DS was not DS-V7 in the first place (no superDS feature)
    if (this.b.path !== null || !this.b.dsUnpopulated) {
      return false;
    }
    const rootNode = this.b.dsUtil.getDsRootNode(this.b.dsUnpopulated);
    const unpopulatedPropertyNode = rootNode["sh:property"].find(
      (propNode) => propNode["sh:path"] === p["sh:path"]
    );
    return unpopulatedPropertyNode !== undefined;
  }

  // returns the html for a enumeration member table row
  getEnumerationMemberRowHTML(em) {
    const emObj = this.b.sdoAdapter.getEnumerationMember(em["@id"]);
    const enumerationMemberLink = this.b.util.createTermLink(em["@id"]);
    const details = this.b.util.repairLinksInHTMLCode(emObj.getDescription());
    return NativeTableEnumerationRow.replace(
      /{{enumerationMember}}/g,
      enumerationMemberLink
    ).replace(/{{details}}/g, details);
  }

  createHtmlExpectedTypes(propertyNode) {
    const property = this.b.sdoAdapter.getProperty(propertyNode["sh:path"]);
    const propertyName = this.b.util.prettyPrintIri(property.getIRI(true));
    return propertyNode["sh:or"]
      .map((rangeNode) => {
        let name;
        let classNode = this.b.util.getClassNodeIfExists(rangeNode);
        if (rangeNode["sh:datatype"]) {
          name = rangeNode["sh:datatype"];
        } else if (classNode && classNode["sh:class"]) {
          name = classNode["sh:class"];
        }
        const mappedDataType = this.b.dsHandler.dataTypeMapperFromSHACL(name);
        if (mappedDataType !== null) {
          let specialName = null;
          if (name === "rdf:langString") {
            specialName = "Localized Text";
          } else if (name === "rdf:HTML") {
            specialName = "HTML Text";
          }
          return this.b.util.createLink(mappedDataType, specialName);
        } else {
          name = this.b.dsHandler.rangesToString(name);
          if (
            classNode &&
            Array.isArray(classNode["sh:property"]) &&
            classNode["sh:property"].length !== 0
          ) {
            // Case: Range is a Restricted Class
            const newPath = this.b.path
              ? this.b.path + "-" + propertyName + "-" + name
              : propertyName + "-" + name;
            return this.b.util.createInternalLink({ path: newPath }, name);
          } else if (
            classNode &&
            classNode["sh:class"] &&
            Array.isArray(classNode["sh:in"])
          ) {
            // Case: Range is a Restricted Enumeration
            const newPath = this.b.path
              ? this.b.path + "-" + propertyName + "-" + name
              : propertyName + "-" + name;
            return this.b.util.createInternalLink({ path: newPath }, name);
          } else {
            // Case: Anything else
            return this.b.util.createTermLink(name);
          }
        }
      })
      .join("<br>");
  }

  createHtmlPropertyDescription(propertyNode) {
    const name = this.b.util.prettyPrintIri(propertyNode["sh:path"]);
    let description;
    try {
      description = this.b.sdoAdapter.getProperty(name).getDescription();
    } catch (e) {
      description = "";
    }
    const dsDescription = propertyNode["rdfs:comment"]
      ? this.b.util.getLanguageString(propertyNode["rdfs:comment"])
      : "";

    let descText = "";
    if (description !== "") {
      if (dsDescription !== "") {
        descText += "<b>From Vocabulary:</b> ";
      }
      descText += description;
    }
    if (dsDescription !== "") {
      if (description !== "") {
        descText += "<br>" + "<b>From Domain Specification:</b> ";
      }
      descText += dsDescription;
    }
    return this.b.util.repairLinksInHTMLCode(descText);
  }
}

module.exports = NativeView;

},{"../templates/DsTitle.js":99,"../templates/NativeTableClassHeader.js":101,"../templates/NativeTableClassRow.js":102,"../templates/NativeTableEnumerationHeader.js":103,"../templates/NativeTableEnumerationRow.js":104}],108:[function(require,module,exports){
const formatHighlight = require("json-format-highlight");

// Renders the DS directly as JSON-LD (raw object). Some custom CSS added to increase the readability
class SHACLView {
  constructor(dsBrowser) {
    this.b = dsBrowser;
  }

  // renders (creates and appends) this view
  render() {
    // the SHACL code for the DS is preprocessed with a library to highlight parts of the JSON syntax
    const preContent = formatHighlight(this.b.ds, {
      keyColor: "black",
      numberColor: "#3A01DC",
      stringColor: "#DF0002",
      trueColor: "#C801A4",
      falseColor: "#C801A4",
      nullColor: "cornflowerblue",
    });
    // creates the html code for this view
    let viewHtml = this.getFrame();
    viewHtml = viewHtml.replace(/{{preContent}}/g, preContent);
    // append the view to the DSB main container
    this.b.dsbContainer.innerHTML = viewHtml;
  }

  // returns the base html code for this view
  getFrame() {
    return `<div id="shacl-view" class="noNav" >
      <pre style="
        font-size: large;
        text-align: left;
        width: auto;
        background-color: whitesmoke;
        padding: 15px 20px;
        margin: 0;
        overflow: visible;
        line-height: normal;
        display: block;
        font-family: monospace;
        word-wrap: break-word;
        white-space: pre-wrap;
        ">{{preContent}}</pre>
    </div>`;
  }
}

module.exports = SHACLView;

},{"json-format-highlight":42}],109:[function(require,module,exports){
const DSTitleFrame = require("../templates/DsTitle.js");

class TreeView {
  constructor(dsBrowser) {
    this.b = dsBrowser;
    this.dsHandler = this.b.dsHandler;
  }

  // renders (creates and appends) this view
  render() {
    // creates the html code for this view
    let nativeHtml = this.getFrame();

    // set html for navigationBar
    nativeHtml = nativeHtml.replace(
      /{{navigationBar}}/g,
      this.b.sharedFunctions.getNavigationBarHTML()
    );

    // set ds title
    nativeHtml = this.b.sharedFunctions.setDsTitleHtml(nativeHtml);

    // append the view to the DSB main container
    this.b.dsbContainer.innerHTML = nativeHtml;
    // initialize the tree iframe
    this.initIFrameForJSTree();
  }

  // returns the base html code for this view
  getFrame() {
    return `<div id="tree-view" class="withNav">
      <!--Navigation Bar-->
      {{navigationBar}}
      <!--Page content-->
      <div class="container-xl">
        <!--Title-->
        ${DSTitleFrame}
        <!--tree iframe-->
        <div id="div-iframe">
          <iframe id="iframe-jsTree" frameborder="0" width="100%" scrolling="no"></iframe>
        </div>
      </div>
    </div>`;
  }

  initIFrameForJSTree() {
    this.iFrame = this.b.dsbContext.getElementById("iframe-jsTree");
    this.iFrameCW = this.iFrame.contentWindow;
    const doc = this.iFrameCW.document;
    const jsTreeHtml = this.createJSTreeHTML();
    doc.open();
    doc.write(jsTreeHtml);
    doc.close();
    const dsClass = this.dsHandler.generateDsClass(
      this.b.dsRootNode,
      false,
      true
    );
    this.mapNodeForJSTree([dsClass]);
  }

  createJSTreeHTML() {
    const htmlTreeStyle = this.createTreeStyle();
    // JQuery is needed for the JSTree plugin
    return `<head>
            <script src="https://code.jquery.com/jquery-3.6.0.min.js" crossorigin="anonymous"></script>
            <script src="https://cdnjs.cloudflare.com/ajax/libs/jstree/3.3.10/jstree.min.js"></script>
            <script src="https://cdnjs.cloudflare.com/ajax/libs/jstreegrid/3.10.2/jstreegrid.min.js"></script>
            <link rel="stylesheet" href="https://maxcdn.bootstrapcdn.com/bootstrap/3.4.1/css/bootstrap.min.css" />
            <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/jstree/3.3.10/themes/default/style.min.css" />
            ${htmlTreeStyle}
            </head>
            <body><div id="jsTree"></div></body>`;
  }

  createTreeStyle() {
    return `<style>
            .optional-property { color: #ffa517; }
            .mandatory-property { color: #00ce0c; }
            </style>`;
  }

  mapNodeForJSTree(data) {
    const self = this;
    this.iFrame.addEventListener("load", function () {
      self.iFrameCW
        .$("#jsTree")
        .jstree({
          plugins: ["grid"],
          core: {
            themes: {
              icons: true,
              dots: true,
              responsive: true,
              stripes: true,
              rootVisible: false,
            },
            data: data,
          },
          grid: {
            columns: [
              {
                width: "20%",
                header: "Class / Property",
              },
              {
                header: "Range / Type",
                width: "20%",
                value: function (node) {
                  return node.data.dsRange;
                },
              },
              {
                width: "17%",
                header: "Cardinality",
                value: function (node) {
                  if (node.data.dsRange) {
                    return (
                      '<p style="width: 100%; margin: 0; text-align: center; padding-right: 7px;">' +
                      self.dsHandler.createHtmlCardinality(
                        node.data.minCount,
                        node.data.maxCount
                      ) +
                      "</p>"
                    );
                  }
                },
              },
              {
                width: "50%",
                header: "Description",
                value: function (node) {
                  return (
                    '<p style="width: 100%; overflow: hidden; margin: 0; text-overflow: ellipsis;">' +
                    node.data.dsDescription.replaceAll("</br>", " ") +
                    "</p>"
                  );
                },
              },
            ],
          },
        })
        .bind(
          "ready.jstree after_open.jstree after_close.jstree refresh.jstree",
          self.adaptIframe.bind(self)
        );
      self.addIframeClickEvent();
    });
  }

  adaptIframe() {
    const scrollY = window.scrollY;
    const scrollX = window.scrollX;
    this.iFrame.height = "0px";
    this.iFrame.height = this.iFrameCW.document.body.scrollHeight;
    window.scrollTo(scrollX, scrollY); // todo is this correct?
  }

  addIframeClickEvent() {
    // todo use tree js plugins for this optiopnal/mandatory functionality
    this.iFrameCW.$(".btn-vis-shadow").click((event) => {
      const $button = this.iFrameCW.$(event.currentTarget);

      // $button.removeClass("btn-vis-shadow");
      let $otherButton, showOptional;
      showOptional = true;
      // if ($button.attr("id") === "btn-opt") {
      //   $otherButton = this.iFrameCW.$("#btn-man");
      //   showOptional = true;
      // } else {
      //   $otherButton = this.iFrameCW.$("#btn-opt");
      //   showOptional = false;
      // }
      // $otherButton.addClass("btn-vis-shadow");
      $button.off("click");
      this.addIframeClickEvent();

      const dsClass = this.dsHandler.generateDsClass(
        this.b.dsRootNode,
        false,
        showOptional
      );
      const jsTree = this.iFrameCW.$("#jsTree").jstree(true);
      jsTree.settings.core.data = dsClass;
      jsTree.refresh();
    });
  }
}

module.exports = TreeView;

},{"../templates/DsTitle.js":99}]},{},[93])(93)
});
