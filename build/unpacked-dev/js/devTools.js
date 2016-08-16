!function(e){if("object"==typeof exports&&"undefined"!=typeof module)module.exports=e();else if("function"==typeof define&&define.amd)define([],e);else{var n;"undefined"!=typeof window?n=window:"undefined"!=typeof global?n=global:"undefined"!=typeof self&&(n=self),(n.extensionSkeleton||(n.extensionSkeleton={})).exports=e()}}(function(){var define,module,exports;return (function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
;(function() {
  // here we use SHARED message handlers, so all the contexts support the same
  // commands. but this is NOT typical messaging system usage, since you usually
  // want each context to handle different commands. for this you don't need
  // handlers factory as used below. simply create individual `handlers` object
  // for each context and pass it to msg.init() call. in case you don't need the
  // context to support any commands, but want the context to cooperate with the
  // rest of the extension via messaging system (you want to know when new
  // instance of given context is created / destroyed, or you want to be able to
  // issue command requests from this context), you may simply omit the
  // `hadnlers` parameter for good when invoking msg.init()
  var handlers = require('./modules/handlers').create('dt');
  require('./modules/msg').init('dt', handlers);
})();

},{"./modules/handlers":2,"./modules/msg":3}],2:[function(require,module,exports){
// create handler module for given `context`.
// handles `random`, `randomAsync`, and `echo` commands.
// both `random` function log the invocation information to console and return
// random number 0 - 999. `randomAsync` returns the value with 15 second delay.
// `echo` function doesn't return anything, just logs the input parameter
// `what`.

function log() {
  console.log.apply(console, arguments);
}

module.exports.create = function(context) {
  return {
    random: function(done) {
      log('---> ' + context + '::random() invoked');
      var r = Math.floor(1000 * Math.random());
      log('<--- returns: ' + r);
      done(r);
    },
    randomAsync: function(done) {
      log('---> ' + context + '::randomAsync() invoked (15 sec delay)');
      setTimeout(function() {
        var r = Math.floor(1000 * Math.random());
        log('<--- returns: ' + r);
        done(r);
      }, 15 * 1000);
    },
    echo: function(what, done) {
      log('---> ' + context + '::echo("' + what + '") invoked');
      log('<--- (no return value)');
      done();
    }
  };
};

// for surpressing console.log output in unit tests:
module.exports.__resetLog = function() { log = function() {}; };

},{}],3:[function(require,module,exports){
//
// Extension messaging system.
//
//
// This module, when used, allows communication among any extension-related
// contexts (background script, content scripts, development tools scripts, any
// JS code running in extension-related HTML pages, such as popups, options,
// ...).
//
// To start using the system, one needs to invoke exported `init` function from
// background script (once), passing 'bg' as the name of the context, optionally
// providing message handling functions. This will install onConnect listener
// for incoming Port connections from all other context.
//
// Any other context (with arbitrary name and (optional) message handlers) also
// invokes the `init` function. In this case, Port is created and connected to
// background script.
//
// Note: due to bug https://code.google.com/p/chromium/issues/detail?id=356133
// we also have dedicated name for developer tools context: 'dt'. Once this bug
// is fixed, the only reserved context name will be 'bg' for background again.
//
// To avoid race conditions, make sure that your background script calls `init`
// function after it is started, so it doesn't miss any Port connections
// attempts.
//
// To be able to handle commands (or associated messages) in contexts (both
// background and non-background), one must pass message handling functions in
// `handlers` object when invoking respective `init` function for given context.
// The `handlers` object is a function lookup table, i.e. object with function
// names as its keys and functions (code) as corresponding values. The function
// will be invoked, when given context is requested to handle message
// representing command with name that can be found as a key of the `handlers`
// object. Its return value (passed in callback, see below) will be treated as
// value that should be passed back to the requestor.
//
// Each message handling function can take any number of parameters, but MUST
// take callback as its last argument and invoke this callback when the message
// handler is done with processing of the message (regardless if synchronous or
// asynchronous). The callback takes one argument, this argument is treated as
// return value of the message handler. The callback function MUST be invoked
// once and only once.
//
// The `init` function returns (for any context it is invoked in) messaging
// object with two function: `cmd` and `bcast`, both used for sending messages
// to different contexts (or same context in different windows / tabs).
//
// Both functions behave the same way and have also the same arguments, the only
// difference is that the `cmd` callback (its last argument, if provided) is
// invoked with only one response value from all collected responses, while to
// the `bcast` callback (if provided) we pass array with all valid responses we
// collected while broadcasting given request.
//
// `cmd` and `bcast` functions arguments:
//
// (optional) [int] tabId: if not specified, broadcasted to all tabs,
//      if specified, sent only to given tab, can use SAME_TAB value here
//      (exported from this module, too)
//
// (optional) [array] contexts: if not specified, broadcasted to all contexts,
//      if specified, sent only to listed contexts (context name is provided
//      as the first argument when invoking the `init` function)
//
// (required) [string] command: name of the command to be executed
//
// (optional) [any type] arguments: any number of aruments that follow command
//      name are passed to execution handler when it is invoked
//
// (optional) [function(result)] callback: if provided (as last argument to
//      `cmd` or `bcast`), this function will be invoked when the response(s)
//      is/are received
//
// The `cmd` and `bcast` functions return `true` if the processing of the
// request was successful (i.e. if all the arguments were recognized properly),
// otherwise it returns `false`.
//
// When `cmd` or `bcast` function is invoked from background context, a set of
// context instances, to which the message will be sent to, is created based on
// provided arguments (tab id and context names). The set is NOT filtered by
// provided command name, as background context doesn't know what message
// handlers are used in all the contexts (i.e. it doesn't know the function
// names in message handling lookup function tables of non-background contexts).
//
// When tab id or context names are NOT provided, the command is broadcasted to
// all possible context instances, which the background knows about, and that
// may require a lot of messaging... So for performance reasons it is wise to
// provide tab-id and / or context name(s) whenever possible to reduce the size
// of the context instances set as much as it gets.
//
// When message corresponding to command is then received in non-background
// context, the handler lookup table is checked if it contains handler for
// requested command name. If so, the handler is invokend and its "return value"
// (passed in callback, to allow asynchronous message handling) is then sent
// back to background. If there is no corresponding handler (for requested
// command name), message indicating that is sent back instead.
//
// When background collects all the responses back from all the context
// instances it sent the message to, it invokes the `cmd` or `bcast` callback,
// passing the response value(s). If there was no callback provided, the
// collected response values are simply dropped.
//
// When `cmd` or `bcast` function is invoked from non-background context, the
// request message is sent to background. Background then dispatches the request
// to all relevant context instances that match provided filters (again, based on
// passed tab id and / or context names), and dispatches the request in favor of
// the context instance that sent the original request to background. The
// dispatching logic is described above (i.e. it is the same as if the request
// was sent by background).
//
// There is one difference though: if background has corresponding handler for
// requested command name (and background context is not filtered out when
// creating the set of contexts), this handler is invoked (in background
// context) and the "return value" is also part of the collected set of
// responses.
//
// When all the processing in all the context instances (including background
// context, if applicable) is finished and responses are collected, the
// responses are sent back to the original context instance that initiated the
// message processing.
//
//
// EXAMPLE:
//
// background script:
// -----
//
// var msg = require('msg').init('bg', {
//   square: function(what, done) { done(what*what); }
// });
//
// setInterval(function() {
//   msg.bcast(/* ['ct'] */, 'ping', function(responses) {
//     console.log(responses);  // --->  ['pong','pong',...]
//   });
// }, 1000);  // broadcast 'ping' each second
//
//
// content script:
// -----
//
// var msg = require('msg').init('ct', {
//   ping: function(done) { done('pong'); }
// });
//
// msg.cmd(/* ['bg'] */, 'square', 5, function(res) {
//   console.log(res);  // ---> 25
// });
//
// ----------
//
// For convenient sending requests from non-background contexts to
// background-only (as this is most common case: non-bg context needs some info
// from background), there is one more function in the messaging object returned
// by the init() function. The function is called 'bg' and it prepends the list
// of passed arguments with ['bg'] array, so that means the reuqest is targeted
// to background-only. The 'bg' function does NOT take 'tabId' or 'contexts'
// parameters, the first argument must be the command name.
//
// EXAMPLE:
//
// background script
// -----
//
// ( ... as above ... )
//
// content script:
// -----
//
// var msg = require('msg').init('ct', {
//   ping: function(done) { done('pong'); }
// });
//
// msg.bg('square', 5, function(res) {
//   console.log(res);  // ---> 25
// });
//
// ----------
//
// There are two dedicated background handlers that, when provided in `handlers`
// object for `bg` context in `init` function, are invoked by the messaging
// system itself. These handlers are:
//
// + onConnect: function(contextName, tabId),
// + onDisconnect: function(contextName, tabId)
//
// These two special handlers, if provided, are invoked when new Port is
// connected (i.e. when `init` function is invoked in non-bg context), and
// then when they are closed (disconnected) later on. This notification system
// allows to maintain some state about connected contexts in extension
// backround.
//
// Please note that unlike all other handlers passed as the `handlers` object to
// `init` function, these two special handlers do NOT take callback as their
// last arguments. Any return value these handlers may return is ignored.
//
// The `contextName` parameter is value provided to non-background `init`
// function, while the `tabId` is provided by the browser. If tabId is not
// provided by the browser, the `tabId` will be `Infinity`.
//


// constant for "same tab as me"
var SAME_TAB = -1000;  // was -Infinity, but JSON.stringify() + JSON.parse() don't like that value

// run-time API:
// variable + exported function to change it, so it can be mocked in unit tests
/* global chrome */
var runtime = ('object' === typeof(chrome)) && chrome.runtime;
// the same for devtools API:
var devtools = ('object' === typeof(chrome)) && chrome.devtools;

// utility function for looping through object's own keys
// callback: function(key, value, obj) ... doesn't need to use all 3 parameters
// returns object with same keys as the callback was invoked on, values are the
//   callback returned values ... can be of course ignored by the caller, too
function forOwnProps(obj, callback) {
  if ('function' !== typeof(callback)) {
    return;
  }
  var res = {};
  for (var key in obj) {
    if (obj.hasOwnProperty(key)) {
      res[key] = callback(key, obj[key], obj);
    }
  }
  return res;
}

// we wrap the whole module functionality into isolated scope, so that later we
// can instantiate multiple parallel scopes for unit testing.
// The module will still seem to hold singleton object, because we'll create
// this singleton and will export its methods as (whole) module methods.

function Messaging() {
  // handlers available in given context (function lookup table), set in `init()`
  // format:
  // {
  //   (string)<functioName>: (function)<code>,
  //   ...
  // }
  this.handlers = {};

  // id assigned by background, used in non-background contexts only
  // in background set to 'bg'
  this.id = null;

  // port used for communication with background (i.e. not used in background)
  // type: (chrome.runtime) Port
  this.port = null;

  // map of ports for connected extensions
  // key = extension id, value = port
  this.extPorts = {};

  // callback lookup table: if request waits for response, this table holds
  // the callback function that will be invoke upon response
  // format:
  // {
  //   (int)<requestId>: (function)<callback code>,
  //   ...
  // }
  this.cbTable = {};

  // background table of pending requests
  // format:
  // {
  //   (string)<portId>: [ { id: (int)<requestId>, cb: (function)<callback> }, ...],
  //   ...
  // }
  this.pendingReqs = {};

  // unique context id, used by background
  this.uId = 1;

  // request id, used by all contexts
  this.requestId = 1;

  // mapping non-background context names to objects indexed by name of the context
  // instances, holding { tab-id, (chrome.runtime.)Port } pairs,
  // used for message dispatching
  // format:
  // {
  //   (string)<category>: {
  //     (string)<id>: { tabId: (optional)<int>, port: <chrome.runtime.Port> },
  //     ...
  //   },
  //   ...
  // }
  // background-only variable
  this.portMap = {};

  // runetime and devtools references, so that we can change it in unit tests
  this.runtime = runtime;
  this.devtools = devtools;
}

// background function for selecting target ports to which we broadcast the request
// fromBg: is the request to collect targets from bacground, or based on message?
// targ*: filter for target ports
// src*: information about source port
// returns array of { port: (chrome.runtime.Port), id: (string) }
Messaging.prototype.selectTargets = function(fromBg, targTabId, targCategories, srcCategory, srcPortId) {
  var res = [];
  var _port = this.portMap[srcCategory] && this.portMap[srcCategory][srcPortId];
  if (!fromBg && !_port) {
    // this should never happen, we just got request from this port!
    return [];
  }
  if (!fromBg && (targTabId === SAME_TAB)) {
    targTabId = _port.tabId;
  }
  // iterate through portMap, pick targets:
  forOwnProps(this.portMap, function(categ, portGroup) {
    if (targCategories && (-1 === targCategories.indexOf(categ))) {
      // we are interested only in specified contexts,
      // and this category is not on the list
      return;
    }
    forOwnProps(portGroup, function(id, _ref) {
      if (targTabId && (targTabId !== _ref.tabId)) {
        // we are interested in specified tab id,
        // and this id doesn't match
        return;
      }
      if (fromBg || (_port.port !== _ref.port)) {
        // do not ask me back, ask only different ports
        res.push({ port: _ref.port, id: id });
      }
    });
  });
  return res;
};

// message handler (useb by both background and non-backound)
Messaging.prototype.onCustomMsg = function(message) {
  var _port, _arr, _localHandler, _ref, i;

  // helper functions:

  // send response on result (non-background):
  function sendResultCb(result) {
    if (message.sendResponse) {
      this.port.postMessage({
        cmd: 'response',
        portId: this.id,
        reqId: message.reqId,
        resultValid: true,
        result: result
      });
    }
  }

  // create callback waiting for N results, then send response (background):
  function createCbForMoreResults(N) {
    var results = [];
    var myId = this.runtime.id;
    return function(result, resultValid) {
      if (resultValid !== false) {  // can be either `true` or `undefined`
        results.push(result);
      }
      N--;
      if (!N && message.sendResponse && ((_port = this.extPorts[message.extensionId]) ||
        (this.portMap[message.category] && (_port = this.portMap[message.category][message.portId])))) {
        var response = {
          cmd: 'response',
          reqId: message.reqId,
          result: message.broadcast ? results : results[0]
        };

        if (message.extensionId) {
          response.extensionId = myId;
        }
        _port.port.postMessage(response);
      }
    }.bind(this);
  }

  // main message processing:
  if (!message || !message.cmd) {
    return;
  }
  if ('setName' === message.cmd) {
    this.id = message.name;
    return;
  }
  if ('bg' === this.id) {
    // background
    if ('request' === message.cmd) {
      var targetPorts = this.selectTargets(false, message.tabId, message.contexts,
                                           message.category, message.portId);
      var responsesNeeded = targetPorts.length;
      if ( (undefined === message.tabId) &&
           (!message.contexts || (-1 !== message.contexts.indexOf('bg'))) ) {
        // we are also interested in response from background itself
        if ((_ref = this.handlers[message.cmdName]) && ('function' === typeof(_ref))) {
          _localHandler = _ref;
          responsesNeeded++;
        }
      }
      if (!responsesNeeded) {
        // no one to answer that now
        if (message.sendResponse && ((_port = this.extPorts[message.extensionId]) ||
          (this.portMap[message.category] && (_port = this.portMap[message.category][message.portId])))) {
          var response = {
            cmd: 'response',
            reqId: message.reqId,
            resultValid: false,
            result: message.broadcast ? [] : undefined
          };
          if (message.extensionId) {
            response.extensionId = this.runtime.id;
          }
          _port.port.postMessage(response);
        }
      } else {
        // some responses needed
        var cb = createCbForMoreResults.call(this, responsesNeeded);
        // send to target ports
        for (i = 0; i < targetPorts.length; i++) {
          _port = targetPorts[i];
          _port.port.postMessage({
            cmd: 'request',
            cmdName: message.cmdName,
            sendResponse: true,
            args: message.args,
            reqId: this.requestId
          });
          _arr = this.pendingReqs[_port.id] || [];
          _arr.push({ id: this.requestId, cb: cb });
          this.pendingReqs[_port.id] = _arr;
          this.requestId++;
        }
        // get local response (if background can provide it)
        if (_localHandler) {
          message.args.push(cb);
          _localHandler.apply(this.handlers, message.args);
        }
      }
    } else if ('response' === message.cmd) {
      var id = message.portId || message.extensionId;
      _arr = this.pendingReqs[id];  // warning: IE creates a copy here!
      if (_arr) {
        // some results from given port expected, find the callback for reqId
        i = 0;
        while ((i < _arr.length) && (_arr[i].id !== message.reqId)) { i++; }
        if (i < _arr.length) {
          // callback found
          _arr[i].cb(message.result, message.resultValid);
          this.pendingReqs[id].splice(i, 1);   // need to use orig array (IE problem)
          if (!this.pendingReqs[id].length) {  // ... same here
            delete this.pendingReqs[id];
          }
        }
      }
    } else if ('updateTabId' === message.cmd) {
      var _context = message.context, _portId = message.portId;
      if ((_port = this.portMap[_context]) && (_port = _port[_portId])) {
        if ('function' === typeof(this.handlers.onDisconnect)) { this.handlers.onDisconnect(_context, _port.tabId); }
        _port.tabId = message.tabId;
        if ('function' === typeof(this.handlers.onConnect)) { this.handlers.onConnect(_context, _port.tabId); }
      }
    }
  } else {
    // non-background
    if ('request' === message.cmd) {
      _localHandler = this.handlers[message.cmdName];
      if ('function' !== typeof(_localHandler)) {
        if (message.sendResponse) {
          this.port.postMessage({
            cmd: 'response',
            portId: this.id,
            reqId: message.reqId,
            resultValid: false
          });
        }
      } else {
        message.args.push(sendResultCb.bind(this));
        _localHandler.apply(this.handlers, message.args);
      }
    } else if ('response' === message.cmd) {
      if (this.cbTable[message.reqId]) {
        this.cbTable[message.reqId](message.result);
        delete this.cbTable[message.reqId];
      }
    }
  }
};

// invoke callbacks for pending requests and remove the requests from the structure
Messaging.prototype.closePendingReqs = function(portId) {
  var _arr;
  if (_arr = this.pendingReqs[portId]) {
    for (var i = 0; i < _arr.length; i++) {
      _arr[i].cb(undefined, false);
    }
    delete this.pendingReqs[portId];
  }
};

Messaging.prototype.registerExternalConnection = function(extensionId, port) {
  this.extPorts[extensionId] = { port: port };

  var _onCustomMsg, _onDisconnect;

  // on disconnect: remove listeners and delete from port map
  function onDisconnect() {
    // listeners:
    port.onDisconnect.removeListener(_onDisconnect);
    port.onMessage.removeListener(_onCustomMsg);
    delete this.extPorts[extensionId];
    // close all pending requests:
    this.closePendingReqs(extensionId);
    // invoke custom onDisconnect handler
    if ('function' === typeof(this.handlers.onExtensionDisconnect)) { this.handlers.onExtensionDisconnect(extensionId); }
  }

  // install port handlers
  port.onMessage.addListener(_onCustomMsg = this.onCustomMsg.bind(this));
  port.onDisconnect.addListener(_onDisconnect = onDisconnect.bind(this));
  // invoke custom onConnect handler
  if ('function' === typeof(this.handlers.onExtensionConnect)) { this.handlers.onExtensionConnect(extensionId); }
};

Messaging.prototype.onConnectExternal = function(port) {
  if (this.extPorts[port.sender.id]) {
    return;
  }

  this.registerExternalConnection(port.sender.id, port);
};

// backround onConnect handler
Messaging.prototype.onConnect = function(port) {
  // add to port map
  var categName = port.name || 'unknown';
  var portId = categName + '-' + this.uId;
  this.uId++;
  var portCateg = this.portMap[categName] || {};
  var tabId = (port.sender && port.sender.tab && port.sender.tab.id) || Infinity;
  portCateg[portId] = {
    port: port,
    tabId: tabId
  };
  this.portMap[categName] = portCateg;
  var _onCustomMsg,_onDisconnect;
  // on disconnect: remove listeners and delete from port map
  function onDisconnect() {
    // listeners:
    port.onDisconnect.removeListener(_onDisconnect);
    port.onMessage.removeListener(_onCustomMsg);
    // port map:
    portCateg = this.portMap[categName];
    var _port;
    if (portCateg && (_port = portCateg[portId])) {
      tabId = _port.tabId;
      delete portCateg[portId];
    }
    // close all pending requests:
    this.closePendingReqs(portId);
    // invoke custom onDisconnect handler
    if ('function' === typeof(this.handlers.onDisconnect)) { this.handlers.onDisconnect(categName, tabId); }
  }
  // install port handlers
  port.onMessage.addListener(_onCustomMsg = this.onCustomMsg.bind(this));
  port.onDisconnect.addListener(_onDisconnect = onDisconnect.bind(this));
  // ask counter part to set its id
  port.postMessage({ cmd: 'setName', name: portId });
  // invoke custom onConnect handler
  if ('function' === typeof(this.handlers.onConnect)) { this.handlers.onConnect(categName, tabId); }
};

// create main messaging object, hiding all the complexity from the user
// it takes name of local context `myContextName`
//
// the returned object has two main functions: cmd and bcast
//
// they behave the same way and have also the same arguments, the only
// difference is that to `cmd` callback (if provided) is invoked with only one
// response value from all possible responses, while to `bcast` callback (if
// provided) we pass array with all valid responses we collected while
// broadcasting given request.
//
// functions arguments:
//
// (optional) [int] tabId: if not specified, broadcasted to all tabs,
//      if specified, sent only to given tab, can use SAME_TAB value here
//
// (optional) [array] contexts: if not specified, broadcasted to all contexts,
//      if specified, sent only to listed contexts
//
// (required) [string] command: name of the command to be executed
//
// (optional) [any type] arguments: any number of aruments that follow command
//      name are passed to execution handler when it is invoked
//
// (optional) [function(result)] callback: if provided (as last argument to
//      `cmd` or `bcast`) this function will be invoked when the response(s)
//      is/are received
//
// the functions return `true` if the processing of the request was successful
// (i.e. if all the arguments were recognized properly), otherwise it returns
// `false`.
//
// for non-bg contexts there is one more function in the messaging object
// available: 'bg' function, that is the same as 'cmd', but prepends the list of
// arguments with ['bg'], so that the user doesn't have to write it when
// requesting some info in non-bg context from background.
//
Messaging.prototype.createMsgObject = function(myContextName) {
  // generator for functions `cmd` and `bcast`
  function createFn(broadcast) {
    // helper function for invoking provided callback in background
    function createCbForMoreResults(N, callback) {
      var results = [];
      return function(result, resultValid) {
        if (resultValid) {
          results.push(result);
        }
        N--;
        if ((N <= 0) && callback) {
          callback(broadcast ? results : results[0]);
        }
      };
    }
    // generated function:
    return function _msg() {
      // process arguments:
      if (!arguments.length) {
        // at least command name must be provided
        return false;
      }
      if (!this.id) {
        // since we learn our id of non-background context in asynchronous
        // message, we may need to wait for it...
        var _ctx = this, _args = arguments;
        setTimeout(function() { _msg.apply(_ctx, _args); }, 1);
        return true;
      }
      var tabId, contexts, cmdName, args = [], callback;
      var curArg = 0, argsLimit = arguments.length;
      // check if we have callback:
      if (typeof(arguments[argsLimit-1]) === 'function') {
        argsLimit--;
        callback = arguments[argsLimit];
      }
      // other arguments:
      while (curArg < argsLimit) {
        var arg = arguments[curArg++];
        if (cmdName !== undefined) {
          args.push(arg);
          continue;
        }
        // we don't have command name yet...
        switch (typeof(arg)) {
          // tab id
          case 'number':
            if (tabId !== undefined) {
              return false; // we already have tab id --> invalid args
            }
            tabId = arg;
            break;
          // contexts  (array)
          case 'object':
            if ((typeof(arg.length) === 'undefined') || (contexts !== undefined)) {
              return false; // we either have it, or it is not array-like object
            }
            contexts = arg;
            break;
          // command name
          case 'string':
            cmdName = arg;
            break;
          // anything else --> error
          default:
            return false;
        }
      }
      if (cmdName === undefined) {
        return false; // command name is mandatory
      }
      // store the callback and issue the request (message)
      if ('bg' === this.id) {
        var targetPorts = this.selectTargets(true, tabId, contexts);
        var responsesNeeded = targetPorts.length;
        var cb = createCbForMoreResults.call(this, responsesNeeded, callback);
        // send to target ports
        for (var i = 0; i < targetPorts.length; i++) {
          var _port = targetPorts[i];
          _port.port.postMessage({
            cmd: 'request',
            cmdName: cmdName,
            sendResponse: true,
            args: args,
            reqId: this.requestId
          });
          var _arr = this.pendingReqs[_port.id] || [];
          _arr.push({ id: this.requestId, cb: cb });
          this.pendingReqs[_port.id] = _arr;
          this.requestId++;
        }
        if (!targetPorts.length) {
          // no one to respond, invoke the callback (if provided) right away
          cb(null, false);
        }
      } else {
        if (callback) {
          this.cbTable[this.requestId] = callback;
        }
        this.port.postMessage({
          cmd: 'request',
          cmdName: cmdName,
          reqId: this.requestId,
          sendResponse: (callback !== undefined),
          broadcast: broadcast,
          category: myContextName,
          portId: this.id,
          tabId: tabId,
          contexts: contexts,
          args: args
        });
        this.requestId++;
      }
      // everything went OK
      return true;
    }.bind(this);
  }

  function createCmdExtFn() {
    return function _msg(extensionId, commandName) {
      // process arguments:
      if (arguments.length < 2) {
        // at least extension id and command name must be provided
        return false;
      }

      if (this.id !== 'bg') {
        return false; // only background can send messagess to another extensions
      }

      var args = Array.prototype.slice.call(arguments, 2);
      var callback;
      if (typeof(args[args.length - 1]) === 'function') {
        callback = args.pop();
      }

      var _port = this.extPorts[extensionId];
      if (!_port) {
        // no one to respond, invoke the callback (if provided) right away
        if (callback) { callback(); }

        return true;
      }

      _port.port.postMessage({
        cmd: 'request',
        cmdName: commandName,
        sendResponse: true,
        args: args,
        reqId: this.requestId,
        extensionId: this.runtime.id
      });

      var _arr = this.pendingReqs[extensionId] || [];
      _arr.push({id: this.requestId,
        cb: function(result/*, resultValid/**/) { // ignore 'resultValid' because it is not applicable here
          if (callback) { callback(result); }
        }
      });
      this.pendingReqs[extensionId] = _arr;
      this.requestId++;

      // everything went OK
      return true;
    }.bind(this);
  }

  // returned object:
  var res = {
    cmd: createFn.call(this, false),
    bcast: createFn.call(this, true)
  };

  // for more convenience (when sending request from non-bg to background only)
  // adding 'bg(<cmdName>, ...)' function, that is equivalent to "cmd(['bg'], <cmdName>, ...)"
  if (myContextName !== 'bg') {
    res.bg = function() {
      if (0 === arguments.length || 'string' !== typeof(arguments[0])) {
        return false;
      }
      var args = [['bg']];
      for (var i = 0; i < arguments.length; i++) { args.push(arguments[i]); }
      return res.cmd.apply(res, args);
    };
  }
  else {
    res.connectExt = function(id) {
      if (this.extPorts[id]) { // already connected
        return true;
      }
      var port = this.runtime.connect(id);
      this.registerExternalConnection(id, port);
    }.bind(this);
    res.cmdExt = createCmdExtFn.call(this);
  }

  return res;
};

// init function, exported
//
// takes mandatory `context`, it is any string (e.g. 'ct', 'popup', ...),
// only one value is of special meaning: 'bg' ... must be used for initializing
// of the background part, any other context is considered non-background
//
// optionally takes `handlers`, which is object mapping function names to
// function codes, that is used as function lookup table. each message handling
// function MUST take callback as its last argument and invoke this callback
// when the message handler is done with processing of the message (regardless
// if synchronous or asynchronous). the callback takes one argument, this
// argument is treated as return value of the message handler.
//
// for background (`context` is 'bg'): installs onConnect listener
// for non-background context it connects to background
//
Messaging.prototype.init = function(context, handlers) {
  // set message handlers (optional)
  this.handlers = handlers || {};

  // listener references
  var _onDisconnect, _onCustomMsg;

  // helper function:
  function onDisconnect() {
    this.port.onDisconnect.removeListener(_onDisconnect);
    this.port.onMessage.removeListener(_onCustomMsg);
  }

  var _tabId;
  function _updateTabId() {
    if (!this.id) {
      setTimeout(_updateTabId.bind(this), 1);
      return;
    }
    this.port.postMessage({
      cmd: 'updateTabId',
      context: context,
      portId: this.id,
      tabId: _tabId
    });
  }

  if ('bg' === context) {
    // background
    this.id = 'bg';
    this.runtime.onConnect.addListener(this.onConnect.bind(this));
    this.runtime.onConnectExternal.addListener(this.onConnectExternal.bind(this));
  } else {
    // anything else than background
    this.port = this.runtime.connect({ name: context });
    this.port.onMessage.addListener(_onCustomMsg = this.onCustomMsg.bind(this));
    this.port.onDisconnect.addListener(_onDisconnect = onDisconnect.bind(this));
    // tabId update for developer tools
    // unfortunately we need dedicated name for developer tools context, due to
    // this bug: https://code.google.com/p/chromium/issues/detail?id=356133
    // ... we are not able to tell if we are in DT context otherwise :(
    if ( ('dt' === context) && this.devtools && (_tabId = this.devtools.inspectedWindow) &&
         ('number' === typeof(_tabId = _tabId.tabId)) ) {
      _updateTabId.call(this);
    }
  }

  return this.createMsgObject(context);
};


// singleton representing this module
var singleton = new Messaging();

// helper function to install methods used for unit tests
function installUnitTestMethods(target, delegate) {
  // setters
  target.__setRuntime = function(rt) { delegate.runtime = rt; return target; };
  target.__setDevTools = function(dt) { delegate.devtools = dt; return target; };
  // getters
  target.__getId = function() { return delegate.id; };
  target.__getPort = function() { return delegate.port; };
  target.__getPortMap = function() { return delegate.portMap; };
  target.__getHandlers = function() { return delegate.handlers; };
  target.__getPendingReqs = function() { return delegate.pendingReqs; };
}

module.exports = {
  // same tab id
  SAME_TAB: SAME_TAB,
  // see description for init function above
  init: singleton.init.bind(singleton),
  // --- for unit tests ---
  // allow unit testing of the main module:
  __allowUnitTests: function() { installUnitTestMethods(this, singleton); },
  // context cloning
  __createClone: function() {
    var clone = new Messaging();
    clone.SAME_TAB = SAME_TAB;
    installUnitTestMethods(clone, clone);
    return clone;
  }
};

},{}]},{},[1])(1)
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9ncnVudC1icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJjb2RlL2pzL2RldlRvb2xzLmpzIiwiY29kZS9qcy9tb2R1bGVzL2hhbmRsZXJzLmpzIiwiY29kZS9qcy9tb2R1bGVzL21zZy5qcyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTtBQ0FBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNkQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3JDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBIiwiZmlsZSI6ImdlbmVyYXRlZC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzQ29udGVudCI6WyIoZnVuY3Rpb24gZSh0LG4scil7ZnVuY3Rpb24gcyhvLHUpe2lmKCFuW29dKXtpZighdFtvXSl7dmFyIGE9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtpZighdSYmYSlyZXR1cm4gYShvLCEwKTtpZihpKXJldHVybiBpKG8sITApO3ZhciBmPW5ldyBFcnJvcihcIkNhbm5vdCBmaW5kIG1vZHVsZSAnXCIrbytcIidcIik7dGhyb3cgZi5jb2RlPVwiTU9EVUxFX05PVF9GT1VORFwiLGZ9dmFyIGw9bltvXT17ZXhwb3J0czp7fX07dFtvXVswXS5jYWxsKGwuZXhwb3J0cyxmdW5jdGlvbihlKXt2YXIgbj10W29dWzFdW2VdO3JldHVybiBzKG4/bjplKX0sbCxsLmV4cG9ydHMsZSx0LG4scil9cmV0dXJuIG5bb10uZXhwb3J0c312YXIgaT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2Zvcih2YXIgbz0wO288ci5sZW5ndGg7bysrKXMocltvXSk7cmV0dXJuIHN9KSIsIjsoZnVuY3Rpb24oKSB7XG4gIC8vIGhlcmUgd2UgdXNlIFNIQVJFRCBtZXNzYWdlIGhhbmRsZXJzLCBzbyBhbGwgdGhlIGNvbnRleHRzIHN1cHBvcnQgdGhlIHNhbWVcbiAgLy8gY29tbWFuZHMuIGJ1dCB0aGlzIGlzIE5PVCB0eXBpY2FsIG1lc3NhZ2luZyBzeXN0ZW0gdXNhZ2UsIHNpbmNlIHlvdSB1c3VhbGx5XG4gIC8vIHdhbnQgZWFjaCBjb250ZXh0IHRvIGhhbmRsZSBkaWZmZXJlbnQgY29tbWFuZHMuIGZvciB0aGlzIHlvdSBkb24ndCBuZWVkXG4gIC8vIGhhbmRsZXJzIGZhY3RvcnkgYXMgdXNlZCBiZWxvdy4gc2ltcGx5IGNyZWF0ZSBpbmRpdmlkdWFsIGBoYW5kbGVyc2Agb2JqZWN0XG4gIC8vIGZvciBlYWNoIGNvbnRleHQgYW5kIHBhc3MgaXQgdG8gbXNnLmluaXQoKSBjYWxsLiBpbiBjYXNlIHlvdSBkb24ndCBuZWVkIHRoZVxuICAvLyBjb250ZXh0IHRvIHN1cHBvcnQgYW55IGNvbW1hbmRzLCBidXQgd2FudCB0aGUgY29udGV4dCB0byBjb29wZXJhdGUgd2l0aCB0aGVcbiAgLy8gcmVzdCBvZiB0aGUgZXh0ZW5zaW9uIHZpYSBtZXNzYWdpbmcgc3lzdGVtICh5b3Ugd2FudCB0byBrbm93IHdoZW4gbmV3XG4gIC8vIGluc3RhbmNlIG9mIGdpdmVuIGNvbnRleHQgaXMgY3JlYXRlZCAvIGRlc3Ryb3llZCwgb3IgeW91IHdhbnQgdG8gYmUgYWJsZSB0b1xuICAvLyBpc3N1ZSBjb21tYW5kIHJlcXVlc3RzIGZyb20gdGhpcyBjb250ZXh0KSwgeW91IG1heSBzaW1wbHkgb21pdCB0aGVcbiAgLy8gYGhhZG5sZXJzYCBwYXJhbWV0ZXIgZm9yIGdvb2Qgd2hlbiBpbnZva2luZyBtc2cuaW5pdCgpXG4gIHZhciBoYW5kbGVycyA9IHJlcXVpcmUoJy4vbW9kdWxlcy9oYW5kbGVycycpLmNyZWF0ZSgnZHQnKTtcbiAgcmVxdWlyZSgnLi9tb2R1bGVzL21zZycpLmluaXQoJ2R0JywgaGFuZGxlcnMpO1xufSkoKTtcbiIsIi8vIGNyZWF0ZSBoYW5kbGVyIG1vZHVsZSBmb3IgZ2l2ZW4gYGNvbnRleHRgLlxuLy8gaGFuZGxlcyBgcmFuZG9tYCwgYHJhbmRvbUFzeW5jYCwgYW5kIGBlY2hvYCBjb21tYW5kcy5cbi8vIGJvdGggYHJhbmRvbWAgZnVuY3Rpb24gbG9nIHRoZSBpbnZvY2F0aW9uIGluZm9ybWF0aW9uIHRvIGNvbnNvbGUgYW5kIHJldHVyblxuLy8gcmFuZG9tIG51bWJlciAwIC0gOTk5LiBgcmFuZG9tQXN5bmNgIHJldHVybnMgdGhlIHZhbHVlIHdpdGggMTUgc2Vjb25kIGRlbGF5LlxuLy8gYGVjaG9gIGZ1bmN0aW9uIGRvZXNuJ3QgcmV0dXJuIGFueXRoaW5nLCBqdXN0IGxvZ3MgdGhlIGlucHV0IHBhcmFtZXRlclxuLy8gYHdoYXRgLlxuXG5mdW5jdGlvbiBsb2coKSB7XG4gIGNvbnNvbGUubG9nLmFwcGx5KGNvbnNvbGUsIGFyZ3VtZW50cyk7XG59XG5cbm1vZHVsZS5leHBvcnRzLmNyZWF0ZSA9IGZ1bmN0aW9uKGNvbnRleHQpIHtcbiAgcmV0dXJuIHtcbiAgICByYW5kb206IGZ1bmN0aW9uKGRvbmUpIHtcbiAgICAgIGxvZygnLS0tPiAnICsgY29udGV4dCArICc6OnJhbmRvbSgpIGludm9rZWQnKTtcbiAgICAgIHZhciByID0gTWF0aC5mbG9vcigxMDAwICogTWF0aC5yYW5kb20oKSk7XG4gICAgICBsb2coJzwtLS0gcmV0dXJuczogJyArIHIpO1xuICAgICAgZG9uZShyKTtcbiAgICB9LFxuICAgIHJhbmRvbUFzeW5jOiBmdW5jdGlvbihkb25lKSB7XG4gICAgICBsb2coJy0tLT4gJyArIGNvbnRleHQgKyAnOjpyYW5kb21Bc3luYygpIGludm9rZWQgKDE1IHNlYyBkZWxheSknKTtcbiAgICAgIHNldFRpbWVvdXQoZnVuY3Rpb24oKSB7XG4gICAgICAgIHZhciByID0gTWF0aC5mbG9vcigxMDAwICogTWF0aC5yYW5kb20oKSk7XG4gICAgICAgIGxvZygnPC0tLSByZXR1cm5zOiAnICsgcik7XG4gICAgICAgIGRvbmUocik7XG4gICAgICB9LCAxNSAqIDEwMDApO1xuICAgIH0sXG4gICAgZWNobzogZnVuY3Rpb24od2hhdCwgZG9uZSkge1xuICAgICAgbG9nKCctLS0+ICcgKyBjb250ZXh0ICsgJzo6ZWNobyhcIicgKyB3aGF0ICsgJ1wiKSBpbnZva2VkJyk7XG4gICAgICBsb2coJzwtLS0gKG5vIHJldHVybiB2YWx1ZSknKTtcbiAgICAgIGRvbmUoKTtcbiAgICB9XG4gIH07XG59O1xuXG4vLyBmb3Igc3VycHJlc3NpbmcgY29uc29sZS5sb2cgb3V0cHV0IGluIHVuaXQgdGVzdHM6XG5tb2R1bGUuZXhwb3J0cy5fX3Jlc2V0TG9nID0gZnVuY3Rpb24oKSB7IGxvZyA9IGZ1bmN0aW9uKCkge307IH07XG4iLCIvL1xuLy8gRXh0ZW5zaW9uIG1lc3NhZ2luZyBzeXN0ZW0uXG4vL1xuLy9cbi8vIFRoaXMgbW9kdWxlLCB3aGVuIHVzZWQsIGFsbG93cyBjb21tdW5pY2F0aW9uIGFtb25nIGFueSBleHRlbnNpb24tcmVsYXRlZFxuLy8gY29udGV4dHMgKGJhY2tncm91bmQgc2NyaXB0LCBjb250ZW50IHNjcmlwdHMsIGRldmVsb3BtZW50IHRvb2xzIHNjcmlwdHMsIGFueVxuLy8gSlMgY29kZSBydW5uaW5nIGluIGV4dGVuc2lvbi1yZWxhdGVkIEhUTUwgcGFnZXMsIHN1Y2ggYXMgcG9wdXBzLCBvcHRpb25zLFxuLy8gLi4uKS5cbi8vXG4vLyBUbyBzdGFydCB1c2luZyB0aGUgc3lzdGVtLCBvbmUgbmVlZHMgdG8gaW52b2tlIGV4cG9ydGVkIGBpbml0YCBmdW5jdGlvbiBmcm9tXG4vLyBiYWNrZ3JvdW5kIHNjcmlwdCAob25jZSksIHBhc3NpbmcgJ2JnJyBhcyB0aGUgbmFtZSBvZiB0aGUgY29udGV4dCwgb3B0aW9uYWxseVxuLy8gcHJvdmlkaW5nIG1lc3NhZ2UgaGFuZGxpbmcgZnVuY3Rpb25zLiBUaGlzIHdpbGwgaW5zdGFsbCBvbkNvbm5lY3QgbGlzdGVuZXJcbi8vIGZvciBpbmNvbWluZyBQb3J0IGNvbm5lY3Rpb25zIGZyb20gYWxsIG90aGVyIGNvbnRleHQuXG4vL1xuLy8gQW55IG90aGVyIGNvbnRleHQgKHdpdGggYXJiaXRyYXJ5IG5hbWUgYW5kIChvcHRpb25hbCkgbWVzc2FnZSBoYW5kbGVycykgYWxzb1xuLy8gaW52b2tlcyB0aGUgYGluaXRgIGZ1bmN0aW9uLiBJbiB0aGlzIGNhc2UsIFBvcnQgaXMgY3JlYXRlZCBhbmQgY29ubmVjdGVkIHRvXG4vLyBiYWNrZ3JvdW5kIHNjcmlwdC5cbi8vXG4vLyBOb3RlOiBkdWUgdG8gYnVnIGh0dHBzOi8vY29kZS5nb29nbGUuY29tL3AvY2hyb21pdW0vaXNzdWVzL2RldGFpbD9pZD0zNTYxMzNcbi8vIHdlIGFsc28gaGF2ZSBkZWRpY2F0ZWQgbmFtZSBmb3IgZGV2ZWxvcGVyIHRvb2xzIGNvbnRleHQ6ICdkdCcuIE9uY2UgdGhpcyBidWdcbi8vIGlzIGZpeGVkLCB0aGUgb25seSByZXNlcnZlZCBjb250ZXh0IG5hbWUgd2lsbCBiZSAnYmcnIGZvciBiYWNrZ3JvdW5kIGFnYWluLlxuLy9cbi8vIFRvIGF2b2lkIHJhY2UgY29uZGl0aW9ucywgbWFrZSBzdXJlIHRoYXQgeW91ciBiYWNrZ3JvdW5kIHNjcmlwdCBjYWxscyBgaW5pdGBcbi8vIGZ1bmN0aW9uIGFmdGVyIGl0IGlzIHN0YXJ0ZWQsIHNvIGl0IGRvZXNuJ3QgbWlzcyBhbnkgUG9ydCBjb25uZWN0aW9uc1xuLy8gYXR0ZW1wdHMuXG4vL1xuLy8gVG8gYmUgYWJsZSB0byBoYW5kbGUgY29tbWFuZHMgKG9yIGFzc29jaWF0ZWQgbWVzc2FnZXMpIGluIGNvbnRleHRzIChib3RoXG4vLyBiYWNrZ3JvdW5kIGFuZCBub24tYmFja2dyb3VuZCksIG9uZSBtdXN0IHBhc3MgbWVzc2FnZSBoYW5kbGluZyBmdW5jdGlvbnMgaW5cbi8vIGBoYW5kbGVyc2Agb2JqZWN0IHdoZW4gaW52b2tpbmcgcmVzcGVjdGl2ZSBgaW5pdGAgZnVuY3Rpb24gZm9yIGdpdmVuIGNvbnRleHQuXG4vLyBUaGUgYGhhbmRsZXJzYCBvYmplY3QgaXMgYSBmdW5jdGlvbiBsb29rdXAgdGFibGUsIGkuZS4gb2JqZWN0IHdpdGggZnVuY3Rpb25cbi8vIG5hbWVzIGFzIGl0cyBrZXlzIGFuZCBmdW5jdGlvbnMgKGNvZGUpIGFzIGNvcnJlc3BvbmRpbmcgdmFsdWVzLiBUaGUgZnVuY3Rpb25cbi8vIHdpbGwgYmUgaW52b2tlZCwgd2hlbiBnaXZlbiBjb250ZXh0IGlzIHJlcXVlc3RlZCB0byBoYW5kbGUgbWVzc2FnZVxuLy8gcmVwcmVzZW50aW5nIGNvbW1hbmQgd2l0aCBuYW1lIHRoYXQgY2FuIGJlIGZvdW5kIGFzIGEga2V5IG9mIHRoZSBgaGFuZGxlcnNgXG4vLyBvYmplY3QuIEl0cyByZXR1cm4gdmFsdWUgKHBhc3NlZCBpbiBjYWxsYmFjaywgc2VlIGJlbG93KSB3aWxsIGJlIHRyZWF0ZWQgYXNcbi8vIHZhbHVlIHRoYXQgc2hvdWxkIGJlIHBhc3NlZCBiYWNrIHRvIHRoZSByZXF1ZXN0b3IuXG4vL1xuLy8gRWFjaCBtZXNzYWdlIGhhbmRsaW5nIGZ1bmN0aW9uIGNhbiB0YWtlIGFueSBudW1iZXIgb2YgcGFyYW1ldGVycywgYnV0IE1VU1Rcbi8vIHRha2UgY2FsbGJhY2sgYXMgaXRzIGxhc3QgYXJndW1lbnQgYW5kIGludm9rZSB0aGlzIGNhbGxiYWNrIHdoZW4gdGhlIG1lc3NhZ2Vcbi8vIGhhbmRsZXIgaXMgZG9uZSB3aXRoIHByb2Nlc3Npbmcgb2YgdGhlIG1lc3NhZ2UgKHJlZ2FyZGxlc3MgaWYgc3luY2hyb25vdXMgb3Jcbi8vIGFzeW5jaHJvbm91cykuIFRoZSBjYWxsYmFjayB0YWtlcyBvbmUgYXJndW1lbnQsIHRoaXMgYXJndW1lbnQgaXMgdHJlYXRlZCBhc1xuLy8gcmV0dXJuIHZhbHVlIG9mIHRoZSBtZXNzYWdlIGhhbmRsZXIuIFRoZSBjYWxsYmFjayBmdW5jdGlvbiBNVVNUIGJlIGludm9rZWRcbi8vIG9uY2UgYW5kIG9ubHkgb25jZS5cbi8vXG4vLyBUaGUgYGluaXRgIGZ1bmN0aW9uIHJldHVybnMgKGZvciBhbnkgY29udGV4dCBpdCBpcyBpbnZva2VkIGluKSBtZXNzYWdpbmdcbi8vIG9iamVjdCB3aXRoIHR3byBmdW5jdGlvbjogYGNtZGAgYW5kIGBiY2FzdGAsIGJvdGggdXNlZCBmb3Igc2VuZGluZyBtZXNzYWdlc1xuLy8gdG8gZGlmZmVyZW50IGNvbnRleHRzIChvciBzYW1lIGNvbnRleHQgaW4gZGlmZmVyZW50IHdpbmRvd3MgLyB0YWJzKS5cbi8vXG4vLyBCb3RoIGZ1bmN0aW9ucyBiZWhhdmUgdGhlIHNhbWUgd2F5IGFuZCBoYXZlIGFsc28gdGhlIHNhbWUgYXJndW1lbnRzLCB0aGUgb25seVxuLy8gZGlmZmVyZW5jZSBpcyB0aGF0IHRoZSBgY21kYCBjYWxsYmFjayAoaXRzIGxhc3QgYXJndW1lbnQsIGlmIHByb3ZpZGVkKSBpc1xuLy8gaW52b2tlZCB3aXRoIG9ubHkgb25lIHJlc3BvbnNlIHZhbHVlIGZyb20gYWxsIGNvbGxlY3RlZCByZXNwb25zZXMsIHdoaWxlIHRvXG4vLyB0aGUgYGJjYXN0YCBjYWxsYmFjayAoaWYgcHJvdmlkZWQpIHdlIHBhc3MgYXJyYXkgd2l0aCBhbGwgdmFsaWQgcmVzcG9uc2VzIHdlXG4vLyBjb2xsZWN0ZWQgd2hpbGUgYnJvYWRjYXN0aW5nIGdpdmVuIHJlcXVlc3QuXG4vL1xuLy8gYGNtZGAgYW5kIGBiY2FzdGAgZnVuY3Rpb25zIGFyZ3VtZW50czpcbi8vXG4vLyAob3B0aW9uYWwpIFtpbnRdIHRhYklkOiBpZiBub3Qgc3BlY2lmaWVkLCBicm9hZGNhc3RlZCB0byBhbGwgdGFicyxcbi8vICAgICAgaWYgc3BlY2lmaWVkLCBzZW50IG9ubHkgdG8gZ2l2ZW4gdGFiLCBjYW4gdXNlIFNBTUVfVEFCIHZhbHVlIGhlcmVcbi8vICAgICAgKGV4cG9ydGVkIGZyb20gdGhpcyBtb2R1bGUsIHRvbylcbi8vXG4vLyAob3B0aW9uYWwpIFthcnJheV0gY29udGV4dHM6IGlmIG5vdCBzcGVjaWZpZWQsIGJyb2FkY2FzdGVkIHRvIGFsbCBjb250ZXh0cyxcbi8vICAgICAgaWYgc3BlY2lmaWVkLCBzZW50IG9ubHkgdG8gbGlzdGVkIGNvbnRleHRzIChjb250ZXh0IG5hbWUgaXMgcHJvdmlkZWRcbi8vICAgICAgYXMgdGhlIGZpcnN0IGFyZ3VtZW50IHdoZW4gaW52b2tpbmcgdGhlIGBpbml0YCBmdW5jdGlvbilcbi8vXG4vLyAocmVxdWlyZWQpIFtzdHJpbmddIGNvbW1hbmQ6IG5hbWUgb2YgdGhlIGNvbW1hbmQgdG8gYmUgZXhlY3V0ZWRcbi8vXG4vLyAob3B0aW9uYWwpIFthbnkgdHlwZV0gYXJndW1lbnRzOiBhbnkgbnVtYmVyIG9mIGFydW1lbnRzIHRoYXQgZm9sbG93IGNvbW1hbmRcbi8vICAgICAgbmFtZSBhcmUgcGFzc2VkIHRvIGV4ZWN1dGlvbiBoYW5kbGVyIHdoZW4gaXQgaXMgaW52b2tlZFxuLy9cbi8vIChvcHRpb25hbCkgW2Z1bmN0aW9uKHJlc3VsdCldIGNhbGxiYWNrOiBpZiBwcm92aWRlZCAoYXMgbGFzdCBhcmd1bWVudCB0b1xuLy8gICAgICBgY21kYCBvciBgYmNhc3RgKSwgdGhpcyBmdW5jdGlvbiB3aWxsIGJlIGludm9rZWQgd2hlbiB0aGUgcmVzcG9uc2Uocylcbi8vICAgICAgaXMvYXJlIHJlY2VpdmVkXG4vL1xuLy8gVGhlIGBjbWRgIGFuZCBgYmNhc3RgIGZ1bmN0aW9ucyByZXR1cm4gYHRydWVgIGlmIHRoZSBwcm9jZXNzaW5nIG9mIHRoZVxuLy8gcmVxdWVzdCB3YXMgc3VjY2Vzc2Z1bCAoaS5lLiBpZiBhbGwgdGhlIGFyZ3VtZW50cyB3ZXJlIHJlY29nbml6ZWQgcHJvcGVybHkpLFxuLy8gb3RoZXJ3aXNlIGl0IHJldHVybnMgYGZhbHNlYC5cbi8vXG4vLyBXaGVuIGBjbWRgIG9yIGBiY2FzdGAgZnVuY3Rpb24gaXMgaW52b2tlZCBmcm9tIGJhY2tncm91bmQgY29udGV4dCwgYSBzZXQgb2Zcbi8vIGNvbnRleHQgaW5zdGFuY2VzLCB0byB3aGljaCB0aGUgbWVzc2FnZSB3aWxsIGJlIHNlbnQgdG8sIGlzIGNyZWF0ZWQgYmFzZWQgb25cbi8vIHByb3ZpZGVkIGFyZ3VtZW50cyAodGFiIGlkIGFuZCBjb250ZXh0IG5hbWVzKS4gVGhlIHNldCBpcyBOT1QgZmlsdGVyZWQgYnlcbi8vIHByb3ZpZGVkIGNvbW1hbmQgbmFtZSwgYXMgYmFja2dyb3VuZCBjb250ZXh0IGRvZXNuJ3Qga25vdyB3aGF0IG1lc3NhZ2Vcbi8vIGhhbmRsZXJzIGFyZSB1c2VkIGluIGFsbCB0aGUgY29udGV4dHMgKGkuZS4gaXQgZG9lc24ndCBrbm93IHRoZSBmdW5jdGlvblxuLy8gbmFtZXMgaW4gbWVzc2FnZSBoYW5kbGluZyBsb29rdXAgZnVuY3Rpb24gdGFibGVzIG9mIG5vbi1iYWNrZ3JvdW5kIGNvbnRleHRzKS5cbi8vXG4vLyBXaGVuIHRhYiBpZCBvciBjb250ZXh0IG5hbWVzIGFyZSBOT1QgcHJvdmlkZWQsIHRoZSBjb21tYW5kIGlzIGJyb2FkY2FzdGVkIHRvXG4vLyBhbGwgcG9zc2libGUgY29udGV4dCBpbnN0YW5jZXMsIHdoaWNoIHRoZSBiYWNrZ3JvdW5kIGtub3dzIGFib3V0LCBhbmQgdGhhdFxuLy8gbWF5IHJlcXVpcmUgYSBsb3Qgb2YgbWVzc2FnaW5nLi4uIFNvIGZvciBwZXJmb3JtYW5jZSByZWFzb25zIGl0IGlzIHdpc2UgdG9cbi8vIHByb3ZpZGUgdGFiLWlkIGFuZCAvIG9yIGNvbnRleHQgbmFtZShzKSB3aGVuZXZlciBwb3NzaWJsZSB0byByZWR1Y2UgdGhlIHNpemVcbi8vIG9mIHRoZSBjb250ZXh0IGluc3RhbmNlcyBzZXQgYXMgbXVjaCBhcyBpdCBnZXRzLlxuLy9cbi8vIFdoZW4gbWVzc2FnZSBjb3JyZXNwb25kaW5nIHRvIGNvbW1hbmQgaXMgdGhlbiByZWNlaXZlZCBpbiBub24tYmFja2dyb3VuZFxuLy8gY29udGV4dCwgdGhlIGhhbmRsZXIgbG9va3VwIHRhYmxlIGlzIGNoZWNrZWQgaWYgaXQgY29udGFpbnMgaGFuZGxlciBmb3Jcbi8vIHJlcXVlc3RlZCBjb21tYW5kIG5hbWUuIElmIHNvLCB0aGUgaGFuZGxlciBpcyBpbnZva2VuZCBhbmQgaXRzIFwicmV0dXJuIHZhbHVlXCJcbi8vIChwYXNzZWQgaW4gY2FsbGJhY2ssIHRvIGFsbG93IGFzeW5jaHJvbm91cyBtZXNzYWdlIGhhbmRsaW5nKSBpcyB0aGVuIHNlbnRcbi8vIGJhY2sgdG8gYmFja2dyb3VuZC4gSWYgdGhlcmUgaXMgbm8gY29ycmVzcG9uZGluZyBoYW5kbGVyIChmb3IgcmVxdWVzdGVkXG4vLyBjb21tYW5kIG5hbWUpLCBtZXNzYWdlIGluZGljYXRpbmcgdGhhdCBpcyBzZW50IGJhY2sgaW5zdGVhZC5cbi8vXG4vLyBXaGVuIGJhY2tncm91bmQgY29sbGVjdHMgYWxsIHRoZSByZXNwb25zZXMgYmFjayBmcm9tIGFsbCB0aGUgY29udGV4dFxuLy8gaW5zdGFuY2VzIGl0IHNlbnQgdGhlIG1lc3NhZ2UgdG8sIGl0IGludm9rZXMgdGhlIGBjbWRgIG9yIGBiY2FzdGAgY2FsbGJhY2ssXG4vLyBwYXNzaW5nIHRoZSByZXNwb25zZSB2YWx1ZShzKS4gSWYgdGhlcmUgd2FzIG5vIGNhbGxiYWNrIHByb3ZpZGVkLCB0aGVcbi8vIGNvbGxlY3RlZCByZXNwb25zZSB2YWx1ZXMgYXJlIHNpbXBseSBkcm9wcGVkLlxuLy9cbi8vIFdoZW4gYGNtZGAgb3IgYGJjYXN0YCBmdW5jdGlvbiBpcyBpbnZva2VkIGZyb20gbm9uLWJhY2tncm91bmQgY29udGV4dCwgdGhlXG4vLyByZXF1ZXN0IG1lc3NhZ2UgaXMgc2VudCB0byBiYWNrZ3JvdW5kLiBCYWNrZ3JvdW5kIHRoZW4gZGlzcGF0Y2hlcyB0aGUgcmVxdWVzdFxuLy8gdG8gYWxsIHJlbGV2YW50IGNvbnRleHQgaW5zdGFuY2VzIHRoYXQgbWF0Y2ggcHJvdmlkZWQgZmlsdGVycyAoYWdhaW4sIGJhc2VkIG9uXG4vLyBwYXNzZWQgdGFiIGlkIGFuZCAvIG9yIGNvbnRleHQgbmFtZXMpLCBhbmQgZGlzcGF0Y2hlcyB0aGUgcmVxdWVzdCBpbiBmYXZvciBvZlxuLy8gdGhlIGNvbnRleHQgaW5zdGFuY2UgdGhhdCBzZW50IHRoZSBvcmlnaW5hbCByZXF1ZXN0IHRvIGJhY2tncm91bmQuIFRoZVxuLy8gZGlzcGF0Y2hpbmcgbG9naWMgaXMgZGVzY3JpYmVkIGFib3ZlIChpLmUuIGl0IGlzIHRoZSBzYW1lIGFzIGlmIHRoZSByZXF1ZXN0XG4vLyB3YXMgc2VudCBieSBiYWNrZ3JvdW5kKS5cbi8vXG4vLyBUaGVyZSBpcyBvbmUgZGlmZmVyZW5jZSB0aG91Z2g6IGlmIGJhY2tncm91bmQgaGFzIGNvcnJlc3BvbmRpbmcgaGFuZGxlciBmb3Jcbi8vIHJlcXVlc3RlZCBjb21tYW5kIG5hbWUgKGFuZCBiYWNrZ3JvdW5kIGNvbnRleHQgaXMgbm90IGZpbHRlcmVkIG91dCB3aGVuXG4vLyBjcmVhdGluZyB0aGUgc2V0IG9mIGNvbnRleHRzKSwgdGhpcyBoYW5kbGVyIGlzIGludm9rZWQgKGluIGJhY2tncm91bmRcbi8vIGNvbnRleHQpIGFuZCB0aGUgXCJyZXR1cm4gdmFsdWVcIiBpcyBhbHNvIHBhcnQgb2YgdGhlIGNvbGxlY3RlZCBzZXQgb2Zcbi8vIHJlc3BvbnNlcy5cbi8vXG4vLyBXaGVuIGFsbCB0aGUgcHJvY2Vzc2luZyBpbiBhbGwgdGhlIGNvbnRleHQgaW5zdGFuY2VzIChpbmNsdWRpbmcgYmFja2dyb3VuZFxuLy8gY29udGV4dCwgaWYgYXBwbGljYWJsZSkgaXMgZmluaXNoZWQgYW5kIHJlc3BvbnNlcyBhcmUgY29sbGVjdGVkLCB0aGVcbi8vIHJlc3BvbnNlcyBhcmUgc2VudCBiYWNrIHRvIHRoZSBvcmlnaW5hbCBjb250ZXh0IGluc3RhbmNlIHRoYXQgaW5pdGlhdGVkIHRoZVxuLy8gbWVzc2FnZSBwcm9jZXNzaW5nLlxuLy9cbi8vXG4vLyBFWEFNUExFOlxuLy9cbi8vIGJhY2tncm91bmQgc2NyaXB0OlxuLy8gLS0tLS1cbi8vXG4vLyB2YXIgbXNnID0gcmVxdWlyZSgnbXNnJykuaW5pdCgnYmcnLCB7XG4vLyAgIHNxdWFyZTogZnVuY3Rpb24od2hhdCwgZG9uZSkgeyBkb25lKHdoYXQqd2hhdCk7IH1cbi8vIH0pO1xuLy9cbi8vIHNldEludGVydmFsKGZ1bmN0aW9uKCkge1xuLy8gICBtc2cuYmNhc3QoLyogWydjdCddICovLCAncGluZycsIGZ1bmN0aW9uKHJlc3BvbnNlcykge1xuLy8gICAgIGNvbnNvbGUubG9nKHJlc3BvbnNlcyk7ICAvLyAtLS0+ICBbJ3BvbmcnLCdwb25nJywuLi5dXG4vLyAgIH0pO1xuLy8gfSwgMTAwMCk7ICAvLyBicm9hZGNhc3QgJ3BpbmcnIGVhY2ggc2Vjb25kXG4vL1xuLy9cbi8vIGNvbnRlbnQgc2NyaXB0OlxuLy8gLS0tLS1cbi8vXG4vLyB2YXIgbXNnID0gcmVxdWlyZSgnbXNnJykuaW5pdCgnY3QnLCB7XG4vLyAgIHBpbmc6IGZ1bmN0aW9uKGRvbmUpIHsgZG9uZSgncG9uZycpOyB9XG4vLyB9KTtcbi8vXG4vLyBtc2cuY21kKC8qIFsnYmcnXSAqLywgJ3NxdWFyZScsIDUsIGZ1bmN0aW9uKHJlcykge1xuLy8gICBjb25zb2xlLmxvZyhyZXMpOyAgLy8gLS0tPiAyNVxuLy8gfSk7XG4vL1xuLy8gLS0tLS0tLS0tLVxuLy9cbi8vIEZvciBjb252ZW5pZW50IHNlbmRpbmcgcmVxdWVzdHMgZnJvbSBub24tYmFja2dyb3VuZCBjb250ZXh0cyB0b1xuLy8gYmFja2dyb3VuZC1vbmx5IChhcyB0aGlzIGlzIG1vc3QgY29tbW9uIGNhc2U6IG5vbi1iZyBjb250ZXh0IG5lZWRzIHNvbWUgaW5mb1xuLy8gZnJvbSBiYWNrZ3JvdW5kKSwgdGhlcmUgaXMgb25lIG1vcmUgZnVuY3Rpb24gaW4gdGhlIG1lc3NhZ2luZyBvYmplY3QgcmV0dXJuZWRcbi8vIGJ5IHRoZSBpbml0KCkgZnVuY3Rpb24uIFRoZSBmdW5jdGlvbiBpcyBjYWxsZWQgJ2JnJyBhbmQgaXQgcHJlcGVuZHMgdGhlIGxpc3Rcbi8vIG9mIHBhc3NlZCBhcmd1bWVudHMgd2l0aCBbJ2JnJ10gYXJyYXksIHNvIHRoYXQgbWVhbnMgdGhlIHJldXFlc3QgaXMgdGFyZ2V0ZWRcbi8vIHRvIGJhY2tncm91bmQtb25seS4gVGhlICdiZycgZnVuY3Rpb24gZG9lcyBOT1QgdGFrZSAndGFiSWQnIG9yICdjb250ZXh0cydcbi8vIHBhcmFtZXRlcnMsIHRoZSBmaXJzdCBhcmd1bWVudCBtdXN0IGJlIHRoZSBjb21tYW5kIG5hbWUuXG4vL1xuLy8gRVhBTVBMRTpcbi8vXG4vLyBiYWNrZ3JvdW5kIHNjcmlwdFxuLy8gLS0tLS1cbi8vXG4vLyAoIC4uLiBhcyBhYm92ZSAuLi4gKVxuLy9cbi8vIGNvbnRlbnQgc2NyaXB0OlxuLy8gLS0tLS1cbi8vXG4vLyB2YXIgbXNnID0gcmVxdWlyZSgnbXNnJykuaW5pdCgnY3QnLCB7XG4vLyAgIHBpbmc6IGZ1bmN0aW9uKGRvbmUpIHsgZG9uZSgncG9uZycpOyB9XG4vLyB9KTtcbi8vXG4vLyBtc2cuYmcoJ3NxdWFyZScsIDUsIGZ1bmN0aW9uKHJlcykge1xuLy8gICBjb25zb2xlLmxvZyhyZXMpOyAgLy8gLS0tPiAyNVxuLy8gfSk7XG4vL1xuLy8gLS0tLS0tLS0tLVxuLy9cbi8vIFRoZXJlIGFyZSB0d28gZGVkaWNhdGVkIGJhY2tncm91bmQgaGFuZGxlcnMgdGhhdCwgd2hlbiBwcm92aWRlZCBpbiBgaGFuZGxlcnNgXG4vLyBvYmplY3QgZm9yIGBiZ2AgY29udGV4dCBpbiBgaW5pdGAgZnVuY3Rpb24sIGFyZSBpbnZva2VkIGJ5IHRoZSBtZXNzYWdpbmdcbi8vIHN5c3RlbSBpdHNlbGYuIFRoZXNlIGhhbmRsZXJzIGFyZTpcbi8vXG4vLyArIG9uQ29ubmVjdDogZnVuY3Rpb24oY29udGV4dE5hbWUsIHRhYklkKSxcbi8vICsgb25EaXNjb25uZWN0OiBmdW5jdGlvbihjb250ZXh0TmFtZSwgdGFiSWQpXG4vL1xuLy8gVGhlc2UgdHdvIHNwZWNpYWwgaGFuZGxlcnMsIGlmIHByb3ZpZGVkLCBhcmUgaW52b2tlZCB3aGVuIG5ldyBQb3J0IGlzXG4vLyBjb25uZWN0ZWQgKGkuZS4gd2hlbiBgaW5pdGAgZnVuY3Rpb24gaXMgaW52b2tlZCBpbiBub24tYmcgY29udGV4dCksIGFuZFxuLy8gdGhlbiB3aGVuIHRoZXkgYXJlIGNsb3NlZCAoZGlzY29ubmVjdGVkKSBsYXRlciBvbi4gVGhpcyBub3RpZmljYXRpb24gc3lzdGVtXG4vLyBhbGxvd3MgdG8gbWFpbnRhaW4gc29tZSBzdGF0ZSBhYm91dCBjb25uZWN0ZWQgY29udGV4dHMgaW4gZXh0ZW5zaW9uXG4vLyBiYWNrcm91bmQuXG4vL1xuLy8gUGxlYXNlIG5vdGUgdGhhdCB1bmxpa2UgYWxsIG90aGVyIGhhbmRsZXJzIHBhc3NlZCBhcyB0aGUgYGhhbmRsZXJzYCBvYmplY3QgdG9cbi8vIGBpbml0YCBmdW5jdGlvbiwgdGhlc2UgdHdvIHNwZWNpYWwgaGFuZGxlcnMgZG8gTk9UIHRha2UgY2FsbGJhY2sgYXMgdGhlaXJcbi8vIGxhc3QgYXJndW1lbnRzLiBBbnkgcmV0dXJuIHZhbHVlIHRoZXNlIGhhbmRsZXJzIG1heSByZXR1cm4gaXMgaWdub3JlZC5cbi8vXG4vLyBUaGUgYGNvbnRleHROYW1lYCBwYXJhbWV0ZXIgaXMgdmFsdWUgcHJvdmlkZWQgdG8gbm9uLWJhY2tncm91bmQgYGluaXRgXG4vLyBmdW5jdGlvbiwgd2hpbGUgdGhlIGB0YWJJZGAgaXMgcHJvdmlkZWQgYnkgdGhlIGJyb3dzZXIuIElmIHRhYklkIGlzIG5vdFxuLy8gcHJvdmlkZWQgYnkgdGhlIGJyb3dzZXIsIHRoZSBgdGFiSWRgIHdpbGwgYmUgYEluZmluaXR5YC5cbi8vXG5cblxuLy8gY29uc3RhbnQgZm9yIFwic2FtZSB0YWIgYXMgbWVcIlxudmFyIFNBTUVfVEFCID0gLTEwMDA7ICAvLyB3YXMgLUluZmluaXR5LCBidXQgSlNPTi5zdHJpbmdpZnkoKSArIEpTT04ucGFyc2UoKSBkb24ndCBsaWtlIHRoYXQgdmFsdWVcblxuLy8gcnVuLXRpbWUgQVBJOlxuLy8gdmFyaWFibGUgKyBleHBvcnRlZCBmdW5jdGlvbiB0byBjaGFuZ2UgaXQsIHNvIGl0IGNhbiBiZSBtb2NrZWQgaW4gdW5pdCB0ZXN0c1xuLyogZ2xvYmFsIGNocm9tZSAqL1xudmFyIHJ1bnRpbWUgPSAoJ29iamVjdCcgPT09IHR5cGVvZihjaHJvbWUpKSAmJiBjaHJvbWUucnVudGltZTtcbi8vIHRoZSBzYW1lIGZvciBkZXZ0b29scyBBUEk6XG52YXIgZGV2dG9vbHMgPSAoJ29iamVjdCcgPT09IHR5cGVvZihjaHJvbWUpKSAmJiBjaHJvbWUuZGV2dG9vbHM7XG5cbi8vIHV0aWxpdHkgZnVuY3Rpb24gZm9yIGxvb3BpbmcgdGhyb3VnaCBvYmplY3QncyBvd24ga2V5c1xuLy8gY2FsbGJhY2s6IGZ1bmN0aW9uKGtleSwgdmFsdWUsIG9iaikgLi4uIGRvZXNuJ3QgbmVlZCB0byB1c2UgYWxsIDMgcGFyYW1ldGVyc1xuLy8gcmV0dXJucyBvYmplY3Qgd2l0aCBzYW1lIGtleXMgYXMgdGhlIGNhbGxiYWNrIHdhcyBpbnZva2VkIG9uLCB2YWx1ZXMgYXJlIHRoZVxuLy8gICBjYWxsYmFjayByZXR1cm5lZCB2YWx1ZXMgLi4uIGNhbiBiZSBvZiBjb3Vyc2UgaWdub3JlZCBieSB0aGUgY2FsbGVyLCB0b29cbmZ1bmN0aW9uIGZvck93blByb3BzKG9iaiwgY2FsbGJhY2spIHtcbiAgaWYgKCdmdW5jdGlvbicgIT09IHR5cGVvZihjYWxsYmFjaykpIHtcbiAgICByZXR1cm47XG4gIH1cbiAgdmFyIHJlcyA9IHt9O1xuICBmb3IgKHZhciBrZXkgaW4gb2JqKSB7XG4gICAgaWYgKG9iai5oYXNPd25Qcm9wZXJ0eShrZXkpKSB7XG4gICAgICByZXNba2V5XSA9IGNhbGxiYWNrKGtleSwgb2JqW2tleV0sIG9iaik7XG4gICAgfVxuICB9XG4gIHJldHVybiByZXM7XG59XG5cbi8vIHdlIHdyYXAgdGhlIHdob2xlIG1vZHVsZSBmdW5jdGlvbmFsaXR5IGludG8gaXNvbGF0ZWQgc2NvcGUsIHNvIHRoYXQgbGF0ZXIgd2Vcbi8vIGNhbiBpbnN0YW50aWF0ZSBtdWx0aXBsZSBwYXJhbGxlbCBzY29wZXMgZm9yIHVuaXQgdGVzdGluZy5cbi8vIFRoZSBtb2R1bGUgd2lsbCBzdGlsbCBzZWVtIHRvIGhvbGQgc2luZ2xldG9uIG9iamVjdCwgYmVjYXVzZSB3ZSdsbCBjcmVhdGVcbi8vIHRoaXMgc2luZ2xldG9uIGFuZCB3aWxsIGV4cG9ydCBpdHMgbWV0aG9kcyBhcyAod2hvbGUpIG1vZHVsZSBtZXRob2RzLlxuXG5mdW5jdGlvbiBNZXNzYWdpbmcoKSB7XG4gIC8vIGhhbmRsZXJzIGF2YWlsYWJsZSBpbiBnaXZlbiBjb250ZXh0IChmdW5jdGlvbiBsb29rdXAgdGFibGUpLCBzZXQgaW4gYGluaXQoKWBcbiAgLy8gZm9ybWF0OlxuICAvLyB7XG4gIC8vICAgKHN0cmluZyk8ZnVuY3Rpb05hbWU+OiAoZnVuY3Rpb24pPGNvZGU+LFxuICAvLyAgIC4uLlxuICAvLyB9XG4gIHRoaXMuaGFuZGxlcnMgPSB7fTtcblxuICAvLyBpZCBhc3NpZ25lZCBieSBiYWNrZ3JvdW5kLCB1c2VkIGluIG5vbi1iYWNrZ3JvdW5kIGNvbnRleHRzIG9ubHlcbiAgLy8gaW4gYmFja2dyb3VuZCBzZXQgdG8gJ2JnJ1xuICB0aGlzLmlkID0gbnVsbDtcblxuICAvLyBwb3J0IHVzZWQgZm9yIGNvbW11bmljYXRpb24gd2l0aCBiYWNrZ3JvdW5kIChpLmUuIG5vdCB1c2VkIGluIGJhY2tncm91bmQpXG4gIC8vIHR5cGU6IChjaHJvbWUucnVudGltZSkgUG9ydFxuICB0aGlzLnBvcnQgPSBudWxsO1xuXG4gIC8vIG1hcCBvZiBwb3J0cyBmb3IgY29ubmVjdGVkIGV4dGVuc2lvbnNcbiAgLy8ga2V5ID0gZXh0ZW5zaW9uIGlkLCB2YWx1ZSA9IHBvcnRcbiAgdGhpcy5leHRQb3J0cyA9IHt9O1xuXG4gIC8vIGNhbGxiYWNrIGxvb2t1cCB0YWJsZTogaWYgcmVxdWVzdCB3YWl0cyBmb3IgcmVzcG9uc2UsIHRoaXMgdGFibGUgaG9sZHNcbiAgLy8gdGhlIGNhbGxiYWNrIGZ1bmN0aW9uIHRoYXQgd2lsbCBiZSBpbnZva2UgdXBvbiByZXNwb25zZVxuICAvLyBmb3JtYXQ6XG4gIC8vIHtcbiAgLy8gICAoaW50KTxyZXF1ZXN0SWQ+OiAoZnVuY3Rpb24pPGNhbGxiYWNrIGNvZGU+LFxuICAvLyAgIC4uLlxuICAvLyB9XG4gIHRoaXMuY2JUYWJsZSA9IHt9O1xuXG4gIC8vIGJhY2tncm91bmQgdGFibGUgb2YgcGVuZGluZyByZXF1ZXN0c1xuICAvLyBmb3JtYXQ6XG4gIC8vIHtcbiAgLy8gICAoc3RyaW5nKTxwb3J0SWQ+OiBbIHsgaWQ6IChpbnQpPHJlcXVlc3RJZD4sIGNiOiAoZnVuY3Rpb24pPGNhbGxiYWNrPiB9LCAuLi5dLFxuICAvLyAgIC4uLlxuICAvLyB9XG4gIHRoaXMucGVuZGluZ1JlcXMgPSB7fTtcblxuICAvLyB1bmlxdWUgY29udGV4dCBpZCwgdXNlZCBieSBiYWNrZ3JvdW5kXG4gIHRoaXMudUlkID0gMTtcblxuICAvLyByZXF1ZXN0IGlkLCB1c2VkIGJ5IGFsbCBjb250ZXh0c1xuICB0aGlzLnJlcXVlc3RJZCA9IDE7XG5cbiAgLy8gbWFwcGluZyBub24tYmFja2dyb3VuZCBjb250ZXh0IG5hbWVzIHRvIG9iamVjdHMgaW5kZXhlZCBieSBuYW1lIG9mIHRoZSBjb250ZXh0XG4gIC8vIGluc3RhbmNlcywgaG9sZGluZyB7IHRhYi1pZCwgKGNocm9tZS5ydW50aW1lLilQb3J0IH0gcGFpcnMsXG4gIC8vIHVzZWQgZm9yIG1lc3NhZ2UgZGlzcGF0Y2hpbmdcbiAgLy8gZm9ybWF0OlxuICAvLyB7XG4gIC8vICAgKHN0cmluZyk8Y2F0ZWdvcnk+OiB7XG4gIC8vICAgICAoc3RyaW5nKTxpZD46IHsgdGFiSWQ6IChvcHRpb25hbCk8aW50PiwgcG9ydDogPGNocm9tZS5ydW50aW1lLlBvcnQ+IH0sXG4gIC8vICAgICAuLi5cbiAgLy8gICB9LFxuICAvLyAgIC4uLlxuICAvLyB9XG4gIC8vIGJhY2tncm91bmQtb25seSB2YXJpYWJsZVxuICB0aGlzLnBvcnRNYXAgPSB7fTtcblxuICAvLyBydW5ldGltZSBhbmQgZGV2dG9vbHMgcmVmZXJlbmNlcywgc28gdGhhdCB3ZSBjYW4gY2hhbmdlIGl0IGluIHVuaXQgdGVzdHNcbiAgdGhpcy5ydW50aW1lID0gcnVudGltZTtcbiAgdGhpcy5kZXZ0b29scyA9IGRldnRvb2xzO1xufVxuXG4vLyBiYWNrZ3JvdW5kIGZ1bmN0aW9uIGZvciBzZWxlY3RpbmcgdGFyZ2V0IHBvcnRzIHRvIHdoaWNoIHdlIGJyb2FkY2FzdCB0aGUgcmVxdWVzdFxuLy8gZnJvbUJnOiBpcyB0aGUgcmVxdWVzdCB0byBjb2xsZWN0IHRhcmdldHMgZnJvbSBiYWNncm91bmQsIG9yIGJhc2VkIG9uIG1lc3NhZ2U/XG4vLyB0YXJnKjogZmlsdGVyIGZvciB0YXJnZXQgcG9ydHNcbi8vIHNyYyo6IGluZm9ybWF0aW9uIGFib3V0IHNvdXJjZSBwb3J0XG4vLyByZXR1cm5zIGFycmF5IG9mIHsgcG9ydDogKGNocm9tZS5ydW50aW1lLlBvcnQpLCBpZDogKHN0cmluZykgfVxuTWVzc2FnaW5nLnByb3RvdHlwZS5zZWxlY3RUYXJnZXRzID0gZnVuY3Rpb24oZnJvbUJnLCB0YXJnVGFiSWQsIHRhcmdDYXRlZ29yaWVzLCBzcmNDYXRlZ29yeSwgc3JjUG9ydElkKSB7XG4gIHZhciByZXMgPSBbXTtcbiAgdmFyIF9wb3J0ID0gdGhpcy5wb3J0TWFwW3NyY0NhdGVnb3J5XSAmJiB0aGlzLnBvcnRNYXBbc3JjQ2F0ZWdvcnldW3NyY1BvcnRJZF07XG4gIGlmICghZnJvbUJnICYmICFfcG9ydCkge1xuICAgIC8vIHRoaXMgc2hvdWxkIG5ldmVyIGhhcHBlbiwgd2UganVzdCBnb3QgcmVxdWVzdCBmcm9tIHRoaXMgcG9ydCFcbiAgICByZXR1cm4gW107XG4gIH1cbiAgaWYgKCFmcm9tQmcgJiYgKHRhcmdUYWJJZCA9PT0gU0FNRV9UQUIpKSB7XG4gICAgdGFyZ1RhYklkID0gX3BvcnQudGFiSWQ7XG4gIH1cbiAgLy8gaXRlcmF0ZSB0aHJvdWdoIHBvcnRNYXAsIHBpY2sgdGFyZ2V0czpcbiAgZm9yT3duUHJvcHModGhpcy5wb3J0TWFwLCBmdW5jdGlvbihjYXRlZywgcG9ydEdyb3VwKSB7XG4gICAgaWYgKHRhcmdDYXRlZ29yaWVzICYmICgtMSA9PT0gdGFyZ0NhdGVnb3JpZXMuaW5kZXhPZihjYXRlZykpKSB7XG4gICAgICAvLyB3ZSBhcmUgaW50ZXJlc3RlZCBvbmx5IGluIHNwZWNpZmllZCBjb250ZXh0cyxcbiAgICAgIC8vIGFuZCB0aGlzIGNhdGVnb3J5IGlzIG5vdCBvbiB0aGUgbGlzdFxuICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICBmb3JPd25Qcm9wcyhwb3J0R3JvdXAsIGZ1bmN0aW9uKGlkLCBfcmVmKSB7XG4gICAgICBpZiAodGFyZ1RhYklkICYmICh0YXJnVGFiSWQgIT09IF9yZWYudGFiSWQpKSB7XG4gICAgICAgIC8vIHdlIGFyZSBpbnRlcmVzdGVkIGluIHNwZWNpZmllZCB0YWIgaWQsXG4gICAgICAgIC8vIGFuZCB0aGlzIGlkIGRvZXNuJ3QgbWF0Y2hcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuICAgICAgaWYgKGZyb21CZyB8fCAoX3BvcnQucG9ydCAhPT0gX3JlZi5wb3J0KSkge1xuICAgICAgICAvLyBkbyBub3QgYXNrIG1lIGJhY2ssIGFzayBvbmx5IGRpZmZlcmVudCBwb3J0c1xuICAgICAgICByZXMucHVzaCh7IHBvcnQ6IF9yZWYucG9ydCwgaWQ6IGlkIH0pO1xuICAgICAgfVxuICAgIH0pO1xuICB9KTtcbiAgcmV0dXJuIHJlcztcbn07XG5cbi8vIG1lc3NhZ2UgaGFuZGxlciAodXNlYiBieSBib3RoIGJhY2tncm91bmQgYW5kIG5vbi1iYWNrb3VuZClcbk1lc3NhZ2luZy5wcm90b3R5cGUub25DdXN0b21Nc2cgPSBmdW5jdGlvbihtZXNzYWdlKSB7XG4gIHZhciBfcG9ydCwgX2FyciwgX2xvY2FsSGFuZGxlciwgX3JlZiwgaTtcblxuICAvLyBoZWxwZXIgZnVuY3Rpb25zOlxuXG4gIC8vIHNlbmQgcmVzcG9uc2Ugb24gcmVzdWx0IChub24tYmFja2dyb3VuZCk6XG4gIGZ1bmN0aW9uIHNlbmRSZXN1bHRDYihyZXN1bHQpIHtcbiAgICBpZiAobWVzc2FnZS5zZW5kUmVzcG9uc2UpIHtcbiAgICAgIHRoaXMucG9ydC5wb3N0TWVzc2FnZSh7XG4gICAgICAgIGNtZDogJ3Jlc3BvbnNlJyxcbiAgICAgICAgcG9ydElkOiB0aGlzLmlkLFxuICAgICAgICByZXFJZDogbWVzc2FnZS5yZXFJZCxcbiAgICAgICAgcmVzdWx0VmFsaWQ6IHRydWUsXG4gICAgICAgIHJlc3VsdDogcmVzdWx0XG4gICAgICB9KTtcbiAgICB9XG4gIH1cblxuICAvLyBjcmVhdGUgY2FsbGJhY2sgd2FpdGluZyBmb3IgTiByZXN1bHRzLCB0aGVuIHNlbmQgcmVzcG9uc2UgKGJhY2tncm91bmQpOlxuICBmdW5jdGlvbiBjcmVhdGVDYkZvck1vcmVSZXN1bHRzKE4pIHtcbiAgICB2YXIgcmVzdWx0cyA9IFtdO1xuICAgIHZhciBteUlkID0gdGhpcy5ydW50aW1lLmlkO1xuICAgIHJldHVybiBmdW5jdGlvbihyZXN1bHQsIHJlc3VsdFZhbGlkKSB7XG4gICAgICBpZiAocmVzdWx0VmFsaWQgIT09IGZhbHNlKSB7ICAvLyBjYW4gYmUgZWl0aGVyIGB0cnVlYCBvciBgdW5kZWZpbmVkYFxuICAgICAgICByZXN1bHRzLnB1c2gocmVzdWx0KTtcbiAgICAgIH1cbiAgICAgIE4tLTtcbiAgICAgIGlmICghTiAmJiBtZXNzYWdlLnNlbmRSZXNwb25zZSAmJiAoKF9wb3J0ID0gdGhpcy5leHRQb3J0c1ttZXNzYWdlLmV4dGVuc2lvbklkXSkgfHxcbiAgICAgICAgKHRoaXMucG9ydE1hcFttZXNzYWdlLmNhdGVnb3J5XSAmJiAoX3BvcnQgPSB0aGlzLnBvcnRNYXBbbWVzc2FnZS5jYXRlZ29yeV1bbWVzc2FnZS5wb3J0SWRdKSkpKSB7XG4gICAgICAgIHZhciByZXNwb25zZSA9IHtcbiAgICAgICAgICBjbWQ6ICdyZXNwb25zZScsXG4gICAgICAgICAgcmVxSWQ6IG1lc3NhZ2UucmVxSWQsXG4gICAgICAgICAgcmVzdWx0OiBtZXNzYWdlLmJyb2FkY2FzdCA/IHJlc3VsdHMgOiByZXN1bHRzWzBdXG4gICAgICAgIH07XG5cbiAgICAgICAgaWYgKG1lc3NhZ2UuZXh0ZW5zaW9uSWQpIHtcbiAgICAgICAgICByZXNwb25zZS5leHRlbnNpb25JZCA9IG15SWQ7XG4gICAgICAgIH1cbiAgICAgICAgX3BvcnQucG9ydC5wb3N0TWVzc2FnZShyZXNwb25zZSk7XG4gICAgICB9XG4gICAgfS5iaW5kKHRoaXMpO1xuICB9XG5cbiAgLy8gbWFpbiBtZXNzYWdlIHByb2Nlc3Npbmc6XG4gIGlmICghbWVzc2FnZSB8fCAhbWVzc2FnZS5jbWQpIHtcbiAgICByZXR1cm47XG4gIH1cbiAgaWYgKCdzZXROYW1lJyA9PT0gbWVzc2FnZS5jbWQpIHtcbiAgICB0aGlzLmlkID0gbWVzc2FnZS5uYW1lO1xuICAgIHJldHVybjtcbiAgfVxuICBpZiAoJ2JnJyA9PT0gdGhpcy5pZCkge1xuICAgIC8vIGJhY2tncm91bmRcbiAgICBpZiAoJ3JlcXVlc3QnID09PSBtZXNzYWdlLmNtZCkge1xuICAgICAgdmFyIHRhcmdldFBvcnRzID0gdGhpcy5zZWxlY3RUYXJnZXRzKGZhbHNlLCBtZXNzYWdlLnRhYklkLCBtZXNzYWdlLmNvbnRleHRzLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIG1lc3NhZ2UuY2F0ZWdvcnksIG1lc3NhZ2UucG9ydElkKTtcbiAgICAgIHZhciByZXNwb25zZXNOZWVkZWQgPSB0YXJnZXRQb3J0cy5sZW5ndGg7XG4gICAgICBpZiAoICh1bmRlZmluZWQgPT09IG1lc3NhZ2UudGFiSWQpICYmXG4gICAgICAgICAgICghbWVzc2FnZS5jb250ZXh0cyB8fCAoLTEgIT09IG1lc3NhZ2UuY29udGV4dHMuaW5kZXhPZignYmcnKSkpICkge1xuICAgICAgICAvLyB3ZSBhcmUgYWxzbyBpbnRlcmVzdGVkIGluIHJlc3BvbnNlIGZyb20gYmFja2dyb3VuZCBpdHNlbGZcbiAgICAgICAgaWYgKChfcmVmID0gdGhpcy5oYW5kbGVyc1ttZXNzYWdlLmNtZE5hbWVdKSAmJiAoJ2Z1bmN0aW9uJyA9PT0gdHlwZW9mKF9yZWYpKSkge1xuICAgICAgICAgIF9sb2NhbEhhbmRsZXIgPSBfcmVmO1xuICAgICAgICAgIHJlc3BvbnNlc05lZWRlZCsrO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICBpZiAoIXJlc3BvbnNlc05lZWRlZCkge1xuICAgICAgICAvLyBubyBvbmUgdG8gYW5zd2VyIHRoYXQgbm93XG4gICAgICAgIGlmIChtZXNzYWdlLnNlbmRSZXNwb25zZSAmJiAoKF9wb3J0ID0gdGhpcy5leHRQb3J0c1ttZXNzYWdlLmV4dGVuc2lvbklkXSkgfHxcbiAgICAgICAgICAodGhpcy5wb3J0TWFwW21lc3NhZ2UuY2F0ZWdvcnldICYmIChfcG9ydCA9IHRoaXMucG9ydE1hcFttZXNzYWdlLmNhdGVnb3J5XVttZXNzYWdlLnBvcnRJZF0pKSkpIHtcbiAgICAgICAgICB2YXIgcmVzcG9uc2UgPSB7XG4gICAgICAgICAgICBjbWQ6ICdyZXNwb25zZScsXG4gICAgICAgICAgICByZXFJZDogbWVzc2FnZS5yZXFJZCxcbiAgICAgICAgICAgIHJlc3VsdFZhbGlkOiBmYWxzZSxcbiAgICAgICAgICAgIHJlc3VsdDogbWVzc2FnZS5icm9hZGNhc3QgPyBbXSA6IHVuZGVmaW5lZFxuICAgICAgICAgIH07XG4gICAgICAgICAgaWYgKG1lc3NhZ2UuZXh0ZW5zaW9uSWQpIHtcbiAgICAgICAgICAgIHJlc3BvbnNlLmV4dGVuc2lvbklkID0gdGhpcy5ydW50aW1lLmlkO1xuICAgICAgICAgIH1cbiAgICAgICAgICBfcG9ydC5wb3J0LnBvc3RNZXNzYWdlKHJlc3BvbnNlKTtcbiAgICAgICAgfVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgLy8gc29tZSByZXNwb25zZXMgbmVlZGVkXG4gICAgICAgIHZhciBjYiA9IGNyZWF0ZUNiRm9yTW9yZVJlc3VsdHMuY2FsbCh0aGlzLCByZXNwb25zZXNOZWVkZWQpO1xuICAgICAgICAvLyBzZW5kIHRvIHRhcmdldCBwb3J0c1xuICAgICAgICBmb3IgKGkgPSAwOyBpIDwgdGFyZ2V0UG9ydHMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICBfcG9ydCA9IHRhcmdldFBvcnRzW2ldO1xuICAgICAgICAgIF9wb3J0LnBvcnQucG9zdE1lc3NhZ2Uoe1xuICAgICAgICAgICAgY21kOiAncmVxdWVzdCcsXG4gICAgICAgICAgICBjbWROYW1lOiBtZXNzYWdlLmNtZE5hbWUsXG4gICAgICAgICAgICBzZW5kUmVzcG9uc2U6IHRydWUsXG4gICAgICAgICAgICBhcmdzOiBtZXNzYWdlLmFyZ3MsXG4gICAgICAgICAgICByZXFJZDogdGhpcy5yZXF1ZXN0SWRcbiAgICAgICAgICB9KTtcbiAgICAgICAgICBfYXJyID0gdGhpcy5wZW5kaW5nUmVxc1tfcG9ydC5pZF0gfHwgW107XG4gICAgICAgICAgX2Fyci5wdXNoKHsgaWQ6IHRoaXMucmVxdWVzdElkLCBjYjogY2IgfSk7XG4gICAgICAgICAgdGhpcy5wZW5kaW5nUmVxc1tfcG9ydC5pZF0gPSBfYXJyO1xuICAgICAgICAgIHRoaXMucmVxdWVzdElkKys7XG4gICAgICAgIH1cbiAgICAgICAgLy8gZ2V0IGxvY2FsIHJlc3BvbnNlIChpZiBiYWNrZ3JvdW5kIGNhbiBwcm92aWRlIGl0KVxuICAgICAgICBpZiAoX2xvY2FsSGFuZGxlcikge1xuICAgICAgICAgIG1lc3NhZ2UuYXJncy5wdXNoKGNiKTtcbiAgICAgICAgICBfbG9jYWxIYW5kbGVyLmFwcGx5KHRoaXMuaGFuZGxlcnMsIG1lc3NhZ2UuYXJncyk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9IGVsc2UgaWYgKCdyZXNwb25zZScgPT09IG1lc3NhZ2UuY21kKSB7XG4gICAgICB2YXIgaWQgPSBtZXNzYWdlLnBvcnRJZCB8fCBtZXNzYWdlLmV4dGVuc2lvbklkO1xuICAgICAgX2FyciA9IHRoaXMucGVuZGluZ1JlcXNbaWRdOyAgLy8gd2FybmluZzogSUUgY3JlYXRlcyBhIGNvcHkgaGVyZSFcbiAgICAgIGlmIChfYXJyKSB7XG4gICAgICAgIC8vIHNvbWUgcmVzdWx0cyBmcm9tIGdpdmVuIHBvcnQgZXhwZWN0ZWQsIGZpbmQgdGhlIGNhbGxiYWNrIGZvciByZXFJZFxuICAgICAgICBpID0gMDtcbiAgICAgICAgd2hpbGUgKChpIDwgX2Fyci5sZW5ndGgpICYmIChfYXJyW2ldLmlkICE9PSBtZXNzYWdlLnJlcUlkKSkgeyBpKys7IH1cbiAgICAgICAgaWYgKGkgPCBfYXJyLmxlbmd0aCkge1xuICAgICAgICAgIC8vIGNhbGxiYWNrIGZvdW5kXG4gICAgICAgICAgX2FycltpXS5jYihtZXNzYWdlLnJlc3VsdCwgbWVzc2FnZS5yZXN1bHRWYWxpZCk7XG4gICAgICAgICAgdGhpcy5wZW5kaW5nUmVxc1tpZF0uc3BsaWNlKGksIDEpOyAgIC8vIG5lZWQgdG8gdXNlIG9yaWcgYXJyYXkgKElFIHByb2JsZW0pXG4gICAgICAgICAgaWYgKCF0aGlzLnBlbmRpbmdSZXFzW2lkXS5sZW5ndGgpIHsgIC8vIC4uLiBzYW1lIGhlcmVcbiAgICAgICAgICAgIGRlbGV0ZSB0aGlzLnBlbmRpbmdSZXFzW2lkXTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9IGVsc2UgaWYgKCd1cGRhdGVUYWJJZCcgPT09IG1lc3NhZ2UuY21kKSB7XG4gICAgICB2YXIgX2NvbnRleHQgPSBtZXNzYWdlLmNvbnRleHQsIF9wb3J0SWQgPSBtZXNzYWdlLnBvcnRJZDtcbiAgICAgIGlmICgoX3BvcnQgPSB0aGlzLnBvcnRNYXBbX2NvbnRleHRdKSAmJiAoX3BvcnQgPSBfcG9ydFtfcG9ydElkXSkpIHtcbiAgICAgICAgaWYgKCdmdW5jdGlvbicgPT09IHR5cGVvZih0aGlzLmhhbmRsZXJzLm9uRGlzY29ubmVjdCkpIHsgdGhpcy5oYW5kbGVycy5vbkRpc2Nvbm5lY3QoX2NvbnRleHQsIF9wb3J0LnRhYklkKTsgfVxuICAgICAgICBfcG9ydC50YWJJZCA9IG1lc3NhZ2UudGFiSWQ7XG4gICAgICAgIGlmICgnZnVuY3Rpb24nID09PSB0eXBlb2YodGhpcy5oYW5kbGVycy5vbkNvbm5lY3QpKSB7IHRoaXMuaGFuZGxlcnMub25Db25uZWN0KF9jb250ZXh0LCBfcG9ydC50YWJJZCk7IH1cbiAgICAgIH1cbiAgICB9XG4gIH0gZWxzZSB7XG4gICAgLy8gbm9uLWJhY2tncm91bmRcbiAgICBpZiAoJ3JlcXVlc3QnID09PSBtZXNzYWdlLmNtZCkge1xuICAgICAgX2xvY2FsSGFuZGxlciA9IHRoaXMuaGFuZGxlcnNbbWVzc2FnZS5jbWROYW1lXTtcbiAgICAgIGlmICgnZnVuY3Rpb24nICE9PSB0eXBlb2YoX2xvY2FsSGFuZGxlcikpIHtcbiAgICAgICAgaWYgKG1lc3NhZ2Uuc2VuZFJlc3BvbnNlKSB7XG4gICAgICAgICAgdGhpcy5wb3J0LnBvc3RNZXNzYWdlKHtcbiAgICAgICAgICAgIGNtZDogJ3Jlc3BvbnNlJyxcbiAgICAgICAgICAgIHBvcnRJZDogdGhpcy5pZCxcbiAgICAgICAgICAgIHJlcUlkOiBtZXNzYWdlLnJlcUlkLFxuICAgICAgICAgICAgcmVzdWx0VmFsaWQ6IGZhbHNlXG4gICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIG1lc3NhZ2UuYXJncy5wdXNoKHNlbmRSZXN1bHRDYi5iaW5kKHRoaXMpKTtcbiAgICAgICAgX2xvY2FsSGFuZGxlci5hcHBseSh0aGlzLmhhbmRsZXJzLCBtZXNzYWdlLmFyZ3MpO1xuICAgICAgfVxuICAgIH0gZWxzZSBpZiAoJ3Jlc3BvbnNlJyA9PT0gbWVzc2FnZS5jbWQpIHtcbiAgICAgIGlmICh0aGlzLmNiVGFibGVbbWVzc2FnZS5yZXFJZF0pIHtcbiAgICAgICAgdGhpcy5jYlRhYmxlW21lc3NhZ2UucmVxSWRdKG1lc3NhZ2UucmVzdWx0KTtcbiAgICAgICAgZGVsZXRlIHRoaXMuY2JUYWJsZVttZXNzYWdlLnJlcUlkXTtcbiAgICAgIH1cbiAgICB9XG4gIH1cbn07XG5cbi8vIGludm9rZSBjYWxsYmFja3MgZm9yIHBlbmRpbmcgcmVxdWVzdHMgYW5kIHJlbW92ZSB0aGUgcmVxdWVzdHMgZnJvbSB0aGUgc3RydWN0dXJlXG5NZXNzYWdpbmcucHJvdG90eXBlLmNsb3NlUGVuZGluZ1JlcXMgPSBmdW5jdGlvbihwb3J0SWQpIHtcbiAgdmFyIF9hcnI7XG4gIGlmIChfYXJyID0gdGhpcy5wZW5kaW5nUmVxc1twb3J0SWRdKSB7XG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCBfYXJyLmxlbmd0aDsgaSsrKSB7XG4gICAgICBfYXJyW2ldLmNiKHVuZGVmaW5lZCwgZmFsc2UpO1xuICAgIH1cbiAgICBkZWxldGUgdGhpcy5wZW5kaW5nUmVxc1twb3J0SWRdO1xuICB9XG59O1xuXG5NZXNzYWdpbmcucHJvdG90eXBlLnJlZ2lzdGVyRXh0ZXJuYWxDb25uZWN0aW9uID0gZnVuY3Rpb24oZXh0ZW5zaW9uSWQsIHBvcnQpIHtcbiAgdGhpcy5leHRQb3J0c1tleHRlbnNpb25JZF0gPSB7IHBvcnQ6IHBvcnQgfTtcblxuICB2YXIgX29uQ3VzdG9tTXNnLCBfb25EaXNjb25uZWN0O1xuXG4gIC8vIG9uIGRpc2Nvbm5lY3Q6IHJlbW92ZSBsaXN0ZW5lcnMgYW5kIGRlbGV0ZSBmcm9tIHBvcnQgbWFwXG4gIGZ1bmN0aW9uIG9uRGlzY29ubmVjdCgpIHtcbiAgICAvLyBsaXN0ZW5lcnM6XG4gICAgcG9ydC5vbkRpc2Nvbm5lY3QucmVtb3ZlTGlzdGVuZXIoX29uRGlzY29ubmVjdCk7XG4gICAgcG9ydC5vbk1lc3NhZ2UucmVtb3ZlTGlzdGVuZXIoX29uQ3VzdG9tTXNnKTtcbiAgICBkZWxldGUgdGhpcy5leHRQb3J0c1tleHRlbnNpb25JZF07XG4gICAgLy8gY2xvc2UgYWxsIHBlbmRpbmcgcmVxdWVzdHM6XG4gICAgdGhpcy5jbG9zZVBlbmRpbmdSZXFzKGV4dGVuc2lvbklkKTtcbiAgICAvLyBpbnZva2UgY3VzdG9tIG9uRGlzY29ubmVjdCBoYW5kbGVyXG4gICAgaWYgKCdmdW5jdGlvbicgPT09IHR5cGVvZih0aGlzLmhhbmRsZXJzLm9uRXh0ZW5zaW9uRGlzY29ubmVjdCkpIHsgdGhpcy5oYW5kbGVycy5vbkV4dGVuc2lvbkRpc2Nvbm5lY3QoZXh0ZW5zaW9uSWQpOyB9XG4gIH1cblxuICAvLyBpbnN0YWxsIHBvcnQgaGFuZGxlcnNcbiAgcG9ydC5vbk1lc3NhZ2UuYWRkTGlzdGVuZXIoX29uQ3VzdG9tTXNnID0gdGhpcy5vbkN1c3RvbU1zZy5iaW5kKHRoaXMpKTtcbiAgcG9ydC5vbkRpc2Nvbm5lY3QuYWRkTGlzdGVuZXIoX29uRGlzY29ubmVjdCA9IG9uRGlzY29ubmVjdC5iaW5kKHRoaXMpKTtcbiAgLy8gaW52b2tlIGN1c3RvbSBvbkNvbm5lY3QgaGFuZGxlclxuICBpZiAoJ2Z1bmN0aW9uJyA9PT0gdHlwZW9mKHRoaXMuaGFuZGxlcnMub25FeHRlbnNpb25Db25uZWN0KSkgeyB0aGlzLmhhbmRsZXJzLm9uRXh0ZW5zaW9uQ29ubmVjdChleHRlbnNpb25JZCk7IH1cbn07XG5cbk1lc3NhZ2luZy5wcm90b3R5cGUub25Db25uZWN0RXh0ZXJuYWwgPSBmdW5jdGlvbihwb3J0KSB7XG4gIGlmICh0aGlzLmV4dFBvcnRzW3BvcnQuc2VuZGVyLmlkXSkge1xuICAgIHJldHVybjtcbiAgfVxuXG4gIHRoaXMucmVnaXN0ZXJFeHRlcm5hbENvbm5lY3Rpb24ocG9ydC5zZW5kZXIuaWQsIHBvcnQpO1xufTtcblxuLy8gYmFja3JvdW5kIG9uQ29ubmVjdCBoYW5kbGVyXG5NZXNzYWdpbmcucHJvdG90eXBlLm9uQ29ubmVjdCA9IGZ1bmN0aW9uKHBvcnQpIHtcbiAgLy8gYWRkIHRvIHBvcnQgbWFwXG4gIHZhciBjYXRlZ05hbWUgPSBwb3J0Lm5hbWUgfHwgJ3Vua25vd24nO1xuICB2YXIgcG9ydElkID0gY2F0ZWdOYW1lICsgJy0nICsgdGhpcy51SWQ7XG4gIHRoaXMudUlkKys7XG4gIHZhciBwb3J0Q2F0ZWcgPSB0aGlzLnBvcnRNYXBbY2F0ZWdOYW1lXSB8fCB7fTtcbiAgdmFyIHRhYklkID0gKHBvcnQuc2VuZGVyICYmIHBvcnQuc2VuZGVyLnRhYiAmJiBwb3J0LnNlbmRlci50YWIuaWQpIHx8IEluZmluaXR5O1xuICBwb3J0Q2F0ZWdbcG9ydElkXSA9IHtcbiAgICBwb3J0OiBwb3J0LFxuICAgIHRhYklkOiB0YWJJZFxuICB9O1xuICB0aGlzLnBvcnRNYXBbY2F0ZWdOYW1lXSA9IHBvcnRDYXRlZztcbiAgdmFyIF9vbkN1c3RvbU1zZyxfb25EaXNjb25uZWN0O1xuICAvLyBvbiBkaXNjb25uZWN0OiByZW1vdmUgbGlzdGVuZXJzIGFuZCBkZWxldGUgZnJvbSBwb3J0IG1hcFxuICBmdW5jdGlvbiBvbkRpc2Nvbm5lY3QoKSB7XG4gICAgLy8gbGlzdGVuZXJzOlxuICAgIHBvcnQub25EaXNjb25uZWN0LnJlbW92ZUxpc3RlbmVyKF9vbkRpc2Nvbm5lY3QpO1xuICAgIHBvcnQub25NZXNzYWdlLnJlbW92ZUxpc3RlbmVyKF9vbkN1c3RvbU1zZyk7XG4gICAgLy8gcG9ydCBtYXA6XG4gICAgcG9ydENhdGVnID0gdGhpcy5wb3J0TWFwW2NhdGVnTmFtZV07XG4gICAgdmFyIF9wb3J0O1xuICAgIGlmIChwb3J0Q2F0ZWcgJiYgKF9wb3J0ID0gcG9ydENhdGVnW3BvcnRJZF0pKSB7XG4gICAgICB0YWJJZCA9IF9wb3J0LnRhYklkO1xuICAgICAgZGVsZXRlIHBvcnRDYXRlZ1twb3J0SWRdO1xuICAgIH1cbiAgICAvLyBjbG9zZSBhbGwgcGVuZGluZyByZXF1ZXN0czpcbiAgICB0aGlzLmNsb3NlUGVuZGluZ1JlcXMocG9ydElkKTtcbiAgICAvLyBpbnZva2UgY3VzdG9tIG9uRGlzY29ubmVjdCBoYW5kbGVyXG4gICAgaWYgKCdmdW5jdGlvbicgPT09IHR5cGVvZih0aGlzLmhhbmRsZXJzLm9uRGlzY29ubmVjdCkpIHsgdGhpcy5oYW5kbGVycy5vbkRpc2Nvbm5lY3QoY2F0ZWdOYW1lLCB0YWJJZCk7IH1cbiAgfVxuICAvLyBpbnN0YWxsIHBvcnQgaGFuZGxlcnNcbiAgcG9ydC5vbk1lc3NhZ2UuYWRkTGlzdGVuZXIoX29uQ3VzdG9tTXNnID0gdGhpcy5vbkN1c3RvbU1zZy5iaW5kKHRoaXMpKTtcbiAgcG9ydC5vbkRpc2Nvbm5lY3QuYWRkTGlzdGVuZXIoX29uRGlzY29ubmVjdCA9IG9uRGlzY29ubmVjdC5iaW5kKHRoaXMpKTtcbiAgLy8gYXNrIGNvdW50ZXIgcGFydCB0byBzZXQgaXRzIGlkXG4gIHBvcnQucG9zdE1lc3NhZ2UoeyBjbWQ6ICdzZXROYW1lJywgbmFtZTogcG9ydElkIH0pO1xuICAvLyBpbnZva2UgY3VzdG9tIG9uQ29ubmVjdCBoYW5kbGVyXG4gIGlmICgnZnVuY3Rpb24nID09PSB0eXBlb2YodGhpcy5oYW5kbGVycy5vbkNvbm5lY3QpKSB7IHRoaXMuaGFuZGxlcnMub25Db25uZWN0KGNhdGVnTmFtZSwgdGFiSWQpOyB9XG59O1xuXG4vLyBjcmVhdGUgbWFpbiBtZXNzYWdpbmcgb2JqZWN0LCBoaWRpbmcgYWxsIHRoZSBjb21wbGV4aXR5IGZyb20gdGhlIHVzZXJcbi8vIGl0IHRha2VzIG5hbWUgb2YgbG9jYWwgY29udGV4dCBgbXlDb250ZXh0TmFtZWBcbi8vXG4vLyB0aGUgcmV0dXJuZWQgb2JqZWN0IGhhcyB0d28gbWFpbiBmdW5jdGlvbnM6IGNtZCBhbmQgYmNhc3Rcbi8vXG4vLyB0aGV5IGJlaGF2ZSB0aGUgc2FtZSB3YXkgYW5kIGhhdmUgYWxzbyB0aGUgc2FtZSBhcmd1bWVudHMsIHRoZSBvbmx5XG4vLyBkaWZmZXJlbmNlIGlzIHRoYXQgdG8gYGNtZGAgY2FsbGJhY2sgKGlmIHByb3ZpZGVkKSBpcyBpbnZva2VkIHdpdGggb25seSBvbmVcbi8vIHJlc3BvbnNlIHZhbHVlIGZyb20gYWxsIHBvc3NpYmxlIHJlc3BvbnNlcywgd2hpbGUgdG8gYGJjYXN0YCBjYWxsYmFjayAoaWZcbi8vIHByb3ZpZGVkKSB3ZSBwYXNzIGFycmF5IHdpdGggYWxsIHZhbGlkIHJlc3BvbnNlcyB3ZSBjb2xsZWN0ZWQgd2hpbGVcbi8vIGJyb2FkY2FzdGluZyBnaXZlbiByZXF1ZXN0LlxuLy9cbi8vIGZ1bmN0aW9ucyBhcmd1bWVudHM6XG4vL1xuLy8gKG9wdGlvbmFsKSBbaW50XSB0YWJJZDogaWYgbm90IHNwZWNpZmllZCwgYnJvYWRjYXN0ZWQgdG8gYWxsIHRhYnMsXG4vLyAgICAgIGlmIHNwZWNpZmllZCwgc2VudCBvbmx5IHRvIGdpdmVuIHRhYiwgY2FuIHVzZSBTQU1FX1RBQiB2YWx1ZSBoZXJlXG4vL1xuLy8gKG9wdGlvbmFsKSBbYXJyYXldIGNvbnRleHRzOiBpZiBub3Qgc3BlY2lmaWVkLCBicm9hZGNhc3RlZCB0byBhbGwgY29udGV4dHMsXG4vLyAgICAgIGlmIHNwZWNpZmllZCwgc2VudCBvbmx5IHRvIGxpc3RlZCBjb250ZXh0c1xuLy9cbi8vIChyZXF1aXJlZCkgW3N0cmluZ10gY29tbWFuZDogbmFtZSBvZiB0aGUgY29tbWFuZCB0byBiZSBleGVjdXRlZFxuLy9cbi8vIChvcHRpb25hbCkgW2FueSB0eXBlXSBhcmd1bWVudHM6IGFueSBudW1iZXIgb2YgYXJ1bWVudHMgdGhhdCBmb2xsb3cgY29tbWFuZFxuLy8gICAgICBuYW1lIGFyZSBwYXNzZWQgdG8gZXhlY3V0aW9uIGhhbmRsZXIgd2hlbiBpdCBpcyBpbnZva2VkXG4vL1xuLy8gKG9wdGlvbmFsKSBbZnVuY3Rpb24ocmVzdWx0KV0gY2FsbGJhY2s6IGlmIHByb3ZpZGVkIChhcyBsYXN0IGFyZ3VtZW50IHRvXG4vLyAgICAgIGBjbWRgIG9yIGBiY2FzdGApIHRoaXMgZnVuY3Rpb24gd2lsbCBiZSBpbnZva2VkIHdoZW4gdGhlIHJlc3BvbnNlKHMpXG4vLyAgICAgIGlzL2FyZSByZWNlaXZlZFxuLy9cbi8vIHRoZSBmdW5jdGlvbnMgcmV0dXJuIGB0cnVlYCBpZiB0aGUgcHJvY2Vzc2luZyBvZiB0aGUgcmVxdWVzdCB3YXMgc3VjY2Vzc2Z1bFxuLy8gKGkuZS4gaWYgYWxsIHRoZSBhcmd1bWVudHMgd2VyZSByZWNvZ25pemVkIHByb3Blcmx5KSwgb3RoZXJ3aXNlIGl0IHJldHVybnNcbi8vIGBmYWxzZWAuXG4vL1xuLy8gZm9yIG5vbi1iZyBjb250ZXh0cyB0aGVyZSBpcyBvbmUgbW9yZSBmdW5jdGlvbiBpbiB0aGUgbWVzc2FnaW5nIG9iamVjdFxuLy8gYXZhaWxhYmxlOiAnYmcnIGZ1bmN0aW9uLCB0aGF0IGlzIHRoZSBzYW1lIGFzICdjbWQnLCBidXQgcHJlcGVuZHMgdGhlIGxpc3Qgb2Zcbi8vIGFyZ3VtZW50cyB3aXRoIFsnYmcnXSwgc28gdGhhdCB0aGUgdXNlciBkb2Vzbid0IGhhdmUgdG8gd3JpdGUgaXQgd2hlblxuLy8gcmVxdWVzdGluZyBzb21lIGluZm8gaW4gbm9uLWJnIGNvbnRleHQgZnJvbSBiYWNrZ3JvdW5kLlxuLy9cbk1lc3NhZ2luZy5wcm90b3R5cGUuY3JlYXRlTXNnT2JqZWN0ID0gZnVuY3Rpb24obXlDb250ZXh0TmFtZSkge1xuICAvLyBnZW5lcmF0b3IgZm9yIGZ1bmN0aW9ucyBgY21kYCBhbmQgYGJjYXN0YFxuICBmdW5jdGlvbiBjcmVhdGVGbihicm9hZGNhc3QpIHtcbiAgICAvLyBoZWxwZXIgZnVuY3Rpb24gZm9yIGludm9raW5nIHByb3ZpZGVkIGNhbGxiYWNrIGluIGJhY2tncm91bmRcbiAgICBmdW5jdGlvbiBjcmVhdGVDYkZvck1vcmVSZXN1bHRzKE4sIGNhbGxiYWNrKSB7XG4gICAgICB2YXIgcmVzdWx0cyA9IFtdO1xuICAgICAgcmV0dXJuIGZ1bmN0aW9uKHJlc3VsdCwgcmVzdWx0VmFsaWQpIHtcbiAgICAgICAgaWYgKHJlc3VsdFZhbGlkKSB7XG4gICAgICAgICAgcmVzdWx0cy5wdXNoKHJlc3VsdCk7XG4gICAgICAgIH1cbiAgICAgICAgTi0tO1xuICAgICAgICBpZiAoKE4gPD0gMCkgJiYgY2FsbGJhY2spIHtcbiAgICAgICAgICBjYWxsYmFjayhicm9hZGNhc3QgPyByZXN1bHRzIDogcmVzdWx0c1swXSk7XG4gICAgICAgIH1cbiAgICAgIH07XG4gICAgfVxuICAgIC8vIGdlbmVyYXRlZCBmdW5jdGlvbjpcbiAgICByZXR1cm4gZnVuY3Rpb24gX21zZygpIHtcbiAgICAgIC8vIHByb2Nlc3MgYXJndW1lbnRzOlxuICAgICAgaWYgKCFhcmd1bWVudHMubGVuZ3RoKSB7XG4gICAgICAgIC8vIGF0IGxlYXN0IGNvbW1hbmQgbmFtZSBtdXN0IGJlIHByb3ZpZGVkXG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgIH1cbiAgICAgIGlmICghdGhpcy5pZCkge1xuICAgICAgICAvLyBzaW5jZSB3ZSBsZWFybiBvdXIgaWQgb2Ygbm9uLWJhY2tncm91bmQgY29udGV4dCBpbiBhc3luY2hyb25vdXNcbiAgICAgICAgLy8gbWVzc2FnZSwgd2UgbWF5IG5lZWQgdG8gd2FpdCBmb3IgaXQuLi5cbiAgICAgICAgdmFyIF9jdHggPSB0aGlzLCBfYXJncyA9IGFyZ3VtZW50cztcbiAgICAgICAgc2V0VGltZW91dChmdW5jdGlvbigpIHsgX21zZy5hcHBseShfY3R4LCBfYXJncyk7IH0sIDEpO1xuICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgIH1cbiAgICAgIHZhciB0YWJJZCwgY29udGV4dHMsIGNtZE5hbWUsIGFyZ3MgPSBbXSwgY2FsbGJhY2s7XG4gICAgICB2YXIgY3VyQXJnID0gMCwgYXJnc0xpbWl0ID0gYXJndW1lbnRzLmxlbmd0aDtcbiAgICAgIC8vIGNoZWNrIGlmIHdlIGhhdmUgY2FsbGJhY2s6XG4gICAgICBpZiAodHlwZW9mKGFyZ3VtZW50c1thcmdzTGltaXQtMV0pID09PSAnZnVuY3Rpb24nKSB7XG4gICAgICAgIGFyZ3NMaW1pdC0tO1xuICAgICAgICBjYWxsYmFjayA9IGFyZ3VtZW50c1thcmdzTGltaXRdO1xuICAgICAgfVxuICAgICAgLy8gb3RoZXIgYXJndW1lbnRzOlxuICAgICAgd2hpbGUgKGN1ckFyZyA8IGFyZ3NMaW1pdCkge1xuICAgICAgICB2YXIgYXJnID0gYXJndW1lbnRzW2N1ckFyZysrXTtcbiAgICAgICAgaWYgKGNtZE5hbWUgIT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgIGFyZ3MucHVzaChhcmcpO1xuICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICB9XG4gICAgICAgIC8vIHdlIGRvbid0IGhhdmUgY29tbWFuZCBuYW1lIHlldC4uLlxuICAgICAgICBzd2l0Y2ggKHR5cGVvZihhcmcpKSB7XG4gICAgICAgICAgLy8gdGFiIGlkXG4gICAgICAgICAgY2FzZSAnbnVtYmVyJzpcbiAgICAgICAgICAgIGlmICh0YWJJZCAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICAgIHJldHVybiBmYWxzZTsgLy8gd2UgYWxyZWFkeSBoYXZlIHRhYiBpZCAtLT4gaW52YWxpZCBhcmdzXG4gICAgICAgICAgICB9XG4gICAgICAgICAgICB0YWJJZCA9IGFyZztcbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgIC8vIGNvbnRleHRzICAoYXJyYXkpXG4gICAgICAgICAgY2FzZSAnb2JqZWN0JzpcbiAgICAgICAgICAgIGlmICgodHlwZW9mKGFyZy5sZW5ndGgpID09PSAndW5kZWZpbmVkJykgfHwgKGNvbnRleHRzICE9PSB1bmRlZmluZWQpKSB7XG4gICAgICAgICAgICAgIHJldHVybiBmYWxzZTsgLy8gd2UgZWl0aGVyIGhhdmUgaXQsIG9yIGl0IGlzIG5vdCBhcnJheS1saWtlIG9iamVjdFxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgY29udGV4dHMgPSBhcmc7XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAvLyBjb21tYW5kIG5hbWVcbiAgICAgICAgICBjYXNlICdzdHJpbmcnOlxuICAgICAgICAgICAgY21kTmFtZSA9IGFyZztcbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgIC8vIGFueXRoaW5nIGVsc2UgLS0+IGVycm9yXG4gICAgICAgICAgZGVmYXVsdDpcbiAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgaWYgKGNtZE5hbWUgPT09IHVuZGVmaW5lZCkge1xuICAgICAgICByZXR1cm4gZmFsc2U7IC8vIGNvbW1hbmQgbmFtZSBpcyBtYW5kYXRvcnlcbiAgICAgIH1cbiAgICAgIC8vIHN0b3JlIHRoZSBjYWxsYmFjayBhbmQgaXNzdWUgdGhlIHJlcXVlc3QgKG1lc3NhZ2UpXG4gICAgICBpZiAoJ2JnJyA9PT0gdGhpcy5pZCkge1xuICAgICAgICB2YXIgdGFyZ2V0UG9ydHMgPSB0aGlzLnNlbGVjdFRhcmdldHModHJ1ZSwgdGFiSWQsIGNvbnRleHRzKTtcbiAgICAgICAgdmFyIHJlc3BvbnNlc05lZWRlZCA9IHRhcmdldFBvcnRzLmxlbmd0aDtcbiAgICAgICAgdmFyIGNiID0gY3JlYXRlQ2JGb3JNb3JlUmVzdWx0cy5jYWxsKHRoaXMsIHJlc3BvbnNlc05lZWRlZCwgY2FsbGJhY2spO1xuICAgICAgICAvLyBzZW5kIHRvIHRhcmdldCBwb3J0c1xuICAgICAgICBmb3IgKHZhciBpID0gMDsgaSA8IHRhcmdldFBvcnRzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgdmFyIF9wb3J0ID0gdGFyZ2V0UG9ydHNbaV07XG4gICAgICAgICAgX3BvcnQucG9ydC5wb3N0TWVzc2FnZSh7XG4gICAgICAgICAgICBjbWQ6ICdyZXF1ZXN0JyxcbiAgICAgICAgICAgIGNtZE5hbWU6IGNtZE5hbWUsXG4gICAgICAgICAgICBzZW5kUmVzcG9uc2U6IHRydWUsXG4gICAgICAgICAgICBhcmdzOiBhcmdzLFxuICAgICAgICAgICAgcmVxSWQ6IHRoaXMucmVxdWVzdElkXG4gICAgICAgICAgfSk7XG4gICAgICAgICAgdmFyIF9hcnIgPSB0aGlzLnBlbmRpbmdSZXFzW19wb3J0LmlkXSB8fCBbXTtcbiAgICAgICAgICBfYXJyLnB1c2goeyBpZDogdGhpcy5yZXF1ZXN0SWQsIGNiOiBjYiB9KTtcbiAgICAgICAgICB0aGlzLnBlbmRpbmdSZXFzW19wb3J0LmlkXSA9IF9hcnI7XG4gICAgICAgICAgdGhpcy5yZXF1ZXN0SWQrKztcbiAgICAgICAgfVxuICAgICAgICBpZiAoIXRhcmdldFBvcnRzLmxlbmd0aCkge1xuICAgICAgICAgIC8vIG5vIG9uZSB0byByZXNwb25kLCBpbnZva2UgdGhlIGNhbGxiYWNrIChpZiBwcm92aWRlZCkgcmlnaHQgYXdheVxuICAgICAgICAgIGNiKG51bGwsIGZhbHNlKTtcbiAgICAgICAgfVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgaWYgKGNhbGxiYWNrKSB7XG4gICAgICAgICAgdGhpcy5jYlRhYmxlW3RoaXMucmVxdWVzdElkXSA9IGNhbGxiYWNrO1xuICAgICAgICB9XG4gICAgICAgIHRoaXMucG9ydC5wb3N0TWVzc2FnZSh7XG4gICAgICAgICAgY21kOiAncmVxdWVzdCcsXG4gICAgICAgICAgY21kTmFtZTogY21kTmFtZSxcbiAgICAgICAgICByZXFJZDogdGhpcy5yZXF1ZXN0SWQsXG4gICAgICAgICAgc2VuZFJlc3BvbnNlOiAoY2FsbGJhY2sgIT09IHVuZGVmaW5lZCksXG4gICAgICAgICAgYnJvYWRjYXN0OiBicm9hZGNhc3QsXG4gICAgICAgICAgY2F0ZWdvcnk6IG15Q29udGV4dE5hbWUsXG4gICAgICAgICAgcG9ydElkOiB0aGlzLmlkLFxuICAgICAgICAgIHRhYklkOiB0YWJJZCxcbiAgICAgICAgICBjb250ZXh0czogY29udGV4dHMsXG4gICAgICAgICAgYXJnczogYXJnc1xuICAgICAgICB9KTtcbiAgICAgICAgdGhpcy5yZXF1ZXN0SWQrKztcbiAgICAgIH1cbiAgICAgIC8vIGV2ZXJ5dGhpbmcgd2VudCBPS1xuICAgICAgcmV0dXJuIHRydWU7XG4gICAgfS5iaW5kKHRoaXMpO1xuICB9XG5cbiAgZnVuY3Rpb24gY3JlYXRlQ21kRXh0Rm4oKSB7XG4gICAgcmV0dXJuIGZ1bmN0aW9uIF9tc2coZXh0ZW5zaW9uSWQsIGNvbW1hbmROYW1lKSB7XG4gICAgICAvLyBwcm9jZXNzIGFyZ3VtZW50czpcbiAgICAgIGlmIChhcmd1bWVudHMubGVuZ3RoIDwgMikge1xuICAgICAgICAvLyBhdCBsZWFzdCBleHRlbnNpb24gaWQgYW5kIGNvbW1hbmQgbmFtZSBtdXN0IGJlIHByb3ZpZGVkXG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgIH1cblxuICAgICAgaWYgKHRoaXMuaWQgIT09ICdiZycpIHtcbiAgICAgICAgcmV0dXJuIGZhbHNlOyAvLyBvbmx5IGJhY2tncm91bmQgY2FuIHNlbmQgbWVzc2FnZXNzIHRvIGFub3RoZXIgZXh0ZW5zaW9uc1xuICAgICAgfVxuXG4gICAgICB2YXIgYXJncyA9IEFycmF5LnByb3RvdHlwZS5zbGljZS5jYWxsKGFyZ3VtZW50cywgMik7XG4gICAgICB2YXIgY2FsbGJhY2s7XG4gICAgICBpZiAodHlwZW9mKGFyZ3NbYXJncy5sZW5ndGggLSAxXSkgPT09ICdmdW5jdGlvbicpIHtcbiAgICAgICAgY2FsbGJhY2sgPSBhcmdzLnBvcCgpO1xuICAgICAgfVxuXG4gICAgICB2YXIgX3BvcnQgPSB0aGlzLmV4dFBvcnRzW2V4dGVuc2lvbklkXTtcbiAgICAgIGlmICghX3BvcnQpIHtcbiAgICAgICAgLy8gbm8gb25lIHRvIHJlc3BvbmQsIGludm9rZSB0aGUgY2FsbGJhY2sgKGlmIHByb3ZpZGVkKSByaWdodCBhd2F5XG4gICAgICAgIGlmIChjYWxsYmFjaykgeyBjYWxsYmFjaygpOyB9XG5cbiAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICB9XG5cbiAgICAgIF9wb3J0LnBvcnQucG9zdE1lc3NhZ2Uoe1xuICAgICAgICBjbWQ6ICdyZXF1ZXN0JyxcbiAgICAgICAgY21kTmFtZTogY29tbWFuZE5hbWUsXG4gICAgICAgIHNlbmRSZXNwb25zZTogdHJ1ZSxcbiAgICAgICAgYXJnczogYXJncyxcbiAgICAgICAgcmVxSWQ6IHRoaXMucmVxdWVzdElkLFxuICAgICAgICBleHRlbnNpb25JZDogdGhpcy5ydW50aW1lLmlkXG4gICAgICB9KTtcblxuICAgICAgdmFyIF9hcnIgPSB0aGlzLnBlbmRpbmdSZXFzW2V4dGVuc2lvbklkXSB8fCBbXTtcbiAgICAgIF9hcnIucHVzaCh7aWQ6IHRoaXMucmVxdWVzdElkLFxuICAgICAgICBjYjogZnVuY3Rpb24ocmVzdWx0LyosIHJlc3VsdFZhbGlkLyoqLykgeyAvLyBpZ25vcmUgJ3Jlc3VsdFZhbGlkJyBiZWNhdXNlIGl0IGlzIG5vdCBhcHBsaWNhYmxlIGhlcmVcbiAgICAgICAgICBpZiAoY2FsbGJhY2spIHsgY2FsbGJhY2socmVzdWx0KTsgfVxuICAgICAgICB9XG4gICAgICB9KTtcbiAgICAgIHRoaXMucGVuZGluZ1JlcXNbZXh0ZW5zaW9uSWRdID0gX2FycjtcbiAgICAgIHRoaXMucmVxdWVzdElkKys7XG5cbiAgICAgIC8vIGV2ZXJ5dGhpbmcgd2VudCBPS1xuICAgICAgcmV0dXJuIHRydWU7XG4gICAgfS5iaW5kKHRoaXMpO1xuICB9XG5cbiAgLy8gcmV0dXJuZWQgb2JqZWN0OlxuICB2YXIgcmVzID0ge1xuICAgIGNtZDogY3JlYXRlRm4uY2FsbCh0aGlzLCBmYWxzZSksXG4gICAgYmNhc3Q6IGNyZWF0ZUZuLmNhbGwodGhpcywgdHJ1ZSlcbiAgfTtcblxuICAvLyBmb3IgbW9yZSBjb252ZW5pZW5jZSAod2hlbiBzZW5kaW5nIHJlcXVlc3QgZnJvbSBub24tYmcgdG8gYmFja2dyb3VuZCBvbmx5KVxuICAvLyBhZGRpbmcgJ2JnKDxjbWROYW1lPiwgLi4uKScgZnVuY3Rpb24sIHRoYXQgaXMgZXF1aXZhbGVudCB0byBcImNtZChbJ2JnJ10sIDxjbWROYW1lPiwgLi4uKVwiXG4gIGlmIChteUNvbnRleHROYW1lICE9PSAnYmcnKSB7XG4gICAgcmVzLmJnID0gZnVuY3Rpb24oKSB7XG4gICAgICBpZiAoMCA9PT0gYXJndW1lbnRzLmxlbmd0aCB8fCAnc3RyaW5nJyAhPT0gdHlwZW9mKGFyZ3VtZW50c1swXSkpIHtcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgfVxuICAgICAgdmFyIGFyZ3MgPSBbWydiZyddXTtcbiAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgYXJndW1lbnRzLmxlbmd0aDsgaSsrKSB7IGFyZ3MucHVzaChhcmd1bWVudHNbaV0pOyB9XG4gICAgICByZXR1cm4gcmVzLmNtZC5hcHBseShyZXMsIGFyZ3MpO1xuICAgIH07XG4gIH1cbiAgZWxzZSB7XG4gICAgcmVzLmNvbm5lY3RFeHQgPSBmdW5jdGlvbihpZCkge1xuICAgICAgaWYgKHRoaXMuZXh0UG9ydHNbaWRdKSB7IC8vIGFscmVhZHkgY29ubmVjdGVkXG4gICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgfVxuICAgICAgdmFyIHBvcnQgPSB0aGlzLnJ1bnRpbWUuY29ubmVjdChpZCk7XG4gICAgICB0aGlzLnJlZ2lzdGVyRXh0ZXJuYWxDb25uZWN0aW9uKGlkLCBwb3J0KTtcbiAgICB9LmJpbmQodGhpcyk7XG4gICAgcmVzLmNtZEV4dCA9IGNyZWF0ZUNtZEV4dEZuLmNhbGwodGhpcyk7XG4gIH1cblxuICByZXR1cm4gcmVzO1xufTtcblxuLy8gaW5pdCBmdW5jdGlvbiwgZXhwb3J0ZWRcbi8vXG4vLyB0YWtlcyBtYW5kYXRvcnkgYGNvbnRleHRgLCBpdCBpcyBhbnkgc3RyaW5nIChlLmcuICdjdCcsICdwb3B1cCcsIC4uLiksXG4vLyBvbmx5IG9uZSB2YWx1ZSBpcyBvZiBzcGVjaWFsIG1lYW5pbmc6ICdiZycgLi4uIG11c3QgYmUgdXNlZCBmb3IgaW5pdGlhbGl6aW5nXG4vLyBvZiB0aGUgYmFja2dyb3VuZCBwYXJ0LCBhbnkgb3RoZXIgY29udGV4dCBpcyBjb25zaWRlcmVkIG5vbi1iYWNrZ3JvdW5kXG4vL1xuLy8gb3B0aW9uYWxseSB0YWtlcyBgaGFuZGxlcnNgLCB3aGljaCBpcyBvYmplY3QgbWFwcGluZyBmdW5jdGlvbiBuYW1lcyB0b1xuLy8gZnVuY3Rpb24gY29kZXMsIHRoYXQgaXMgdXNlZCBhcyBmdW5jdGlvbiBsb29rdXAgdGFibGUuIGVhY2ggbWVzc2FnZSBoYW5kbGluZ1xuLy8gZnVuY3Rpb24gTVVTVCB0YWtlIGNhbGxiYWNrIGFzIGl0cyBsYXN0IGFyZ3VtZW50IGFuZCBpbnZva2UgdGhpcyBjYWxsYmFja1xuLy8gd2hlbiB0aGUgbWVzc2FnZSBoYW5kbGVyIGlzIGRvbmUgd2l0aCBwcm9jZXNzaW5nIG9mIHRoZSBtZXNzYWdlIChyZWdhcmRsZXNzXG4vLyBpZiBzeW5jaHJvbm91cyBvciBhc3luY2hyb25vdXMpLiB0aGUgY2FsbGJhY2sgdGFrZXMgb25lIGFyZ3VtZW50LCB0aGlzXG4vLyBhcmd1bWVudCBpcyB0cmVhdGVkIGFzIHJldHVybiB2YWx1ZSBvZiB0aGUgbWVzc2FnZSBoYW5kbGVyLlxuLy9cbi8vIGZvciBiYWNrZ3JvdW5kIChgY29udGV4dGAgaXMgJ2JnJyk6IGluc3RhbGxzIG9uQ29ubmVjdCBsaXN0ZW5lclxuLy8gZm9yIG5vbi1iYWNrZ3JvdW5kIGNvbnRleHQgaXQgY29ubmVjdHMgdG8gYmFja2dyb3VuZFxuLy9cbk1lc3NhZ2luZy5wcm90b3R5cGUuaW5pdCA9IGZ1bmN0aW9uKGNvbnRleHQsIGhhbmRsZXJzKSB7XG4gIC8vIHNldCBtZXNzYWdlIGhhbmRsZXJzIChvcHRpb25hbClcbiAgdGhpcy5oYW5kbGVycyA9IGhhbmRsZXJzIHx8IHt9O1xuXG4gIC8vIGxpc3RlbmVyIHJlZmVyZW5jZXNcbiAgdmFyIF9vbkRpc2Nvbm5lY3QsIF9vbkN1c3RvbU1zZztcblxuICAvLyBoZWxwZXIgZnVuY3Rpb246XG4gIGZ1bmN0aW9uIG9uRGlzY29ubmVjdCgpIHtcbiAgICB0aGlzLnBvcnQub25EaXNjb25uZWN0LnJlbW92ZUxpc3RlbmVyKF9vbkRpc2Nvbm5lY3QpO1xuICAgIHRoaXMucG9ydC5vbk1lc3NhZ2UucmVtb3ZlTGlzdGVuZXIoX29uQ3VzdG9tTXNnKTtcbiAgfVxuXG4gIHZhciBfdGFiSWQ7XG4gIGZ1bmN0aW9uIF91cGRhdGVUYWJJZCgpIHtcbiAgICBpZiAoIXRoaXMuaWQpIHtcbiAgICAgIHNldFRpbWVvdXQoX3VwZGF0ZVRhYklkLmJpbmQodGhpcyksIDEpO1xuICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICB0aGlzLnBvcnQucG9zdE1lc3NhZ2Uoe1xuICAgICAgY21kOiAndXBkYXRlVGFiSWQnLFxuICAgICAgY29udGV4dDogY29udGV4dCxcbiAgICAgIHBvcnRJZDogdGhpcy5pZCxcbiAgICAgIHRhYklkOiBfdGFiSWRcbiAgICB9KTtcbiAgfVxuXG4gIGlmICgnYmcnID09PSBjb250ZXh0KSB7XG4gICAgLy8gYmFja2dyb3VuZFxuICAgIHRoaXMuaWQgPSAnYmcnO1xuICAgIHRoaXMucnVudGltZS5vbkNvbm5lY3QuYWRkTGlzdGVuZXIodGhpcy5vbkNvbm5lY3QuYmluZCh0aGlzKSk7XG4gICAgdGhpcy5ydW50aW1lLm9uQ29ubmVjdEV4dGVybmFsLmFkZExpc3RlbmVyKHRoaXMub25Db25uZWN0RXh0ZXJuYWwuYmluZCh0aGlzKSk7XG4gIH0gZWxzZSB7XG4gICAgLy8gYW55dGhpbmcgZWxzZSB0aGFuIGJhY2tncm91bmRcbiAgICB0aGlzLnBvcnQgPSB0aGlzLnJ1bnRpbWUuY29ubmVjdCh7IG5hbWU6IGNvbnRleHQgfSk7XG4gICAgdGhpcy5wb3J0Lm9uTWVzc2FnZS5hZGRMaXN0ZW5lcihfb25DdXN0b21Nc2cgPSB0aGlzLm9uQ3VzdG9tTXNnLmJpbmQodGhpcykpO1xuICAgIHRoaXMucG9ydC5vbkRpc2Nvbm5lY3QuYWRkTGlzdGVuZXIoX29uRGlzY29ubmVjdCA9IG9uRGlzY29ubmVjdC5iaW5kKHRoaXMpKTtcbiAgICAvLyB0YWJJZCB1cGRhdGUgZm9yIGRldmVsb3BlciB0b29sc1xuICAgIC8vIHVuZm9ydHVuYXRlbHkgd2UgbmVlZCBkZWRpY2F0ZWQgbmFtZSBmb3IgZGV2ZWxvcGVyIHRvb2xzIGNvbnRleHQsIGR1ZSB0b1xuICAgIC8vIHRoaXMgYnVnOiBodHRwczovL2NvZGUuZ29vZ2xlLmNvbS9wL2Nocm9taXVtL2lzc3Vlcy9kZXRhaWw/aWQ9MzU2MTMzXG4gICAgLy8gLi4uIHdlIGFyZSBub3QgYWJsZSB0byB0ZWxsIGlmIHdlIGFyZSBpbiBEVCBjb250ZXh0IG90aGVyd2lzZSA6KFxuICAgIGlmICggKCdkdCcgPT09IGNvbnRleHQpICYmIHRoaXMuZGV2dG9vbHMgJiYgKF90YWJJZCA9IHRoaXMuZGV2dG9vbHMuaW5zcGVjdGVkV2luZG93KSAmJlxuICAgICAgICAgKCdudW1iZXInID09PSB0eXBlb2YoX3RhYklkID0gX3RhYklkLnRhYklkKSkgKSB7XG4gICAgICBfdXBkYXRlVGFiSWQuY2FsbCh0aGlzKTtcbiAgICB9XG4gIH1cblxuICByZXR1cm4gdGhpcy5jcmVhdGVNc2dPYmplY3QoY29udGV4dCk7XG59O1xuXG5cbi8vIHNpbmdsZXRvbiByZXByZXNlbnRpbmcgdGhpcyBtb2R1bGVcbnZhciBzaW5nbGV0b24gPSBuZXcgTWVzc2FnaW5nKCk7XG5cbi8vIGhlbHBlciBmdW5jdGlvbiB0byBpbnN0YWxsIG1ldGhvZHMgdXNlZCBmb3IgdW5pdCB0ZXN0c1xuZnVuY3Rpb24gaW5zdGFsbFVuaXRUZXN0TWV0aG9kcyh0YXJnZXQsIGRlbGVnYXRlKSB7XG4gIC8vIHNldHRlcnNcbiAgdGFyZ2V0Ll9fc2V0UnVudGltZSA9IGZ1bmN0aW9uKHJ0KSB7IGRlbGVnYXRlLnJ1bnRpbWUgPSBydDsgcmV0dXJuIHRhcmdldDsgfTtcbiAgdGFyZ2V0Ll9fc2V0RGV2VG9vbHMgPSBmdW5jdGlvbihkdCkgeyBkZWxlZ2F0ZS5kZXZ0b29scyA9IGR0OyByZXR1cm4gdGFyZ2V0OyB9O1xuICAvLyBnZXR0ZXJzXG4gIHRhcmdldC5fX2dldElkID0gZnVuY3Rpb24oKSB7IHJldHVybiBkZWxlZ2F0ZS5pZDsgfTtcbiAgdGFyZ2V0Ll9fZ2V0UG9ydCA9IGZ1bmN0aW9uKCkgeyByZXR1cm4gZGVsZWdhdGUucG9ydDsgfTtcbiAgdGFyZ2V0Ll9fZ2V0UG9ydE1hcCA9IGZ1bmN0aW9uKCkgeyByZXR1cm4gZGVsZWdhdGUucG9ydE1hcDsgfTtcbiAgdGFyZ2V0Ll9fZ2V0SGFuZGxlcnMgPSBmdW5jdGlvbigpIHsgcmV0dXJuIGRlbGVnYXRlLmhhbmRsZXJzOyB9O1xuICB0YXJnZXQuX19nZXRQZW5kaW5nUmVxcyA9IGZ1bmN0aW9uKCkgeyByZXR1cm4gZGVsZWdhdGUucGVuZGluZ1JlcXM7IH07XG59XG5cbm1vZHVsZS5leHBvcnRzID0ge1xuICAvLyBzYW1lIHRhYiBpZFxuICBTQU1FX1RBQjogU0FNRV9UQUIsXG4gIC8vIHNlZSBkZXNjcmlwdGlvbiBmb3IgaW5pdCBmdW5jdGlvbiBhYm92ZVxuICBpbml0OiBzaW5nbGV0b24uaW5pdC5iaW5kKHNpbmdsZXRvbiksXG4gIC8vIC0tLSBmb3IgdW5pdCB0ZXN0cyAtLS1cbiAgLy8gYWxsb3cgdW5pdCB0ZXN0aW5nIG9mIHRoZSBtYWluIG1vZHVsZTpcbiAgX19hbGxvd1VuaXRUZXN0czogZnVuY3Rpb24oKSB7IGluc3RhbGxVbml0VGVzdE1ldGhvZHModGhpcywgc2luZ2xldG9uKTsgfSxcbiAgLy8gY29udGV4dCBjbG9uaW5nXG4gIF9fY3JlYXRlQ2xvbmU6IGZ1bmN0aW9uKCkge1xuICAgIHZhciBjbG9uZSA9IG5ldyBNZXNzYWdpbmcoKTtcbiAgICBjbG9uZS5TQU1FX1RBQiA9IFNBTUVfVEFCO1xuICAgIGluc3RhbGxVbml0VGVzdE1ldGhvZHMoY2xvbmUsIGNsb25lKTtcbiAgICByZXR1cm4gY2xvbmU7XG4gIH1cbn07XG4iXX0=
