(function(f){if(typeof exports==="object"&&typeof module!=="undefined"){module.exports=f()}else if(typeof define==="function"&&define.amd){define([],f)}else{var g;if(typeof window!=="undefined"){g=window}else if(typeof global!=="undefined"){g=global}else if(typeof self!=="undefined"){g=self}else{g=this}g.adapter = f()}})(function(){var define,module,exports;return (function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){

},{}],2:[function(require,module,exports){
/*
 *  Copyright (c) 2016 The WebRTC project authors. All Rights Reserved.
 *
 *  Use of this source code is governed by a BSD-style license
 *  that can be found in the LICENSE file in the root of the source
 *  tree.
 */
'use strict';

// Shimming starts here.
(function() {
  // Utils.
  var logging = require('./utils').log;
  var browserDetails = require('./utils').browserDetails;
  // Export to the adapter global object visible in the browser.
  module.exports.browserDetails = browserDetails;
  module.exports.extractVersion = require('./utils').extractVersion;
  module.exports.disableLog = require('./utils').disableLog;

  // Uncomment if you do not want any logging at all including the switch
  // statement below. Can also be turned off in the browser via
  // adapter.disableLog(true) but then logging from the switch statement below
  // will still appear.
  //require('./utils').disableLog(true);

  // Warn if version is not supported regardless of browser.
  // Min version can be set per browser in utils.js
  if (browserDetails.version < browserDetails.minVersion) {
    logging('Browser: ' + browserDetails.browser + ' Version: ' +
        browserDetails.version + ' <' + ' minimum supported version: ' +
        browserDetails.minVersion + '\n some things might not work!');
  }

  // Browser shims.
  var chromeShim = require('./chrome/chrome_shim') || null;
  var edgeShim = require('./edge/edge_shim') || null;
  var firefoxShim = require('./firefox/firefox_shim') || null;

  // Shim browser if found.
  switch (browserDetails.browser) {
    case 'chrome':
      if (!chromeShim||!chromeShim.shimPeerConnection) {
        logging('Chrome shim is not included in this adapter release.');
        return;
      }
      logging('adapter.js shimming chrome!');
      // Export to the adapter global object visible in the browser.
      module.exports.browserShim = chromeShim;

      chromeShim.shimGetUserMedia();
      chromeShim.shimSourceObject();
      chromeShim.shimPeerConnection();
      chromeShim.shimOnTrack();
      break;
    case 'edge':
      if (!edgeShim||!edgeShim.shimPeerConnection) {
        logging('MS edge shim is not included in this adapter release.');
        return;
      }
      logging('adapter.js shimming edge!');
      // Export to the adapter global object visible in the browser.
      module.exports.browserShim = edgeShim;

      edgeShim.shimPeerConnection();
      break;
    case 'firefox':
      if (!firefoxShim||!firefoxShim.shimPeerConnection) {
        logging('Firefox shim is not included in this adapter release.');
        return;
      }
      logging('adapter.js shimming firefox!');
      // Export to the adapter global object visible in the browser.
      module.exports.browserShim = firefoxShim;

      firefoxShim.shimGetUserMedia();
      firefoxShim.shimSourceObject();
      firefoxShim.shimPeerConnection();
      firefoxShim.shimOnTrack();
      break;
    default:
      logging('Unsupported browser!');
  }
})();

},{"./chrome/chrome_shim":3,"./edge/edge_shim":1,"./firefox/firefox_shim":4,"./utils":5}],3:[function(require,module,exports){
/*
 *  Copyright (c) 2016 The WebRTC project authors. All Rights Reserved.
 *
 *  Use of this source code is governed by a BSD-style license
 *  that can be found in the LICENSE file in the root of the source
 *  tree.
 */
'use strict';
var logging = require('../utils.js').log;
var browserDetails = require('../utils.js').browserDetails;

var chromeShim = {
  shimOnTrack: function() {
    if (typeof window === 'object' && window.RTCPeerConnection && !('ontrack' in
        window.RTCPeerConnection.prototype)) {
      Object.defineProperty(window.RTCPeerConnection.prototype, 'ontrack', {
        get: function() { return this._ontrack; },
        set: function(f) {
          var self = this;
          if (this._ontrack) {
            this.removeEventListener('track', this._ontrack);
            this.removeEventListener('addstream', this._ontrackpoly);
          }
          this.addEventListener('track', this._ontrack = f);
          this.addEventListener('addstream', this._ontrackpoly = function(e) {
            // onaddstream does not fire when a track is added to an existing stream.
            // but stream.onaddtrack is implemented so we use that
            e.stream.addEventListener('addtrack', function(te) {
              var event = new Event('track');
              event.track = te.track;
              event.receiver = {track: te.track};
              event.streams = [e.stream];
              self.dispatchEvent(event);
            });
            e.stream.getTracks().forEach(function(track) {
              var event = new Event('track');
              event.track = track;
              event.receiver = {track: track};
              event.streams = [e.stream];
              this.dispatchEvent(event);
            }.bind(this));
          }.bind(this));
        }
      });
    }
  },

  shimSourceObject: function() {
    if (typeof window === 'object') {
      if (window.HTMLMediaElement &&
        !('srcObject' in window.HTMLMediaElement.prototype)) {
        // Shim the srcObject property, once, when HTMLMediaElement is found.
        Object.defineProperty(window.HTMLMediaElement.prototype, 'srcObject', {
          get: function() {
            return this._srcObject;
          },
          set: function(stream) {
            // Use _srcObject as a private property for this shim
            this._srcObject = stream;
            if (this.src) {
              URL.revokeObjectURL(this.src);
            }
            this.src = URL.createObjectURL(stream);
            // We need to recreate the blob url when a track is added or removed.
            // Doing it manually since we want to avoid a recursion.
            stream.addEventListener('addtrack', function() {
              if (self.src) {
                URL.revokeObjectURL(self.src);
              }
              self.src = URL.createObjectURL(stream);
            });
            stream.addEventListener('removetrack', function() {
              if (self.src) {
                URL.revokeObjectURL(self.src);
              }
              self.src = URL.createObjectURL(stream);
            });
          }
        });
      }
    }
  },

  shimPeerConnection: function() {
    // The RTCPeerConnection object.
    window.RTCPeerConnection = function(pcConfig, pcConstraints) {
      // Translate iceTransportPolicy to iceTransports,
      // see https://code.google.com/p/webrtc/issues/detail?id=4869
      logging('PeerConnection');
      if (pcConfig && pcConfig.iceTransportPolicy) {
        pcConfig.iceTransports = pcConfig.iceTransportPolicy;
      }

      var pc = new webkitRTCPeerConnection(pcConfig, pcConstraints); // jscs:ignore requireCapitalizedConstructors
      var origGetStats = pc.getStats.bind(pc);
      pc.getStats = function(selector, successCallback, errorCallback) { // jshint ignore: line
        var self = this;
        var args = arguments;

        // If selector is a function then we are in the old style stats so just
        // pass back the original getStats format to avoid breaking old users.
        if (arguments.length > 0 && typeof selector === 'function') {
          return origGetStats(selector, successCallback);
        }

        var fixChromeStats_ = function(response) {
          var standardReport = {};
          var reports = response.result();
          reports.forEach(function(report) {
            var standardStats = {
              id: report.id,
              timestamp: report.timestamp,
              type: report.type
            };
            report.names().forEach(function(name) {
              standardStats[name] = report.stat(name);
            });
            standardReport[standardStats.id] = standardStats;
          });

          return standardReport;
        };

        if (arguments.length >= 2) {
          var successCallbackWrapper_ = function(response) {
            args[1](fixChromeStats_(response));
          };

          return origGetStats.apply(this, [successCallbackWrapper_, arguments[0]]);
        }

        // promise-support
        return new Promise(function(resolve, reject) {
          if (args.length === 1 && selector === null) {
            origGetStats.apply(self, [
                function(response) {
                  resolve.apply(null, [fixChromeStats_(response)]);
                }, reject]);
          } else {
            origGetStats.apply(self, [resolve, reject]);
          }
        });
      };

      return pc;
    };
    window.RTCPeerConnection.prototype = webkitRTCPeerConnection.prototype;

    // wrap static methods. Currently just generateCertificate.
    if (webkitRTCPeerConnection.generateCertificate) {
      Object.defineProperty(window.RTCPeerConnection, 'generateCertificate', {
        get: function() {
          if (arguments.length) {
            return webkitRTCPeerConnection.generateCertificate.apply(null,
                arguments);
          } else {
            return webkitRTCPeerConnection.generateCertificate;
          }
        }
      });
    }

    // add promise support
    ['createOffer', 'createAnswer'].forEach(function(method) {
      var nativeMethod = webkitRTCPeerConnection.prototype[method];
      webkitRTCPeerConnection.prototype[method] = function() {
        var self = this;
        if (arguments.length < 1 || (arguments.length === 1 &&
            typeof(arguments[0]) === 'object')) {
          var opts = arguments.length === 1 ? arguments[0] : undefined;
          return new Promise(function(resolve, reject) {
            nativeMethod.apply(self, [resolve, reject, opts]);
          });
        } else {
          return nativeMethod.apply(this, arguments);
        }
      };
    });

    ['setLocalDescription', 'setRemoteDescription',
        'addIceCandidate'].forEach(function(method) {
      var nativeMethod = webkitRTCPeerConnection.prototype[method];
      webkitRTCPeerConnection.prototype[method] = function() {
        var args = arguments;
        var self = this;
        return new Promise(function(resolve, reject) {
          nativeMethod.apply(self, [args[0],
              function() {
                resolve();
                if (args.length >= 2) {
                  args[1].apply(null, []);
                }
              },
              function(err) {
                reject(err);
                if (args.length >= 3) {
                  args[2].apply(null, [err]);
                }
              }]
            );
        });
      };
    });
  },

  shimGetUserMedia: function() {
    var constraintsToChrome_ = function(c) {
      if (typeof c !== 'object' || c.mandatory || c.optional) {
        return c;
      }
      var cc = {};
      Object.keys(c).forEach(function(key) {
        if (key === 'require' || key === 'advanced' || key === 'mediaSource') {
          return;
        }
        var r = (typeof c[key] === 'object') ? c[key] : {ideal: c[key]};
        if (r.exact !== undefined && typeof r.exact === 'number') {
          r.min = r.max = r.exact;
        }
        var oldname_ = function(prefix, name) {
          if (prefix) {
            return prefix + name.charAt(0).toUpperCase() + name.slice(1);
          }
          return (name === 'deviceId') ? 'sourceId' : name;
        };
        if (r.ideal !== undefined) {
          cc.optional = cc.optional || [];
          var oc = {};
          if (typeof r.ideal === 'number') {
            oc[oldname_('min', key)] = r.ideal;
            cc.optional.push(oc);
            oc = {};
            oc[oldname_('max', key)] = r.ideal;
            cc.optional.push(oc);
          } else {
            oc[oldname_('', key)] = r.ideal;
            cc.optional.push(oc);
          }
        }
        if (r.exact !== undefined && typeof r.exact !== 'number') {
          cc.mandatory = cc.mandatory || {};
          cc.mandatory[oldname_('', key)] = r.exact;
        } else {
          ['min', 'max'].forEach(function(mix) {
            if (r[mix] !== undefined) {
              cc.mandatory = cc.mandatory || {};
              cc.mandatory[oldname_(mix, key)] = r[mix];
            }
          });
        }
      });
      if (c.advanced) {
        cc.optional = (cc.optional || []).concat(c.advanced);
      }
      return cc;
    };

    var getUserMedia_ = function(constraints, onSuccess, onError) {
      if (constraints.audio) {
        constraints.audio = constraintsToChrome_(constraints.audio);
      }
      if (constraints.video) {
        constraints.video = constraintsToChrome_(constraints.video);
      }
      logging('chrome: ' + JSON.stringify(constraints));
      return navigator.webkitGetUserMedia(constraints, onSuccess, onError);
    };
    navigator.getUserMedia = getUserMedia_;

    // Returns the result of getUserMedia as a Promise.
    var getUserMediaPromise_ = function(constraints) {
      return new Promise(function(resolve, reject) {
        navigator.getUserMedia(constraints, resolve, reject);
      });
    }

    if (!navigator.mediaDevices) {
      navigator.mediaDevices = {getUserMedia: getUserMediaPromise_,
                               enumerateDevices: function() {
        return new Promise(function(resolve) {
          var kinds = {audio: 'audioinput', video: 'videoinput'};
          return MediaStreamTrack.getSources(function(devices) {
            resolve(devices.map(function(device) {
              return {label: device.label,
                      kind: kinds[device.kind],
                      deviceId: device.id,
                      groupId: ''};
            }));
          });
        });
      }};
    }

    // A shim for getUserMedia method on the mediaDevices object.
    // TODO(KaptenJansson) remove once implemented in Chrome stable.
    if (!navigator.mediaDevices.getUserMedia) {
      navigator.mediaDevices.getUserMedia = function(constraints) {
        return getUserMediaPromise_(constraints);
      };
    } else {
      // Even though Chrome 45 has navigator.mediaDevices and a getUserMedia
      // function which returns a Promise, it does not accept spec-style
      // constraints.
      var origGetUserMedia = navigator.mediaDevices.getUserMedia.
          bind(navigator.mediaDevices);
      navigator.mediaDevices.getUserMedia = function(c) {
        if (c) {
          logging('spec:   ' + JSON.stringify(c)); // whitespace for alignment
          c.audio = constraintsToChrome_(c.audio);
          c.video = constraintsToChrome_(c.video);
          logging('chrome: ' + JSON.stringify(c));
        }
        return origGetUserMedia(c);
      }.bind(this);
    }

    // Dummy devicechange event methods.
    // TODO(KaptenJansson) remove once implemented in Chrome stable.
    if (typeof navigator.mediaDevices.addEventListener === 'undefined') {
      navigator.mediaDevices.addEventListener = function() {
        logging('Dummy mediaDevices.addEventListener called.');
      };
    }
    if (typeof navigator.mediaDevices.removeEventListener === 'undefined') {
      navigator.mediaDevices.removeEventListener = function() {
        logging('Dummy mediaDevices.removeEventListener called.');
      };
    }
  },

  // Attach a media stream to an element.
  attachMediaStream: function(element, stream) {
    logging('DEPRECATED, attachMediaStream will soon be removed.');
    if (browserDetails.version >= 43) {
      element.srcObject = stream;
    } else if (typeof element.src !== 'undefined') {
      element.src = URL.createObjectURL(stream);
    } else {
      logging('Error attaching stream to element.');
    }
  },

  reattachMediaStream: function(to, from) {
    logging('DEPRECATED, reattachMediaStream will soon be removed.');
    if (browserDetails.version >= 43) {
      to.srcObject = from.srcObject;
    } else {
      to.src = from.src;
    }
  }
}

// Expose public methods.
module.exports = {
  shimOnTrack: chromeShim.shimOnTrack,
  shimSourceObject: chromeShim.shimSourceObject,
  shimPeerConnection: chromeShim.shimPeerConnection,
  shimGetUserMedia: chromeShim.shimGetUserMedia,
  attachMediaStream: chromeShim.attachMediaStream,
  reattachMediaStream: chromeShim.reattachMediaStream
};

},{"../utils.js":5}],4:[function(require,module,exports){
/*
 *  Copyright (c) 2016 The WebRTC project authors. All Rights Reserved.
 *
 *  Use of this source code is governed by a BSD-style license
 *  that can be found in the LICENSE file in the root of the source
 *  tree.
 */
'use strict';

var logging = require('../utils').log;
var browserDetails = require('../utils').browserDetails;

var firefoxShim = {
  shimOnTrack: function() {
    if (typeof window === 'object' && window.RTCPeerConnection && !('ontrack' in
        window.RTCPeerConnection.prototype)) {
      Object.defineProperty(window.RTCPeerConnection.prototype, 'ontrack', {
        get: function() { return this._ontrack; },
        set: function(f) {
          var self = this;
          if (this._ontrack) {
            this.removeEventListener('track', this._ontrack);
            this.removeEventListener('addstream', this._ontrackpoly);
          }
          this.addEventListener('track', this._ontrack = f);
          this.addEventListener('addstream', this._ontrackpoly = function(e) {
            e.stream.getTracks().forEach(function(track) {
              var event = new Event('track');
              event.track = track;
              event.receiver = {track: track};
              event.streams = [e.stream];
              this.dispatchEvent(event);
            }.bind(this));
          }.bind(this));
        }
      });
    }
  },

  shimSourceObject: function() {
    // Firefox has supported mozSrcObject since FF22, unprefixed in 42.
    if (typeof window === 'object') {
      if (window.HTMLMediaElement &&
        !('srcObject' in window.HTMLMediaElement.prototype)) {
        // Shim the srcObject property, once, when HTMLMediaElement is found.
        Object.defineProperty(window.HTMLMediaElement.prototype, 'srcObject', {
          get: function() {
            return this.mozSrcObject;
          },
          set: function(stream) {
            this.mozSrcObject = stream;
          }
        });
      }
    }
  },

  shimPeerConnection: function() {
    // The RTCPeerConnection object.
    if (!window.RTCPeerConnection) {
      window.RTCPeerConnection = function(pcConfig, pcConstraints) {
        if (browserDetails.version < 38) {
          // .urls is not supported in FF < 38.
          // create RTCIceServers with a single url.
          if (pcConfig && pcConfig.iceServers) {
            var newIceServers = [];
            for (var i = 0; i < pcConfig.iceServers.length; i++) {
              var server = pcConfig.iceServers[i];
              if (server.hasOwnProperty('urls')) {
                for (var j = 0; j < server.urls.length; j++) {
                  var newServer = {
                    url: server.urls[j]
                  };
                  if (server.urls[j].indexOf('turn') === 0) {
                    newServer.username = server.username;
                    newServer.credential = server.credential;
                  }
                  newIceServers.push(newServer);
                }
              } else {
                newIceServers.push(pcConfig.iceServers[i]);
              }
            }
            pcConfig.iceServers = newIceServers;
          }
        }
        return new mozRTCPeerConnection(pcConfig, pcConstraints); // jscs:ignore requireCapitalizedConstructors
      };
      window.RTCPeerConnection.prototype = mozRTCPeerConnection.prototype;

      // wrap static methods. Currently just generateCertificate.
      if (mozRTCPeerConnection.generateCertificate) {
        Object.defineProperty(window.RTCPeerConnection, 'generateCertificate', {
          get: function() {
            if (arguments.length) {
              return mozRTCPeerConnection.generateCertificate.apply(null,
                  arguments);
            } else {
              return mozRTCPeerConnection.generateCertificate;
            }
          }
        });
      }

      window.RTCSessionDescription = mozRTCSessionDescription;
      window.RTCIceCandidate = mozRTCIceCandidate;
    }
  },

  shimGetUserMedia: function() {
    // getUserMedia constraints shim.
    var getUserMedia_ = function(constraints, onSuccess, onError) {
      var constraintsToFF37_ = function(c) {
        if (typeof c !== 'object' || c.require) {
          return c;
        }
        var require = [];
        Object.keys(c).forEach(function(key) {
          if (key === 'require' || key === 'advanced' || key === 'mediaSource') {
            return;
          }
          var r = c[key] = (typeof c[key] === 'object') ?
              c[key] : {ideal: c[key]};
          if (r.min !== undefined ||
              r.max !== undefined || r.exact !== undefined) {
            require.push(key);
          }
          if (r.exact !== undefined) {
            if (typeof r.exact === 'number') {
              r. min = r.max = r.exact;
            } else {
              c[key] = r.exact;
            }
            delete r.exact;
          }
          if (r.ideal !== undefined) {
            c.advanced = c.advanced || [];
            var oc = {};
            if (typeof r.ideal === 'number') {
              oc[key] = {min: r.ideal, max: r.ideal};
            } else {
              oc[key] = r.ideal;
            }
            c.advanced.push(oc);
            delete r.ideal;
            if (!Object.keys(r).length) {
              delete c[key];
            }
          }
        });
        if (require.length) {
          c.require = require;
        }
        return c;
      };
      if (browserDetails.version < 38) {
        logging('spec: ' + JSON.stringify(constraints));
        if (constraints.audio) {
          constraints.audio = constraintsToFF37_(constraints.audio);
        }
        if (constraints.video) {
          constraints.video = constraintsToFF37_(constraints.video);
        }
        logging('ff37: ' + JSON.stringify(constraints));
      }
      return navigator.mozGetUserMedia(constraints, onSuccess, onError);
    };

    navigator.getUserMedia = getUserMedia_;

    // Returns the result of getUserMedia as a Promise.
    var getUserMediaPromise_ = function(constraints) {
      return new Promise(function(resolve, reject) {
        navigator.getUserMedia(constraints, resolve, reject);
      });
    }

    // Shim for mediaDevices on older versions.
    if (!navigator.mediaDevices) {
      navigator.mediaDevices = {getUserMedia: getUserMediaPromise_,
        addEventListener: function() { },
        removeEventListener: function() { }
      };
    }
    navigator.mediaDevices.enumerateDevices =
        navigator.mediaDevices.enumerateDevices || function() {
      return new Promise(function(resolve) {
        var infos = [
          {kind: 'audioinput', deviceId: 'default', label: '', groupId: ''},
          {kind: 'videoinput', deviceId: 'default', label: '', groupId: ''}
        ];
        resolve(infos);
      });
    };

    if (browserDetails.version < 41) {
      // Work around http://bugzil.la/1169665
      var orgEnumerateDevices =
          navigator.mediaDevices.enumerateDevices.bind(navigator.mediaDevices);
      navigator.mediaDevices.enumerateDevices = function() {
        return orgEnumerateDevices().then(undefined, function(e) {
          if (e.name === 'NotFoundError') {
            return [];
          }
          throw e;
        });
      };
    }
  },

  // Attach a media stream to an element.
  attachMediaStream: function(element, stream) {
    logging('DEPRECATED, attachMediaStream will soon be removed.');
    element.srcObject = stream;
  },

  reattachMediaStream: function(to, from) {
    logging('DEPRECATED, reattachMediaStream will soon be removed.');
    to.srcObject = from.srcObject;
  }
}

// Expose public methods.
module.exports = {
  shimOnTrack: firefoxShim.shimOnTrack,
  shimSourceObject: firefoxShim.shimSourceObject,
  shimPeerConnection: firefoxShim.shimPeerConnection,
  shimGetUserMedia: firefoxShim.shimGetUserMedia,
  attachMediaStream: firefoxShim.attachMediaStream,
  reattachMediaStream: firefoxShim.reattachMediaStream
}

},{"../utils":5}],5:[function(require,module,exports){
/*
 *  Copyright (c) 2016 The WebRTC project authors. All Rights Reserved.
 *
 *  Use of this source code is governed by a BSD-style license
 *  that can be found in the LICENSE file in the root of the source
 *  tree.
 */
'use strict';

var logDisabled_ = false;

// Utility methods.
var utils = {
  disableLog: function(bool) {
    if (typeof bool !== 'boolean') {
      return new Error('Argument type: ' + typeof bool +
          '. Please use a boolean.');
    }
    logDisabled_ = bool;
    return (bool) ? 'adapter.js logging disabled' :
        'adapter.js logging enabled';
  },

  log: function() {
    if (typeof window === 'object') {
      if (logDisabled_) {
        return;
      }
      console.log.apply(console, arguments);
    }
  },

   /**
   * Extract browser version out of the provided user agent string.
   * @param {!string} uastring userAgent string.
   * @param {!string} expr Regular expression used as match criteria.
   * @param {!number} pos position in the version string to be returned.
   * @return {!number} browser version.
   */
  extractVersion: function(uastring, expr, pos) {
    var match = uastring.match(expr);
    return match && match.length >= pos && parseInt(match[pos], 10);
  },

  /**
   * Browser detector.
   * @return {object} result containing browser, version and minVersion
   *     properties.
   */
  detectBrowser: function() {
    // Returned result object.
    var result = {};
    result.browser = null;
    result.version = null;
    result.minVersion = null;

    // Non supported browser.
    if (typeof window === 'undefined' || !window.navigator) {
      result.browser = 'Not a supported browser.';
      return result;
    }

    // Firefox.
    if (navigator.mozGetUserMedia) {
      result.browser = 'firefox';
      result.version = this.extractVersion(navigator.userAgent,
          /Firefox\/([0-9]+)\./, 1);
      result.minVersion = 31;
      return result;
    }

    // Chrome/Chromium/Webview.
    if (navigator.webkitGetUserMedia && window.webkitRTCPeerConnection) {
      result.browser = 'chrome';
      result.version = this.extractVersion(navigator.userAgent,
          /Chrom(e|ium)\/([0-9]+)\./, 2);
      result.minVersion = 38;
      return result;
    }

    // Edge.
    if (navigator.mediaDevices &&
        navigator.userAgent.match(/Edge\/(\d+).(\d+)$/)) {
      result.browser = 'edge';
      result.version = this.extractVersion(navigator.userAgent,
          /Edge\/(\d+).(\d+)$/, 2);
      result.minVersion = 10547;
      return result;
    }
    
    // Non supported browser default.
    result.browser = 'Not a supported browser.';
    return result;
  }
};

// Export.
module.exports = {
  log: utils.log,
  disableLog: utils.disableLog,
  browserDetails: utils.detectBrowser(),
  extractVersion: utils.extractVersion
};

},{}]},{},[2])(2)
});(function(w) {
function StopStream (streams, stopAudio, stopVideo) {
    for (var i = 0; i < streams.length; i++) {
        if (!streams[i]) {
            continue;
        }
        var audioTracks = streams[i].getAudioTracks();
        var videoTracks = streams[i].getVideoTracks();

        if (stopAudio) {
            for (var j = 0; j < audioTracks.length; j++) {
                audioTracks[j].stop();
            }
        }

        if (stopVideo) {
            for (var j = 0; j < videoTracks.length; j++) {
                videoTracks[j].stop();
            }
        }
    }
};

function GetTimeForLogging() {
    return new Date().toLocaleTimeString();
};



function VidyoInputDevice(type, startCallback, stopCallback) { // type can be "AUDIO" or "VIDEO"
    var id_ = "";
    var pendingId_ = "";
    var constraints_ = null;

    function LogInfo (msg) {
        console.log("" + GetTimeForLogging() + " VidyoDevice[" + type + "]: " + msg);
    };


    function LogErr (msg) {
        console.error("" + GetTimeForLogging() + " VidyoDevice: " + msg);
    };


    const DEVICE_STATE_IDLE = "DEVICE_IDLE";
    const DEVICE_STATE_STARTING = "DEVICE_STARTING";
    const DEVICE_STATE_STARTED = "DEVICE_STARTED";
    const DEVICE_STATE_STOP_PENDING = "DEVICE_STOP_PENDING"; // while starting/start pending, stop comes
    const DEVICE_STATE_START_PENDING = "DEVICE_START_PENDING"; // while in stop pending, start comes


    /*************************

          IDLE ---------------------
         |    \                    | 
         |     \                   | 
         |      STARTING ------STOP_PENDING
         |      /     |             |
         |     /      |             |
         |    /       |             |
        STARTED       |---------START_PENDING

    **************************/

    var stream_ = null;
    var state_ = DEVICE_STATE_IDLE;

    function noop(currentState, nextState, op) {
        LogInfo("NO-OP [" + op + "] Curr:" + currentState + " Next:" + nextState);
    };

    function startDevice(currentState, nextState, op) {
        if (stream_ !== null) {
            StopStream([stream_], type === "AUDIO", type === "VIDEO");
            stream_ = null; 
        }

        if (type === "VIDEO") {
            constraints_.video.deviceId = id_;
        } else {
            constraints_.audio.deviceId = id_;
        }

        navigator.mediaDevices.getUserMedia(constraints_).
        then(function(str) {
            stream_ = str;
            InvokeStateMachine("deviceStarted");
            // startCallback(str);
        }).
        catch(function(err) {
            LogErr("Start device " + id_ + " failed " + err.name + " " + JSON.stringify(err));
            InvokeStateMachine("deviceStarted"); // Will trigger startCallback with null to indicate start failure
            InvokeStateMachine("stop");
        });
    };

    function stopDevice(currentState, nextState, op) {
        id_ = "";
        if (stream_ !== null) {
            StopStream([stream_], type === "AUDIO", type === "VIDEO");
            stream_ = null;
            stopCallback();
        }
    };

    function restartDevice(currentState, nextState, op) {
        LogInfo("restartDevice id=" + id_ + " pending=" + pendingId_);
        if (id_.length > 0 && pendingId_.length > 0 && id_ != pendingId_) {
            id_ = pendingId_;
            pendingId_ = "";
            startDevice();
        } else {
            InvokeStateMachine("deviceStarted");
        }
    };

    function deviceStarted(currentState, nextState, op) {
        startCallback(stream_);
    };

    const stateMachine_ = {
        "DEVICE_IDLE" : {
            start: {
                nextState: DEVICE_STATE_STARTING,
                operation: startDevice
            },
            stop: {
                nextState: DEVICE_STATE_IDLE,
                operation: noop
            },
            deviceStarted: {
                nextState: DEVICE_STATE_IDLE,
                operation: noop
            }
        },

        "DEVICE_STARTING" : {
            start: {
                nextState: DEVICE_STATE_STARTING,
                operation: noop
            },
            stop: {
                nextState: DEVICE_STATE_STOP_PENDING,
                operation: noop
            },
            deviceStarted: {
                nextState: DEVICE_STATE_STARTED,
                operation: deviceStarted
            }
        },

        "DEVICE_STARTED" : {
            start: {
                nextState: DEVICE_STATE_STARTED,
                operation: noop
            },
            stop: {
                nextState: DEVICE_STATE_IDLE,
                operation: stopDevice
            },
            deviceStarted: {
                nextState: DEVICE_STATE_STARTED,
                operation: noop
            }
        },

        "DEVICE_STOP_PENDING" : {
            start: {
                nextState: DEVICE_STATE_START_PENDING,
                operation: noop
            },
            stop: {
                nextState: DEVICE_STATE_STOP_PENDING,
                operation: noop
            },
            deviceStarted: {
                nextState: DEVICE_STATE_IDLE,
                operation: stopDevice
            },
        },

        "DEVICE_START_PENDING" : {
            start: {
                nextState: DEVICE_STATE_START_PENDING,
                operation: noop
            },
            stop: {
                nextState: DEVICE_STATE_STOP_PENDING,
                operation: noop
            },
            deviceStarted: {
                nextState: DEVICE_STATE_STARTING,
                operation: restartDevice
            }
        },
    };

    function InvokeStateMachine(op) {
        var prevState = state_;
        var fn = stateMachine_[state_][op].operation;
        state_ = stateMachine_[state_][op].nextState;
        LogInfo("SM: Curr=" + prevState + " Next=" + state_ + " Op=" + op);
        fn(prevState, state_, op);
    };


    this.StartDevice = function(id, constraints) {
        if (id_.length <= 0) {
            id_ = id;
        } else {
            pendingId_ = id;
        }
        constraints_ = constraints;
        LogInfo("StartDevice id=" + id + "id_=" + id_ + " constraints=" + JSON.stringify(constraints));
        InvokeStateMachine("start");
    };

    this.StopDevice = function(id) {
        LogInfo("StopDevice id=" + id);
        InvokeStateMachine("stop");
    };

    this.SetDevice = function(id, constraints) {
        id_ = id;
        constraints_ = constraints;
        LogInfo("SetDevice id=" + id + " constraints=" + JSON.stringify(constraints));
    };

    this.StartPendingDevice = function() {
        LogInfo("StartPendingDevice id=*" + id_ + "*");
        if (id_ && id_.length > 0) {
            InvokeStateMachine("start");
        }
    };

    this.DeviceRemoved = function(id) {
        LogInfo("DeviceRemoved id=*" + id + "* *" + id_ + "*");
        if (id_ === id) { 
            InvokeStateMachine("stop");
        }
    };

    this.GetState = function() {
        return {
            id: id_,
            state: state_
        };
    };

    this.SetStream = function(s) {
        if (state_ !== DEVICE_STATE_IDLE) {
            LogErr("SetStream in invalid state " + state_);
            return;
        }
        stream_ = s;
        state_ = DEVICE_STATE_STARTED;
    };

    this.DiffState = function(oldState) {
        if (oldState.state !== DEVICE_STATE_STARTED && 
            state_ === DEVICE_STATE_STARTED) {
            return "started";
        }

        if (oldState.state === DEVICE_STATE_STARTED && 
            (state_ === DEVICE_STATE_IDLE || 
             state_ === DEVICE_STATE_STOP_PENDING)
            ) {
            return "stopped";
        }

        return "nochange";
    };

    this.GetStreamAndTrack = function () {
        if (stream_ === null) {
            return {
                stream: null,
                track: null
            };
        }
        
        var track;

        if (type === "VIDEO") {
            track = stream_.getVideoTracks()[0];
        } else {
            track = stream_.getAudioTracks()[0];
        } 
        return {
            stream: stream_,
            track: track
        };
    };

    this.IsStarting = function() {
        return state_ === DEVICE_STATE_STARTING || state_ === DEVICE_STATE_START_PENDING;
    };

};

function VidyoClientWebRTC(t) {

    var transport_ = t;

    var layoutEngine_ = {};

    var renderEventCallback_ = null;
    const PREVIEW_SOURCE_ID = "preview-source-id";

    var devices_ = null;
    var offer_ = null;
    var streamMapping_ = {};
    var cameraViewId_ = "";
    var micStream_ = null;
    var videoStreams_ = [null];
    var maxResolution_ = "360p";
    var maxSubscriptions_ = 8;
    var startCallData_ = null;

    var localShareId_ = 1;
    var pendingRequestId_ = -1;
    var shareSelectedCallback_ = null;

    var localSharePeerConnection_ = null;
    var localShareStream_ = [];
    var localShareElement_ = null;
    var localShareOffer_ = null;
    var iceCandidateTimeout_ = null;
    var previousWindowSizes_ = { windows: []};

    const CALLSTATE_IDLE = "IDLE";
    const CALLSTATE_WAITING_FOR_DEVICES = "WAITING_FOR_DEVICES";
    const CALLSTATE_GETTING_OFFER = "GETTING_OFFER";
    const CALLSTATE_WAITING_FOR_ANSWER = "WAITING_FOR_ANSWER";
    const CALLSTATE_CONNECTING = "CONNECTING";
    const CALLSTATE_CONNECTED = "CONNECTED";
    const CALLSTATE_DISCONNECTING = "DISCONNECTING";
    const CALLSTATE_RENEGOTIATE_PENDING = "RENEGOTIATE_PENDING";

    var callState_ = CALLSTATE_IDLE;
    const stateMachine_ = {
        "IDLE": {
            startCall: {
                nextState: CALLSTATE_WAITING_FOR_DEVICES,
                operation: CheckForDevices,
            },
            gotOffer: {
                nextState: CALLSTATE_IDLE,
                operation: noop
            },
            gotAnswer: {
                nextState: CALLSTATE_IDLE,
                operation: noop
            },
            signalingStable: {
                nextState: CALLSTATE_IDLE,
                operation: noop
            },
            stopCall : {
                nextState: CALLSTATE_IDLE,
                operation: noop
            },
            deviceStateChanged: {
                nextState: CALLSTATE_IDLE,
                operation: noop
            },
        },

        "WAITING_FOR_DEVICES": {
            startCall: {
                nextState: CALLSTATE_GETTING_OFFER,
                operation: HandleStartCall
            },
            gotOffer: {
                nextState: CALLSTATE_WAITING_FOR_DEVICES,
                operation: noop
            },
            gotAnswer: {
                nextState: CALLSTATE_WAITING_FOR_DEVICES,
                operation: noop
            },
            signalingStable: {
                nextState: CALLSTATE_WAITING_FOR_DEVICES,
                operation: noop
            },
            stopCall : {
                nextState: CALLSTATE_DISCONNECTING,
                operation: noop
            },
            deviceStateChanged: {
                nextState: CALLSTATE_WAITING_FOR_DEVICES,
                operation: CheckForDevices
            },
        },

        "GETTING_OFFER" : {
            startCall: {
                nextState: CALLSTATE_GETTING_OFFER,
                operation: noop
            },
            gotOffer: {
                nextState: CALLSTATE_WAITING_FOR_ANSWER,
                operation: SendLocalOffer
            },
            gotAnswer: {
                nextState: CALLSTATE_IDLE,
                operation: noop
            },
            signalingStable: {
                nextState: CALLSTATE_GETTING_OFFER,
                operation: noop
            },
            stopCall : {
                nextState: CALLSTATE_IDLE,
                operation: HandleStopCall
            },
            deviceStateChanged: {
                nextState: CALLSTATE_RENEGOTIATE_PENDING,
                operation: noop
            },
        },
    
        "WAITING_FOR_ANSWER" : {
            startCall: {
                nextState: CALLSTATE_WAITING_FOR_ANSWER,
                operation: noop
            },
            gotOffer: {
                nextState: CALLSTATE_WAITING_FOR_ANSWER,
                operation: noop
            },
            gotAnswer: {
                nextState: CALLSTATE_CONNECTING,
                operation: HandleAnswerSdp
            },
            signalingStable: {
                nextState: CALLSTATE_WAITING_FOR_ANSWER,
                operation: noop
            },
            stopCall : {
                nextState: CALLSTATE_IDLE,
                operation: HandleStopCall
            },
            deviceStateChanged: {
                nextState: CALLSTATE_RENEGOTIATE_PENDING,
                operation: noop
            },
        },

        "CONNECTING" : {
            startCall: {
                nextState: CALLSTATE_CONNECTING,
                operation: noop
            },
            gotOffer: {
                nextState: CALLSTATE_CONNECTING,
                operation: noop
            },
            gotAnswer: {
                nextState: CALLSTATE_CONNECTING,
                operation: noop
            },
            signalingStable: {
                nextState: CALLSTATE_CONNECTED,
                operation: noop
            },
            stopCall : {
                nextState: CALLSTATE_IDLE,
                operation: HandleStopCall
            },
            deviceStateChanged: {
                nextState: CALLSTATE_RENEGOTIATE_PENDING,
                operation: noop
            },
        },


        "CONNECTED" : {
            startCall: {
                nextState: CALLSTATE_CONNECTED,
                operation: noop
            },
            gotOffer: {
                nextState: CALLSTATE_CONNECTED,
                operation: noop
            },
            gotAnswer: {
                nextState: CALLSTATE_CONNECTED,
                operation: noop
            },
            signalingStable: {
                nextState: CALLSTATE_CONNECTED,
                operation: noop
            },
            stopCall : {
                nextState: CALLSTATE_IDLE,
                operation: HandleStopCall
            },
            deviceStateChanged: {
                nextState: CALLSTATE_GETTING_OFFER,
                operation: AddRemoveStreams
            },
        },

        "DISCONNECTING": {
            startCall: {
                nextState: CALLSTATE_IDLE,
                operation: HandleStopCall
            },
            gotOffer: {
                nextState: CALLSTATE_IDLE,
                operation: HandleStopCall
            },
            gotAnswer: {
                nextState: CALLSTATE_IDLE,
                operation: HandleStopCall
            },
            signalingStable: {
                nextState: CALLSTATE_IDLE,
                operation: HandleStopCall
            },
            stopCall : {
                nextState: CALLSTATE_IDLE,
                operation: HandleStopCall
            },
            deviceStateChanged: {
                nextState: CALLSTATE_IDLE,
                operation: HandleStopCall
            },
        },

        "RENEGOTIATE_PENDING": {
            startCall: {
                nextState: CALLSTATE_RENEGOTIATE_PENDING,
                operation: noop
            },
            gotOffer: {
                nextState: CALLSTATE_RENEGOTIATE_PENDING,
                operation: SendLocalOffer
            },
            gotAnswer: {
                nextState: CALLSTATE_RENEGOTIATE_PENDING,
                operation: HandleAnswerSdp,
            },
            signalingStable: {
                nextState: CALLSTATE_GETTING_OFFER,
                operation: AddRemoveStreams,
            },
            stopCall : {
                nextState: CALLSTATE_IDLE,
                operation: HandleStopCall
            },
            deviceStateChanged: {
                nextState: CALLSTATE_RENEGOTIATE_PENDING,
                operation: noop
            },
        }
    };

    function noop(currentState, nextState, op) {
        LogInfo("NO-OP [" + op + "] Curr:" + currentState + " Next:" + nextState);
    };

    function InvokeStateMachine(op, data) {
        var prevState = callState_;
        var fn = stateMachine_[prevState][op].operation;
        callState_ = stateMachine_[prevState][op].nextState;
        LogInfo("SM: Curr=" + prevState + " Next=" + callState_ + " Op=" + op);
        fn(prevState, callState_, op, data);
    };


    const resolutionMap_ = {
        "180p" : { w: 320,  h: 180,   br: "256"},
        "240p" : { w: 426,  h: 240,   br: "384"},
        "270p" : { w: 480,  h: 270,   br: "448"},
        "360p" : { w: 640,  h: 360,   br: "512"},
        "480p" : { w: 854,  h: 480,   br: "768"},
        "540p" : { w: 960,  h: 540,   br: "1024"},
        "720p" : { w: 1280, h: 720,   br: "1536"},
        "1080p": { w: 1920, h: 1080,  br: "2048"},
    };


    var peerConnectionConstraints_ = {
        iceServers: []
    };

    function CameraStarted(stream) {
        LogInfo("CameraStarted stream=" + (stream ? stream.id : null));
        if (window.adapter.browserDetails.browser === "chrome") {
        } else {
            mic_.StartPendingDevice();
        }
        videoStreams_[0] = stream;
        CreateSourceIdEntryInStreamMappingAndAttachVideo({sourceId: PREVIEW_SOURCE_ID, streamId: 0, attached: false, type: "preview", name: "Preview"});
        if (stream !== null) {
            InvokeStateMachine("deviceStateChanged");
        }
    };

    function CameraStopped() {
        LogInfo("CameraStopped");
        InvokeStateMachine("deviceStateChanged");
        layoutEngine_[cameraViewId_].hide("preview", -1);
        cameraViewId_ = "";
    }

    function MicStarted(stream) {
        LogInfo("MicrophoneStarted stream=" + (stream ? stream.id : null));
        if (stream !== null) {
            InvokeStateMachine("deviceStateChanged");
        }
    };

    function MicStopped() {
        LogInfo("MicrophoneStopped");
        InvokeStateMachine("deviceStateChanged");
    };

    var peerConnection_ = null;
    var camera_ = new VidyoInputDevice("VIDEO", CameraStarted, CameraStopped);
    var mic_ = new VidyoInputDevice("AUDIO", MicStarted, MicStopped);

    var cameraState_ = null;
    var micState_ = null;

    const MAX_REMOTE_AUDIO_STREAMS = 4;
    var remoteAudio_ = []; 
    var currentAudioIndex_ = 0;
    for (var r = 0; r < MAX_REMOTE_AUDIO_STREAMS; r++) {
        remoteAudio_[r] = document.createElement("audio");
        remoteAudio_[r].autoplay = true;
    };


    function LogInfo (msg) {
        console.log("" + GetTimeForLogging() + " VidyoWebRTC: " + msg);
    };


    function LogErr (msg) {
        console.error("" + GetTimeForLogging() + " VidyoWebRTC: " + msg);
    };

    function AttachVideo(sourceId) {
        if (streamMapping_.hasOwnProperty(sourceId) && 
            streamMapping_[sourceId].hasOwnProperty("elemId") &&
            streamMapping_[sourceId].hasOwnProperty("streamId") &&
            !streamMapping_[sourceId].attached) { 

            var elemId = streamMapping_[sourceId]["elemId"];

            if (!layoutEngine_.hasOwnProperty(elemId)) {
                LogErr("Invalid view id - no layout engine found for " + elemId + " contains: " + JSON.stringify(Object.keys(layoutEngine_), null, 2));
                return;
            }


            var streamId = streamMapping_[sourceId]["streamId"];
            var videoElement = layoutEngine_[elemId].getVideoElement(streamMapping_[sourceId].type,  streamId);

            if (videoElement && videoStreams_[streamId]) {
                streamMapping_[sourceId].attached = true;
                var videoStream = videoStreams_[streamId];
                videoElement.srcObject = videoStream;
                videoElement.dataset.streamId = videoStream.id;
                LogInfo("AttachVideo: elem=" + elemId + " source=" + sourceId + " streamId=" + streamId);
                layoutEngine_[elemId].show(streamMapping_[sourceId].type,  streamId, streamMapping_[sourceId].name);
            }
        }
    };


    function CreateSourceIdEntryInStreamMappingAndAttachVideo(stream) {
        var sourceId = stream.sourceId;
        if (!streamMapping_.hasOwnProperty(sourceId)) {
            streamMapping_[sourceId] = {
                attached: false
            }
        }

        for (var k in stream) {
            streamMapping_[sourceId][k] = stream[k];
        }

        AttachVideo(sourceId);
    };

    function GetDevicesPostGetUserMedia(cb) {
        navigator.mediaDevices.getUserMedia({audio: true, video: true}).
        then(function(stream) {
            GetDevices(false, function(devices) {
                StopStream([stream], true, true);
                cb(true, devices);
            });
        }).
        catch(function(err) {
            LogErr("getUserMediaFailed " + err.name + " - " + JSON.stringify(err));
            console.log(err);
            cb(false, []);
        });
    };

    function GetDevices (doGetUserMedia, cb) {
        navigator.mediaDevices.enumerateDevices().
        then(function(devs) {
            var devices = [];
            var labels = 0;
            for (var k = 0; k <devs.length; k++) {
                var d = devs[k];
                devices.push({
                    deviceId: d.deviceId,
                    groupId: d.groupId,
                    kind: d.kind,
                    label: d.label
                });

                if (d.label.length > 0) {
                    labels++; 
                }
            }

            // NEPWEB-484 There is a bug in firefox when device enumeration is called with an active stream and a new mic is plugged in
            // There are devices that come with an empty label
            if (labels) {
                if (devices.length !== labels) { 
                    // LogInfo("Empty labels in device enumeration, filtering " + (devices.length - labels) + " devices");
                    var devicesWithLabels = devices.filter(function(d) { return d.label.length > 0; });
                    cb(devicesWithLabels);
                    SaveDevicesToLocalStorage(devicesWithLabels);
                } else {
                    cb(devices);
                    SaveDevicesToLocalStorage(devices);
                }
            } else {
                if (UpdateDeviceLabels(devices)) {  // If local storage has all the necessary devices
                    cb(devices);
                } else if (doGetUserMedia) {
                    GetDevicesPostGetUserMedia(function(status, devices2) {
                        if (status) {
                            cb(devices2);
                        } else {
                            cb(devices);
                        }
                    }); 
                } else {
                    cb(devices);
                }
            }
        }).
        catch(function(err) {
            LogErr("enumerateDevices failed: " + JSON.stringify(err));
            console.log(err);
            cb([]);
        });
    };

    function DiffDevices(oldDevices, newDevices) {
        var getDeviceIds = function(d) {
            return d.deviceId;
        };

        var oldDeviceIds = oldDevices.map(getDeviceIds);
        var newDeviceIds = newDevices.map(getDeviceIds);

        var addedDevices = newDevices.filter(function(d) {
            return oldDeviceIds.indexOf(d.deviceId) === -1;
        });

        var removedDevices = oldDevices.filter(function(d) {
            return newDeviceIds.indexOf(d.deviceId) === -1;
        });

        return {
            added: addedDevices,
            removed: removedDevices
        };

    };

    function SaveDevicesToLocalStorage(devices) {
        if (window.adapter.browserDetails.browser === "chrome") {
            return;
        } 

        var devs = [];
        if (localStorage.hasOwnProperty("devices")) {
            devs = JSON.parse(localStorage.devices);
        }

        var newDevices = DiffDevices(devs, devices).added;

        if (newDevices.length > 0) {
            for (var n = 0; n < newDevices.length; n++) {
                LogInfo("Pushing new device to storage " + JSON.stringify(newDevices[n], 2, null));
                devs.push({
                    deviceId: newDevices[n].deviceId,
                    label: newDevices[n].label,
                    kind: newDevices[n].kind
                });
            }

            window.localStorage.devices = JSON.stringify(devs);
            LogInfo("Stored devices: " + JSON.stringify(devs));
        }
    };

    // Updates the labels from the devices in localStorage
    // Returns false if the device was not found in localStorage
    function UpdateDeviceLabels(devices) {
        if (window.adapter.browserDetails.browser === "chrome") {
            return false;
        } 

        if (!localStorage.hasOwnProperty("devices")) {
            return false;
        }

        var oldDevices = JSON.parse(localStorage.devices);

        var GetDeviceLabel = function(dev) {
            for (var o = 0; o < oldDevices.length; o++) {
                if (oldDevices[o].deviceId === dev.deviceId) {
                    return oldDevices[o].label;
                }
            }
            return "";
        };

        for (var i = 0; i < devices.length; i++) {
            var label = GetDeviceLabel(devices[i]);
            if (label.length <= 0) {
                LogInfo("NO LABEL FOR " + devices[i].deviceId);
                return false;
            } 
            devices[i].label = label;
        }

        return true;
    };

    function SendDevicesUpdated(added, removed) {
        var deviceUpdate = {
            method: "VidyoWebRTCDevicesUpdated",
            added: {
                microphones: [],
                cameras: [],
                speakers: []
            },
            removed: {
                microphones: [],
                cameras: [],
                speakers: []
            }
        };

        ConvertToDeviceInfo(added, deviceUpdate.added.microphones, deviceUpdate.added.cameras, deviceUpdate.added.speakers);
        ConvertToDeviceInfo(removed, deviceUpdate.removed.microphones, deviceUpdate.removed.cameras, deviceUpdate.removed.speakers);
        
        if (deviceUpdate.removed.microphones.length > 0) {
            for (var i = 0; i < deviceUpdate.removed.microphones.length; i++) {
                mic_.DeviceRemoved(deviceUpdate.removed.microphones[i].id);
            }
        }

        if (deviceUpdate.removed.cameras.length > 0) {
            for (var j = 0; j < deviceUpdate.removed.cameras.length; j++) {
                camera_.DeviceRemoved(deviceUpdate.removed.cameras[j]);
            }
        }
        
        transport_.SendWebRTCMessage(deviceUpdate, function() {
            LogInfo("DeviceUpdate sent: " + JSON.stringify(deviceUpdate));
            PollForDevices();
        });
    };

    function PollForDevices() {
        if (!devices_) {
            return;
        }
        setTimeout(function() {
            GetDevices(true, function(devices) {
                var diff = DiffDevices(devices_, devices);
                if (diff.added.length > 0 || diff.removed.length > 0) {
                    devices_ = devices;
                    SendDevicesUpdated(diff.added, diff.removed);
                } else {
                    PollForDevices();
                }
            });
        }, 5 * 1000);
    };

    function ConvertToDeviceInfo(devices, microphones, cameras, speakers) {
        var micLabels = [];
        var camLabels = [];
        var speakerLabels = [];

        for (var i = 0; i < devices.length; i++) {
            var device = {
                id: devices[i].deviceId,
                name: devices[i].label.replace(/\([a-zA-Z0-9]+:[a-zA-Z0-9]+\)/, "") // In windows label comes as Camera(1dead:2code), this is to remove the dead code
            };
            switch(devices[i].kind) {
                case "audioinput":
                    if (micLabels.indexOf(device.name) === -1) {
                        microphones.push(device);
                        micLabels.push(device.name);
                    }
                    break;

                case "videoinput":
                    if (camLabels.indexOf(device.name) === -1) {
                        cameras.push(device);
                        camLabels.push(device.name);
                    }
                    break;

                case "audiooutput":
                    if (speakerLabels.indexOf(device.name) === -1) {
                        speakers.push(device);
                        speakerLabels.push(device.name);
                    }
                    break;
            }
        }
    };

    function SendDeviceEnumerationResponse(devices) {
        var deviceInfo = {
            method: "VidyoWebRTCEnumerateDeviceResponse",
            status: "success",
            microphones: [],
            cameras: [],
            speakers: []
        };

        if (devices.length <= 0) {
            deviceInfo.status = "error";
        } else {
            ConvertToDeviceInfo(devices, deviceInfo.microphones, deviceInfo.cameras, deviceInfo.speakers);
        }

        /**
        var defaultSpeakerIndex = -1;
        for (var i = 0; i < deviceInfo.speakers.length; i++) {
            if (deviceInfo.speakers[i].id === "default") {
                defaultSpeakerIndex = i;
                break;
            }
        }

        if (defaultSpeakerIndex !== -1) {
            deviceInfo.speakers.splice(defaultSpeakerIndex, 1);
        }
        **/

        transport_.SendWebRTCMessage(deviceInfo, function() {
            LogInfo("DeviceInfo sent: " + JSON.stringify(deviceInfo));
            HandleShareSupportedRequest();
        });

        devices_ = devices;
        PollForDevices();

    };


    function HandleDeviceEnumerationRequest (data) {

        if (window.adapter.browserDetails.browser === "chrome") {
        } else {
            // Firefox doesn't enumerate audio output devices, add one default
            var defaultSpeaker = {
                deviceId: "default",
                label: "Default",
                kind: "audiooutput"
            };

            SendDevicesUpdated([defaultSpeaker], []);
        }

        if (window.adapter.browserDetails.browser === "chrome") {
        } else {
            /**
            // For Firefox guest user, store the media stream from device enumeration and use it for startcamera/startmicrophone
            var guest = (window.location.search.indexOf("portal") !== -1 && window.location.search.indexOf("roomKey") !== -1);
            if (guest) {
            **/
                var constraints = GetCameraConstraints(data);
                constraints.audio = true;
                navigator.mediaDevices.getUserMedia(constraints).then(function(s) {
                    if (s.getAudioTracks().length > 0) {
                        mic_.SetStream(s);
                    }

                    if (s.getVideoTracks().length > 0) {
                        var camStream = s;
                        camera_.SetStream(camStream);
                        CameraStarted(camStream);
                    }

                    GetDevices(false, function(devices) {
                        SendDeviceEnumerationResponse(devices);
                    });

                
                }).catch(function(e) {
                    LogErr("getUserMedia error in DeviceEnumeration: " + JSON.stringify(err));
                    GetDevices(false, function(devices) {
                        SendDeviceEnumerationResponse(devices);
                    });
                });
                return;
            /**
            }
            **/
        }

        GetDevices(true, function(devices) {
            SendDeviceEnumerationResponse(devices);
        });
    };

    function SendShareAdded(shareId) {
        var shareAddedMsg = {
            method: "VidyoWebRTCLocalShareAdded",
            shareId: ""+shareId
        };

        transport_.SendWebRTCMessage(shareAddedMsg, function() {
            LogInfo("ShareAdded sent successfully");
        });
    };

    function SendShareRemoved(shareId, cb) {
        var shareRemovedMsg = {
            method: "VidyoWebRTCLocalShareRemoved",
            shareId: ""+shareId
        };

        transport_.SendWebRTCMessage(shareRemovedMsg, function() {
            LogInfo("ShareRemoved sent successfully");
            cb();
        });
    };

    function periodicExtensionCheck() {
        setTimeout(function() {
            if (document.getElementById("vidyowebrtcscreenshare_is_installed")) {
                HandleShareSupportedRequest();
            } else {
                periodicExtensionCheck();
            }
        }, 3000);
    };


    function HandleShareSupportedRequest() {
        var shareSupport = document.getElementById("vidyowebrtcscreenshare_is_installed");
        if (!shareSupport) {
            periodicExtensionCheck();
            return;
        }

        if (window.adapter.browserDetails.browser === "chrome") {
            SendShareAdded(localShareId_);
        } else {
            window.postMessage({type: "VidyoAddDomain", domain: window.location.hostname}, "*");
            SendShareAdded(localShareId_);
        }
    };

    function SendCandidate (streamId, candidate) {
        var candidateMsg = {
            method: "VidyoWebRTCIceCandidate",
            streamId: streamId,
            candidate: candidate
        };

        transport_.SendWebRTCMessage(candidateMsg, function() {
            LogInfo("Candidate send success - " + JSON.stringify(candidate));
        });
    };

    function SendLocalOffer(currentState, nextState, op) {
        var offer = offer_;
        var offerMsg = {
            method: "VidyoWebRTCOfferSdp",
            sdp: offer.sdp
        };

        transport_.SendWebRTCMessage(offerMsg, function() {
            LogInfo("PeerConnection Offer sent = " + offer.sdp);
            if (offer_ !== null) { 
                offer_ = null;
                peerConnection_.setLocalDescription(offer).
                then(function() {
                    LogInfo("PeerConnection setLocalDescription success");
                }).
                catch(function(err) {
                    LogErr("PeerConnection setLocalDescription failed " + JSON.stringify(err));
                    console.log(err);
                });
            }
        });
    };

    function GetLocalOffer() {

        LogInfo("PeerConnection onnegotiationneeded callstate=" + callState_);

        var offerConstraints = {
            offerToReceiveAudio: remoteAudio_.length,
            offerToReceiveVideo: maxSubscriptions_ + 1
        };

        if (window.adapter.browserDetails.browser === "chrome") {
            offerConstraints.offerToReceiveVideo = true; // Chrome doesn't accept numbers for these constraints
            offerConstraints.offerToReceiveAudio = true; // Chrome doesn't accept numbers for these constraints
        }

        cameraState_ = camera_.GetState();
        micState_ = mic_.GetState();

        peerConnection_.createOffer(offerConstraints).
        then(function(offer) {
            offer_ = offer;
            InvokeStateMachine("gotOffer");
        }).
        catch(function(err) {
            LogErr("PeerConnection CreateOffer failed " + JSON.stringify(err));
            console.log(err);
        });
    };

    function CheckForDevices(currentState, nextState, op, data) {
        // Don't wait for devices to start on firefox. 
        // Let them start later and trigger renegotiation
        if (window.adapter.browserDetails.browser === "chrome") {
            if (camera_.IsStarting()) {
                LogInfo("Waiting for camera");
                return;
            }

            if (mic_.IsStarting()) {
                LogInfo("Waiting for mic");
                return;
            }
        } 

        InvokeStateMachine("startCall");
    };

    function HandleStartCall (currentState, nextState, op) {

        var data = startCallData_;
        startCallData_ = null;
        maxSubscriptions_ = data.maxSubscriptions;

        // Get the peer connection constraints
        peerConnectionConstraints_.iceServers.length = 0;
        peerConnectionConstraints_.iceServers.push({urls : "stun:" + data.stunServer});

        if (data.turnCreds) {
           var addr = window.location.hostname;
           var urls = data.turnCreds.urls;
           for (var k = 0; k < urls.length; k++) {
                if (urls[k].indexOf("self_address") !== -1) {
                    urls[k] = urls[k].replace("self_address", addr);
                }
           }
           peerConnectionConstraints_.iceServers.push(data.turnCreds);
        }

        // Create the peer connection
        peerConnection_ = new RTCPeerConnection(peerConnectionConstraints_);

        peerConnection_.onicecandidate = function(evt) {
            if (evt.candidate) {
                if (iceCandidateTimeout_ !== null) {
                    LogInfo("PeerConnection onicecandidate clearing candidate timeout");
                    clearTimeout(iceCandidateTimeout_);
                    iceCandidateTimeout_ = null;
                }
                SendCandidate(1, evt.candidate);
            } else {
                LogInfo("PeerConnection onicecandidate done");
            }
        };
        
        peerConnection_.oniceconnectionstatechange = function(state) {
            LogInfo("PeerConnection oniceconnectionstatechange - " + state.target.iceConnectionState);
            if (state.target.iceConnectionState === "closed" || state.target.iceConnectionState === "failed") {
                transport_.SendWebRTCMessage({method: "VidyoWebRTCIceFailed"}, function() {
                });
            }
        };

        peerConnection_.onsignalingstatechange = function(state) {
            var sigState = (state.target ? state.target.signalingState : state);
            LogInfo("PeerConnection onsignalingstatechange - " + sigState);
            if (sigState === "stable") {
                InvokeStateMachine("signalingStable");
            }
            
        };

        peerConnection_.ontrack = function(evt) {
            LogInfo("PeerConnection ontrack ");
            if (evt.track && evt.track.kind === "audio") { 
                if (evt.streams && evt.streams.length > 0) {
                    if (currentAudioIndex_ < remoteAudio_.length) {
                        LogInfo("PeerConnection onaudiotrack [" + currentAudioIndex_ + "] - audio src: " + evt.streams[0].id);
                        remoteAudio_[currentAudioIndex_].srcObject = evt.streams[0];
                        currentAudioIndex_++;
                    } else {
                        LogErr("PeerConnection onaudiotrack more than " + remoteAudio_.length + " received");
                    }
                } else {
                    LogErr("PeerConnection ontrack - audio No streams present !!");
                }
            } else if (evt.track && evt.track.kind === "video") {
                videoStreams_.push(evt.streams[0]);

                // Check if we are waiting for video, this happens when someone is already in the call, the element and sources are added, but the stream comes later
                for (var sourceId in streamMapping_) {
                    if (streamMapping_[sourceId].hasOwnProperty("streamId")) {
                        var streamId = streamMapping_[sourceId]["streamId"];
                        if (videoStreams_[streamId]) {
                            CreateSourceIdEntryInStreamMappingAndAttachVideo({sourceId: sourceId});
                        }
                    }
                }
            }
        };


        // We will trigger manually since multiple stream operations may be required before sending the offer
        // peerConnection_.onnegotiationneeded = GetLocalOffer;

        var cameraStream = camera_.GetStreamAndTrack().stream;
        var micStream = mic_.GetStreamAndTrack().stream;

        if (cameraStream) {
            AddVideoStream(cameraStream);
        }

        if (micStream) {
            AddAudioStream(micStream);
        }

        if (iceCandidateTimeout_ !== null) {
            clearTimeout(iceCandidateTimeout_);
            iceCandidateTimeout_ = null;
        }

        iceCandidateTimeout_ = setTimeout(function() {
            LogErr("No ICE candidates generated, disconnecting the call");
            InvokeStateMachine("stopCall");
        }, 30 * 1000);
        GetLocalOffer();

    };

    function HandleStopCall(currentState, nextState, op, data) {

        previousWindowSizes_ = { windows: []};
        offer_ = null;

        /**
        camera_.StopDevice();
        mic_.StopDevice();
        **/

        if (iceCandidateTimeout_ !== null) {
            clearTimeout(iceCandidateTimeout_);
            iceCandidateTimeout_ = null;
        }


        HandleStopLocalShare();
        StopStream(localShareStream_, true, true);

        /**
        StopStream([micStream_], true, true);
        micStream_ = null;
        StopStream(videoStreams_, true, true);
        **/

        if (peerConnection_ !== null) {
            // Firefox throws an exception when trying to close peer connection in offline mode
            try {
                peerConnection_.oniceconnectionstatechange = undefined;
                peerConnection_.close();
            } catch(e) {
            }
            peerConnection_ = null;
        }

        currentAudioIndex_ = 0;

        streamMapping_ = {};
        videoStreams_.length = 0;
        var cameraStream = camera_.GetStreamAndTrack().stream;
        videoStreams_.push(cameraStream);
    };

    function HandleAnswerSdp(currentState, nextState, op, data) {
        SetAnswerSdp(data, function(){});
    };

    function SetAnswerSdp(data, callback) {
        if (peerConnection_ === null) {
            LogInfo("peerConnection SetAnswerSdp pc null, call stopped");
            callback(false);
            return;
        }

        LogInfo("SetAnswerSdp: " + data.sdp);

        var br = resolutionMap_.hasOwnProperty(maxResolution_) ? resolutionMap_[maxResolution_].br: "768";

        data.sdp = data.sdp.replace(/a=mid:video\r\n/g, "a=mid:video\r\nb=AS:" + br + "\r\n");

        var SetRemoteDescription = function () {
            if (peerConnection_ === null) {
                LogInfo("peerConnection HandleAnswerSdp pc null, call stopped");
                callback(false);
                return;
            }

            var remoteSdp = new RTCSessionDescription({type: "answer", sdp: data.sdp});
            peerConnection_.setRemoteDescription(remoteSdp).
            then(function() {
                LogInfo("PeerConnection setRemoteDescription success");
                callback(true);
            }).
            catch(function(err) {
                LogErr("PeerConnection setRemoteDescription failed " + JSON.stringify(err));
                console.log(err);
                callback(false);
            });
        };

        if (offer_ !== null) {
            LogInfo("PeerConnection HandleAnswerSdp localOffer not yet set, setting  local offer first");
            var o = offer_;
            offer_ = null;
            peerConnection_.setLocalDescription(o).
            then(function() {
                LogInfo("PeerConnection setLocalDescription success");
                SetRemoteDescription();
            }).
            catch(function(err) {
                LogErr("PeerConnection setLocalDescription failed " + JSON.stringify(err));
                console.log(err);
            });
        } else {
            SetRemoteDescription();
        }

    };

    function HandleIceCandidate(data) {
        var iceCandidate = new RTCIceCandidate(data.candidate);
        if (data.streamId === 1 && peerConnection_ !== null) {
            peerConnection_.addIceCandidate(iceCandidate).
            then(function() {
                LogInfo("HandleIceCandidate set success - "  + JSON.stringify(data.candidate));
            }).
            catch(function(err){
                LogErr("HandleIceCandidate set failed - " + JSON.stringify(data.candidate) + " " + err.stack + " " + JSON.stringify(err));
                console.log(err);
            });
        } else if (data.streamId === 0 && localSharePeerConnection_ !== null) {
            localSharePeerConnection_.addIceCandidate(iceCandidate).
            then(function() {
                LogInfo("Share: HandleIceCandidate set success - " + JSON.stringify(data.candidate));
            }).
            catch(function(err){
                LogErr("Share: HandleIceCandidate set failed - " + JSON.stringify(data.candidate) + " " + err.stack + " " + JSON.stringify(err));
                console.log(err);
            });
        }
    };

    function HandleStreamMappingChanged(data) {

        var i = 0;
        var oldSourceIds = Object.keys(streamMapping_);
        var newSourceIds = [];
        var streamIds = [];

        for (i = 0; i < data.streams.length; i++) {

            var sourceId = data.streams[i].sourceId;
            newSourceIds.push(sourceId);

            var streamId = data.streams[i].streamId + 1;
            streamIds.push(streamId);

            var viewId = data.streams[i].viewId;
            var name = data.streams[i].sourceName || "Video" + i;
            CreateSourceIdEntryInStreamMappingAndAttachVideo({sourceId: sourceId, streamId: streamId, elemId: viewId, type: "video", name: name});
        }

        var deletedSourceIds = oldSourceIds.filter(function(i) { return newSourceIds.indexOf(i) === -1 && i !== PREVIEW_SOURCE_ID});

        LogInfo("Deleting source ids: " + JSON.stringify(deletedSourceIds));
        for (i = 0; i < deletedSourceIds.length; i++) {
            var sourceId = deletedSourceIds[i];
            if (streamMapping_.hasOwnProperty(sourceId)) {
                var streamId = streamMapping_[sourceId].streamId;
                if (streamIds.indexOf(streamId) === -1) {
                    layoutEngine_[streamMapping_[sourceId].elemId].hide("video", streamId);
                }
                delete streamMapping_[sourceId];
            }
        }

    };

    function GetCameraConstraints(data) {
        maxResolution_ = data.maxResolution;
        var resolution = resolutionMap_[maxResolution_];

        var constraints = {
            video: {
                deviceId: data.camera,
                frameRate: {min: 20},
                width: {ideal: resolution.w },
                height: {ideal: resolution.h }
            }
        };

        if (window.adapter.browserDetails.browser === "chrome") {
        } else {
            // Firefox doesn't seem to be handling constraints
            // So if resolution is greater than 480p, don't specify constraints
            if (constraints.video.height.ideal >= 480) {
                delete constraints.video.width;
                delete constraints.video.height;
            }
        }

        return constraints;
    };


    function HandleStartCamera(data) {
        var constraints = GetCameraConstraints(data);
        cameraViewId_ = data.viewId;
        CreateSourceIdEntryInStreamMappingAndAttachVideo({sourceId: PREVIEW_SOURCE_ID, streamId: 0, attached: false, elemId: data.viewId, type: "preview"});
        camera_.StartDevice(data.camera, constraints); 
    };

    function HandleStopCamera(data) {
        camera_.StopDevice(data.camera);
    };

    function HandleStartMicrophone(data) {
        var constraints = {
            audio: {
                deviceId: data.microphone
            }
        };

        if (window.adapter.browserDetails.browser === "chrome") {
            mic_.StartDevice(data.microphone, constraints);
        } else {
            // In firefox, if a camera pemission window is open and we do getUsermedia for mic, 
            // that permission window is overwritten with this mic permission window 
            // and there is no way for the user to grant camera access after granting mic access
            // Hence if waiting for camera access, do not show mic access and wait for camera started
            if (camera_.IsStarting()) {
                mic_.SetDevice(data.microphone, constraints);
            } else {
                mic_.StartDevice(data.microphone, constraints);
            }
        }
    };

    function HandleStopMicrophone(data) {
        mic_.StopDevice(data.microphone);
    };


    function HandleStartSpeaker(data) {
        if (typeof remoteAudio_[0].setSinkId === "function") {
            for (var r = 0; r < remoteAudio_.length; r++) {
                remoteAudio_[r].setSinkId(data.speaker);
            }
        }
    };

    function HandleStartLocalShare(data) {
        LogInfo("Starting Local Screen Share in call state " + callState_ + " count=" + localShareStream_.length);

        if (callState_ === CALLSTATE_IDLE) {
            HandleStopCall();
            return;
        }

        localSharePeerConnection_ = new RTCPeerConnection(peerConnectionConstraints_);

        localSharePeerConnection_.onicecandidate = function(evt) {
            if (evt.candidate) {
                SendCandidate(0, evt.candidate);
            } else {
                LogInfo("SharePeerConnection onicecandidate done");
            }
        };

        localSharePeerConnection_.oniceconnectionstatechange = function(state) {
            LogInfo("SharePeerConnection oniceconnectionstatechange - " + state.target.iceConnectionState);
        };

        localSharePeerConnection_.onsignalingstatechange = function(state) {
            LogInfo("SharePeerConnection onsignalingstatechange - " + (state.target ? state.target.signalingState : state));
        };

        localSharePeerConnection_.ontrack = function(evt) {
            LogInfo("SharePeerConnection ontrack");
        };

        localSharePeerConnection_.onnegotiationneeded = function() {
            LogInfo("SharePeerConnection onnegotiationneeded callState=" + callState_);

            if (callState_ === CALLSTATE_IDLE) {
                HandleStopCall();
                return;
            }

            var offerConstraints = {
                offerToReceiveAudio: false,
                offerToReceiveVideo: false
            };

            localSharePeerConnection_.createOffer(offerConstraints).
            then(function(offer) {
                var offerMsg = {
                    method: "VidyoWebRTCShareOfferSdp",
                    sdp: offer.sdp
                };
                localShareOffer_ = offer;
                transport_.SendWebRTCMessage(offerMsg, function() {
                    LogInfo("SharePeerConnection Offer sent = " + offer.sdp);

                    if (localShareOffer_ !== null) {
                        localShareOffer_ = null;
                        localSharePeerConnection_.setLocalDescription(offer).
                        then(function() {
                            LogInfo("SharePeerConnection setLocalDescription success");
                        }).
                        catch(function(err) {
                        LogErr("SharePeerConnection setLocalDescription failed " + JSON.stringify(err));
                        console.log(err);
                        });
                    }
                });
            }).
            catch(function(err) {
                LogErr("SharePeerConnection CreateOffer failed " + JSON.stringify(err));
                console.log(err);
            });
        };

        localSharePeerConnection_.addStream(localShareStream_[0]);
    };

    function HandleShareAnswerSdp(data) {
        LogInfo("ShareAnswerSdp: " + data.sdp);
        var SetShareRemoteDescription = function() {

            if (localSharePeerConnection_ === null) {
                LogInfo("localSharePeerConnection HandleShareAnswerSdp pc null, call stopped");
                return;
            }

            var remoteSdp = new RTCSessionDescription({type: "answer", sdp: data.sdp});
            localSharePeerConnection_.setRemoteDescription(remoteSdp).
            then(function() {
                LogInfo("SharePeerConnection setRemoteDescription success");
            }).
            catch(function(err) {
                LogErr("SharePeerConnection setRemoteDescription failed " + JSON.stringify(err));
                console.log(err);
            });
        };

        if (localShareOffer_ !== null) {
            LogInfo("SharePeerConnection HandleShareAnswerSdp localOffer not yet set");
            var o = localShareOffer_;
            localShareOffer_ = null;
            localSharePeerConnection_.setLocalDescription(o).
            then(function() {
                LogInfo("SharePeerConnection setLocalDescription success");
                SetShareRemoteDescription();
            }).
            catch(function(err) {
                LogErr("SharePeerConnection setLocalDescription failed " + JSON.stringify(err));
                console.log(err);
            });
        } else {
            SetShareRemoteDescription();
        }
    };

    function HandleStopLocalShare(data) {
        localShareOffer_ = null;
        localShareElement_ = null;
        shareSelectedCallback_ = null;

        if (pendingRequestId_ !== -1) {
            window.postMessage({type: "VidyoCancelRequest", requestId: pendingRequestId_}, "*");
            pendingRequestId_ = -1;
        }


        if (localShareStream_.length > 0) {
            localShareStream_[0].onended = undefined;
            StopStream([localShareStream_[0]], true, true);
            localShareStream_ = localShareStream_.slice(1);
            LogInfo("StopLocalShare count=" + localShareStream_.length);
        }

        if (localSharePeerConnection_ !== null) {
            localSharePeerConnection_.close();
            localSharePeerConnection_ = null;
        }
    };

    function HandleStreamStatus(data) {
        for (var s = 0; s < data.streams.length; s++) {
            var streamId = data.streams[s].streamId + 1;
            var status = data.streams[s].status == 0 ? "stalled" : "started";
            
            var elemId = getElemId(streamId);
            if (elemId.length > 0 && renderEventCallback_) {
                renderEventCallback_(elemId, status);
            }
            if (elemId.length > 0) {
                layoutEngine_[elemId].videoStatus("video", streamId, status);
            }
        }
    };

    function RemoveAudioStream() {
        if (window.adapter.browserDetails.browser === "chrome") {
            peerConnection_.removeStream(micStream_);
            StopStream([micStream_], true, true);
            micStream_ = null;
        } else {
            var senders = peerConnection_.getSenders();
            for (var i = 0; i < senders.length; i++) {
                var track = senders[i].track;
                if (track.kind === "audio") {
                    peerConnection_.removeTrack(senders[i]);
                }
            }
        }
    };

    function AddAudioStream(micStream) {
        micStream_ = micStream;
        if (window.adapter.browserDetails.browser === "chrome") {
            peerConnection_.addStream(micStream_);
        } else {
            peerConnection_.addTrack(micStream_.getAudioTracks()[0], micStream_);
        }
    };

    function RemoveVideoStream() {
        if (window.adapter.browserDetails.browser === "chrome") {
            peerConnection_.removeStream(videoStreams_[0]);
            StopStream([videoStreams_[0]], true, true);
            videoStreams_[0] = null;
        } else {
            var senders = peerConnection_.getSenders();
            for (var i = 0; i < senders.length; i++) {
                var track = senders[i].track;
                if (track.kind === "video") {
                    peerConnection_.removeTrack(senders[i]);
                }
            }
        }
    };

    function AddVideoStream(cameraStream) {
        // videoStreams_[0] = cameraStream;
        if (window.adapter.browserDetails.browser === "chrome") {
            peerConnection_.addStream(cameraStream);
        } else {
            peerConnection_.addTrack(cameraStream.getVideoTracks()[0], cameraStream);
        }
        // CreateSourceIdEntryInStreamMappingAndAttachVideo({sourceId: PREVIEW_SOURCE_ID, streamId: 0, attached: false, type: "preview"});
    };

    function AddRemoveStreams() {
        var cameraCase = camera_.DiffState(cameraState_);
        var micCase = mic_.DiffState(micState_);

        LogInfo("AddRemoveStreams camera=" + cameraCase + " mic=" + micCase);

        if (cameraCase === "started") {
             AddVideoStream(camera_.GetStreamAndTrack().stream);
        } else if (cameraCase === "stopped") {
            RemoveVideoStream();
        }

        if (micCase === "started") {
            AddAudioStream(mic_.GetStreamAndTrack().stream);
        } else if (micCase === "stopped") {
            RemoveAudioStream();
        }

        GetLocalOffer();
    };

    this.callback = function(data) {
        LogInfo("Callback - " + data.method);
        switch(data.method) {
            case "VidyoWebRTCEnumerateDeviceRequest":
                HandleDeviceEnumerationRequest(data);
            break;

            case "VidyoWebRTCStartCall":
                startCallData_ = data;
                InvokeStateMachine("startCall");
            break;

            case "VidyoWebRTCStopCall":
                InvokeStateMachine("stopCall");
            break;

            case "VidyoWebRTCAnswerSdp":
                InvokeStateMachine("gotAnswer", data);
            break;

            case "VidyoWebRTCIceCandidate":
                HandleIceCandidate(data);
            break;

            case "VidyoWebRTCStreamMappingChanged":
                HandleStreamMappingChanged(data);
            break;

            case "VidyoWebRTCStartCamera":
                HandleStartCamera(data);
            break;

            case "VidyoWebRTCStopCamera":
                HandleStopCamera(data);
            break;

            case "VidyoWebRTCStartSpeaker":
                HandleStartSpeaker(data);
            break;

            case "VidyoWebRTCStopSpeaker":
                // No-op
            break;

            case "VidyoWebRTCStartMicrophone":
                HandleStartMicrophone(data);
            break;

            case "VidyoWebRTCStopMicrophone":
                HandleStopMicrophone(data);
            break;

            case "VidyoWebRTCStartLocalShare":
                HandleStartLocalShare(data);
            break;

            case "VidyoWebRTCShareAnswerSdp":
                HandleShareAnswerSdp(data);
            break;

            case "VidyoWebRTCStopLocalShare":
                HandleStopLocalShare(data);
            break;

            case "VidyoWebRTCStreamStatus":
                HandleStreamStatus(data);
            break;

            case "VidyoWebRTCInitRenderer":
                layoutEngine_[data.viewId] = new LayoutEngine(data.viewId);
                layoutEngine_[data.viewId].initialize();
            break;
        }
    };


    this.registerVidyoRenderer = function(sourceId, elemId, type) {
        switch (type) {
            case "preview":
                // mute unmute creates a new video element and will not attach since attached is true
                var previewElement = document.getElementById(elemId);
                if (previewElement) {
                    previewElement.muted = true;
                }

                delete streamMapping_[PREVIEW_SOURCE_ID];
                CreateSourceIdEntryInStreamMappingAndAttachVideo({sourceId: PREVIEW_SOURCE_ID, previewSourceId: sourceId, elemId: elemId, attached: false, streamId: 0, type: type});
            break;

            case "sharepreview":
                localShareElement_ = document.getElementById(elemId);
                if (localShareElement_ && localShareStream_.length > 0) {
                    var str = localShareStream_[localShareStream_.length - 1];
                    localShareElement_.srcObject = str;
                    localShareElement_.dataset.streamId = str.id;
                } 
            break;

            case "video":
            case "share":
                CreateSourceIdEntryInStreamMappingAndAttachVideo({sourceId: sourceId, elemId: elemId, type: type});
                if (renderEventCallback_) {
                    renderEventCallback_(elemId, "started");
                }
            break;
        }
        LogInfo("registerRenderer type=" + type + " srcId=" + sourceId + " elemId=" + elemId + " " + JSON.stringify(streamMapping_));
    };

    this.unregisterVidyoRenderer = function(sourceId) {
        LogInfo("unregisterRenderer srcId=" + sourceId + " " + JSON.stringify(streamMapping_));
        if (streamMapping_.hasOwnProperty(sourceId)) {
            delete streamMapping_[sourceId];
        }
    };

    function getSourceId(elemId) {
        for (var sourceId in streamMapping_) {
            if (streamMapping_[sourceId].elemId === elemId) {
                return sourceId;
            }
        }
        LogInfo("GetSourceId " + elemId + " NOT FOUND");
        return "";
    };

    function getElemId(streamId) {
        for (var sourceId in streamMapping_) {
            if (streamMapping_[sourceId].streamId === streamId) {
                return streamMapping_[sourceId].elemId;;
            }
        }
        LogInfo("GetElemId " + streamId + " NOT FOUND");
        return "";
    };

    this.updateVidyoRendererParameters = function(streamSizes) {

        var windows = [];
        var sharing = false;
        LogInfo("UpdateVidyoRendererParameters: " + JSON.stringify(streamSizes));
        for (var i = 0; i < streamSizes.length; i++) {

            if (streamSizes[i].width <= 0 || streamSizes[i].height <= 0) {
                LogErr("UpdateVidyoRendererParameters: INVALID HEIGHT/WIDTH");
                continue;
            }

            var sourceId = getSourceId(streamSizes[i].srcID);
            if (sourceId.length > 0) {
                var wnd = {
                    height: streamSizes[i].height,
                    width: streamSizes[i].width,
                    ranking: streamSizes[i].ranking,
                    dynamic: streamSizes[i].dynamic,
                    show: streamSizes[i].show,
                    fps: 30,
                    sourceId: sourceId
                };

                var type = streamMapping_[sourceId].type;
                if (type === "share") {
                    sharing = true;
                    wnd.height = wnd.width = 0;
                } else if (type === "preview") {
                    wnd.sourceId = streamMapping_[sourceId].previewSourceId;
                }
                windows.push(wnd);
            }
        }
        var windowSizesMsg = {
            method: "VidyoWebRTCSetWindowSizes",
            windows: windows,
            sharing: sharing
        };

        // Check if previous and current stream sizes match
        var changed = false;
        if (windowSizesMsg.sharing !== previousWindowSizes_.sharing) {
            LogInfo("VidyoWebRTCSetWindowSizes: sharing changed from " + previousWindowSizes_.sharing + " to " + windowSizesMsg.sharing);
            changed = true;
        } else if (windowSizesMsg.windows.length !== previousWindowSizes_.windows.length) {
            changed = true;
            LogInfo("VidyoWebRTCSetWindowSizes: length changed from " + previousWindowSizes_.windows.length + " to " + windowSizesMsg.windows.length);
        } else {
            for (var i = 0; i < windowSizesMsg.windows.length && !changed; i++) {
                for (var x in windowSizesMsg.windows[i]) {
                    if (previousWindowSizes_.windows[i][x] !== windowSizesMsg.windows[i][x]) {
                        changed = true;
                        LogInfo("VidyoWebRTCSetWindowSizes: windows[" + i + "][" + x + "] changed from " + previousWindowSizes_.windows[i][x] + " to " + windowSizesMsg.windows[i][x]);
                        break;
                    }
                }
            }
        } 

        if (changed) {
            previousWindowSizes_ = windowSizesMsg;
            transport_.SendWebRTCMessage(windowSizesMsg, function() {
                LogInfo("VidyoWebRTCSetWindowSizes sent: " + JSON.stringify(windows));
            });
        } else {
            LogInfo("VidyoWebRTCSetWindowSizes: No Change");
        }
        
    };

    this.getRendererId = function(streamId) {
        return streamId;
    };

    this.setRendererEventsCallback = function(cb) {
        renderEventCallback_ = cb;
    };


    this.setCurrentVideoTiles = function(numVideoTiles) {
        var msg = {
            method: "VidyoWebRTCSetCurrentVideoTiles",
            numVideoTiles: numVideoTiles
        };
        transport_.SendWebRTCMessage(msg, function() {
            LogInfo("VidyoWebRTCSetCurrentVideoTiles sent: " + numVideoTiles);
        });
    };

    function ShareGetUserMedia(constraints) {
        navigator.mediaDevices.getUserMedia(constraints).
        then(function(str) {
            LogInfo("Got Local Share Stream count=" + localShareStream_.length + " id=" + str.id);
            localShareStream_.push(str); 
            if (localShareElement_) {
                localShareElement_.srcObject = str;
                localShareElement_.dataset.streamId = str.id;
            }

            str.onended = function() {
                LogInfo("SharePeerConnection share stream ended");
                localShareStream_.length = 0;
                SendShareRemoved(localShareId_, function() {
                    localShareId_ += 1;
                    SendShareAdded(localShareId_);
                });
            };
            if (shareSelectedCallback_) {
                shareSelectedCallback_(true);
            } else {
                LogErr("ShareGetUserMedia shareSelectedCallback_ null");
            }
        }).
        catch(function(err) {
            LogErr("Local Share Stream error" + JSON.stringify(err));
            console.log(err);
            if (shareSelectedCallback_) {
                shareSelectedCallback_(false);
            } else {
                LogErr("ShareGetUserMedia error shareSelectedCallback_ null");
            }
        });
    };

    this.selectShare = function(cb) {
        if (window.adapter.browserDetails.browser === "chrome") {
            if (pendingRequestId_ === -1) {
                shareSelectedCallback_ = cb;
                window.postMessage({ type: "VidyoRequestGetWindowsAndDesktops"}, "*");
            } else {
                LogErr("Pending request for StartLocalShare");
                cb(false);
            }   
        } else {
            var constraints = {
                video : {
                    mediaSource: "window",
                    mozMediaSource: "window"
                }
            };

            shareSelectedCallback_ = cb;
            ShareGetUserMedia(constraints);
        }
    };

    window.addEventListener("message", function (event) {
        if (event.origin !== window.location.origin) {
            return;
        }

        if (event.data.type === "VidyoRequestId") {
            LogInfo("VidyoRequestId - " + event.data.requestId);
            pendingRequestId_ = event.data.requestId;
        }

        if (event.data.type === "VidyoOutEventSourceId") {
            pendingRequestId_ = -1;

            if (event.data.sourceId === "") { // The user clicked cancel
                if (shareSelectedCallback_) {
                    LogInfo("ShareGetUserMedia User Cancelled");
                    shareSelectedCallback_(false);
                } else {
                    LogErr("ShareGetUserMedia cancel shareSelectedCallback_ null");
                }
                return;
            }

            var width = 1920;
            var height = 1080;

            var constraints = {
                video:  { mandatory:
                            {
                                chromeMediaSource: "desktop",
                                chromeMediaSourceId: event.data.sourceId,
                                maxWidth: width,
                                maxHeight: height,
                                maxFrameRate: 5
                            }
                        }
            };
            ShareGetUserMedia(constraints);
        }
    });

    function SendUninitialize() {
        callState_ = CALLSTATE_IDLE;
        HandleStopCall();

        camera_.StopDevice();
        mic_.StopDevice();
        StopStream([micStream_], true, true);
        micStream_ = null;

        var uninitMsg = {
            method: "VidyoWebRTCUninitialize"
        };
        transport_.SendWebRTCMessage(uninitMsg, function() {
            LogInfo("VidyoWebRTCUninitialize success");
        });

        // Do something here so that the uninitialize message reaches the server
        var j = 0;
        for (var i = 0; i < 500; i++) {
            j++; 
        }
    };

    window.addEventListener("unload", SendUninitialize);

    this.Uninitialize = function() {
        SendUninitialize();
    };

}

/** Layout Engine **/
function LayoutEngine(viewId) {
    var NUM_ELEMENTS = 9;
    var ASPECT_RATIO = 16.0 / 9;
    var PIP_WIDTH = 240;
    var PIP_HEIGHT = 135;
    var THUMBNAIL_SIDE_RIGHT = 1;
    var THUMBNAIL_SIDE_BOTTOM = 2;
    var SELF_VIEW_DOCK = "Dock";
    var SELF_VIEW_PIP = "PIP";
    var LAYOUT_MODE_PREFERRED = "preferred";
    var LAYOUT_MODE_GRID = "grid";

    var SELF_FRAME_ID = "_vidyoSelfFrame";
    var SHARE_FRAME_ID = "_vidyoShareFrame";
    var REMOTE_FRAME_ID = "_vidyoRemoteFrame";

    var SELF_NAME_ID = "_vidyoSelfName";
    var SHARE_NAME_ID = "_vidyoShareName";
    var REMOTE_NAME_ID = "_vidyoRemoteName";


    var layoutEngineCss = "                                        \
        .videoContainer {                                          \
            position: relative;                                    \
            width: 100%;                                           \
            height: 100%;                                          \
            overflow: hidden;                                      \
        }                                                          \
                                                                   \
        .videoContainer .frame {                                   \
            display: none;                                         \
            position: absolute;                                    \
            top: 0;                                                \
            right: 0;                                              \
            bottom: 0;                                             \
            left: 0;                                               \
            overflow: hidden;                                      \
            background-color: #202020;                             \
        }                                                          \
                                                                   \
        .videoContainer .frame video {                             \
            width: 100%;                                           \
        }                                                          \
                                                                   \
        .videoContainer .frame .label {                            \
            position: absolute;                                    \
            bottom: 10px;                                          \
            width: 100%;                                           \
            text-align: left;                                      \
        }                                                          \
                                                                   \
        .videoContainer .frame .label .labelContainer {            \
            height: 100%;                                          \
            display: inline-block;                                 \
            font-size: 0px;                                        \
        }                                                          \
                                                                   \
        .videoContainer .frame .label .labelContainer div {        \
            color: white;                                          \
            background-color: rgba(0, 0, 0, 0.2);                  \
            border-radius: 2px;                                    \
            padding: 3px 15px;                                     \
            height: 100%;                                          \
        }                                                          \
                                                                   \
        @media (min-aspect-ratio: 16/9) {                          \
            .videoContainer .share video {                         \
                height: 100%;                                      \
            }                                                      \
        }                                                          \
                                                                   \
        @media (max-aspect-ratio: 16/9) {                          \
            .videoContainer .share video {                         \
                width: 100%;                                       \
                height: 100%;                                      \
            }                                                      \
        } ";

    var layoutEngineStyle = document.createElement("style");
    layoutEngineStyle.type = "text/css";
    layoutEngineStyle.innerHTML = layoutEngineCss;
    document.getElementsByTagName("head")[0].appendChild(layoutEngineStyle);

    var view = null;
    var initialized = false;
    var FRAME = '<div class="frame" id="<frameid>"> <video muted autoplay> </video> <div class="label"> <div class="labelContainer"> <div class="guest" id="<nameid>"> </div> </div> </div> </div>';

    var currentContext = {
        participantCount: 0,
        participants: new Array(NUM_ELEMENTS).fill(-1),
        selfViewMode: "None",
        isWatchingShare: false,
        width: 0,
        height: 0,
        layoutMode: "grid"
    };

    var currentLayout = {
        shareAttrs: new AttrSet(),
        selfViewAttributes: new AttrSet(),
        videoAttributes: getAttrSetArray(NUM_ELEMENTS)
    };

    function LogInfo (msg) {
        console.log("" + GetTimeForLogging() + " LayoutEngine: " + msg);
    };


    function LogErr (msg) {
        console.error("" + GetTimeForLogging() + " LayoutEngine: " + msg);
    };


    function GridMetrics(parentWidth, parentHeight, cols, rows) {
        var gridAspect = ASPECT_RATIO * (cols / rows);
        if (parentWidth / parentHeight < gridAspect) {
            this.width = parentWidth;
            this.height = parentWidth / gridAspect;
        } else {
            this.height = parentHeight;
            this.width = parentHeight * gridAspect;
        }
        this.cellWidth = Math.floor(this.width / cols);
        this.cellHeight = Math.floor(this.height / rows);
        this.width = this.cellWidth * cols;
        this.height = this.cellHeight * rows;
        this.contentTop = Math.round((parentHeight - this.height) / 2);
        this.contentLeft = Math.round((parentWidth - this.width) / 2);
        this.whitespace = this.height * (parentWidth - this.width) + this.width * (parentHeight - this.height) + (parentWidth - this.width) * (parentHeight - this.height);
    }

    function Grid(parentWidth, parentHeight, numVideos, cols) {
        var rows = Math.ceil(numVideos / cols);
        var gridMetrics = new GridMetrics(parentWidth, parentHeight, cols, rows);
        var emptyCells = cols * rows - numVideos;
        this.whitespace = gridMetrics.whitespace + emptyCells * gridMetrics.cellWidth * gridMetrics.cellHeight;
        this.videoMetrics = [];
        for (var i = 0; i < numVideos; i++) {
            var row = Math.floor(i / cols);
            var col = i % cols;
            this.videoMetrics.push({
                x: gridMetrics.contentLeft + col * gridMetrics.cellWidth,
                y: gridMetrics.contentTop + row * gridMetrics.cellHeight,
                width: gridMetrics.cellWidth,
                height: gridMetrics.cellHeight
            });
        }
    }

    function PreferredGrid(parentWidth, parentHeight, numVideos, thumbnailSide) {
        this.videoMetrics = [];
        var gridMetrics, i;
        if (numVideos === 1) {
            gridMetrics = new GridMetrics(parentWidth, parentHeight, 1, 1);
            this.videoMetrics.push({
                x: gridMetrics.contentLeft,
                y: gridMetrics.contentTop,
                width: gridMetrics.width,
                height: gridMetrics.height
            });
        } else if (thumbnailSide === THUMBNAIL_SIDE_RIGHT) {
            gridMetrics = new GridMetrics(parentWidth, parentHeight, numVideos, numVideos - 1);
            this.videoMetrics.push({
                x: gridMetrics.contentLeft,
                y: gridMetrics.contentTop,
                width: gridMetrics.cellWidth * (numVideos - 1),
                height: gridMetrics.height
            });
            for (i = 1; i < numVideos; i++) {
                this.videoMetrics.push({
                    x: gridMetrics.contentLeft + gridMetrics.cellWidth * (numVideos - 1),
                    y: gridMetrics.contentTop + gridMetrics.cellHeight * (i - 1),
                    width: gridMetrics.cellWidth,
                    height: gridMetrics.cellHeight
                });
            }
        } else {
            gridMetrics = new GridMetrics(parentWidth, parentHeight, numVideos - 1, numVideos);
            this.videoMetrics.push({
                x: gridMetrics.contentLeft,
                y: gridMetrics.contentTop,
                width: gridMetrics.width,
                height: gridMetrics.cellHeight * (numVideos - 1)
            });
            for (i = 1; i < numVideos; i++) {
                this.videoMetrics.push({
                    x: gridMetrics.contentLeft + gridMetrics.cellWidth * (i - 1),
                    y: gridMetrics.contentTop + gridMetrics.cellHeight * (numVideos - 1),
                    width: gridMetrics.cellWidth,
                    height: gridMetrics.cellHeight
                });
            }
        }
        this.whitespace = gridMetrics.whitespace;
    }

    function AttrSet() {
        this.display = "none";
        this.x = 0;
        this.y = 0;
        this.width = 0;
        this.height = 0;
        this.fontSize = 15;
    }

    function applyLayout(participants, layout) {

        var applyToFrame = function(attr, frame) {
            frame.style.display = attr.display;
            if (attr.display !== "none") {
                frame.style.left = attr.x + "px";
                frame.style.top = attr.y + "px";
                frame.style.width = attr.width + "px";
                frame.style.height = attr.height + "px";

                frame.getElementsByClassName("labelContainer")[0].style.fontSize = attr.fontSize + "px";
            }
        };

        var frame = document.getElementById(viewId + SELF_FRAME_ID);
        if (frame) {
            applyToFrame(layout.selfViewAttributes, frame);
        } else {
            LogInfo("applyLayout: frame not found " + (viewId + SELF_FRAME_ID));
        }

        var displayedFrames = new Array(NUM_ELEMENTS).fill(-1);

        var layoutIndex = 0;
        for (var i = 0; i < NUM_ELEMENTS; i++) {
            if (participants[i] !== -1) {
                displayedFrames[participants[i]] = 1;
                frame = document.getElementById(viewId + REMOTE_FRAME_ID + participants[i]);
                if (frame) {
                    applyToFrame(layout.videoAttributes[layoutIndex++], frame);
                } else {
                    LogInfo("applyLayout: frame not found " + (viewId + REMOTE_FRAME_ID + participants[i]));
                }
            } 
        }

        for (i = 0; i < NUM_ELEMENTS; i++) {
            if (displayedFrames[i] === -1) {
                frame = document.getElementById(viewId + REMOTE_FRAME_ID + i);
                if (frame) {
                    applyToFrame({display: "none"}, frame);
                } else {
                    LogInfo("applyLayout: frame not found " + (viewId + REMOTE_FRAME_ID + i));
                }
            }
        }

        frame = document.getElementById(viewId + SHARE_FRAME_ID);
        if (frame) {
            applyToFrame(layout.shareAttrs, frame);
        } else {
            LogInfo("applyLayout: frame not found " + (viewId + SHARE_FRAME_ID));
        }
    }

    /** 
        Input: context: {
            participantCount,
            participants: <array of indices to indicate which participant is in which frame in the layout>
            selfViewMode: "Dock|PIP|None",
            isWatchingShare: <true|false>,
            width:
            height:   
            layoutMode: "grid|preferred",
        }

        Output: layout: {
            videoAttributes []: {
                display: "block|none",
                x:
                y:
                width:
                height:
                fontSize:
            },
            shareAttrs: {
                // Same as videoAttributes 
            },
            selfViewAttributes: {
                // Same as videoAttributes 
            }
        }
    **/

    function getAttrSetArray(n) {
        var ret = [];
        for (var i = 0; i < n; i++) {
            ret.push(new AttrSet());
        }

        return ret;
    }

    function calculateLayout (context, layout) {
        var numLayoutFrames = context.participantCount;
        var firstVideoFrame = 0;

        if (context.selfViewMode === SELF_VIEW_DOCK) {
            numLayoutFrames += 1;
        }

        if (context.isWatchingShare) {
            numLayoutFrames += 1;
            firstVideoFrame = 1;
        }

        var i;
        if (context.width === 0 || context.height === 0 || numLayoutFrames === 0) {
            layout.shareAttrs = new AttrSet();
            layout.selfViewAttributes = new AttrSet();
            layout.videoAttributes = getAttrSetArray(NUM_ELEMENTS);
            applyLayout(context.participants, layout);
            return;
        }
        var best = null;
        if (numLayoutFrames === 1) {
            best = new Grid(context.width, context.height, 1, 1);
        } else if (context.layoutMode === LAYOUT_MODE_PREFERRED) {
            var thumbsRightLayout = new PreferredGrid(context.width, context.height, numLayoutFrames, THUMBNAIL_SIDE_RIGHT);
            var thumbsBottomLayout = new PreferredGrid(context.width, context.height, numLayoutFrames, THUMBNAIL_SIDE_BOTTOM);
            if (thumbsBottomLayout.whitespace < thumbsRightLayout.whitespace) {
                best = thumbsBottomLayout;
            } else {
                best = thumbsRightLayout;
            }
        } else {
            for (i = 1; i < numLayoutFrames + 1; i++) {
                var grid = new Grid(context.width, context.height, numLayoutFrames, i);
                if (best === null || best.whitespace > grid.whitespace) {
                    best = grid;
                }
            }
        }
        var fontSize;
        for (i = 0; i < context.participantCount && i < NUM_ELEMENTS; i++) {
            var attrs = layout.videoAttributes[i];
            var metrics = best.videoMetrics[firstVideoFrame + i];
            attrs.display = "block";
            attrs.x = metrics.x;
            attrs.y = metrics.y;
            attrs.width = metrics.width;
            attrs.height = metrics.height;
            attrs.fontSize = Math.floor(attrs.height * 7 / 100);
        }
        for (i = context.participantCount; i < NUM_ELEMENTS; i++) {
            layout.videoAttributes[i].display = "none";
        }
        var shareAttrs = layout.shareAttrs;
        if (context.isWatchingShare) {
            var shareMetrics = best.videoMetrics[0];
            shareAttrs.display = "block";
            shareAttrs.x = shareMetrics.x;
            shareAttrs.y = shareMetrics.y;
            shareAttrs.width = shareMetrics.width;
            shareAttrs.height = shareMetrics.height;
            shareAttrs.fontSize = Math.floor(shareAttrs.height * 7 / 100);
        } else {
            shareAttrs.display = "none";
        }
        var selfViewAttrs = layout.selfViewAttributes;
        var selfViewMetrics;
        switch (context.selfViewMode) {
            case SELF_VIEW_DOCK:
                selfViewMetrics = best.videoMetrics[best.videoMetrics.length - 1];
                selfViewAttrs.display = "block";
                selfViewAttrs.x = selfViewMetrics.x;
                selfViewAttrs.y = selfViewMetrics.y;
                selfViewAttrs.width = selfViewMetrics.width;
                selfViewAttrs.height = selfViewMetrics.height;
                break;
            case SELF_VIEW_PIP:
                selfViewAttrs.display = "block";
                selfViewAttrs.x = context.width - PIP_WIDTH;
                selfViewAttrs.y = context.height - PIP_HEIGHT;
                selfViewAttrs.width = PIP_WIDTH;
                selfViewAttrs.height = PIP_HEIGHT;
                break;
            default:
                selfViewAttrs.display = "none";
        }
        selfViewAttrs.fontSize = Math.floor(selfViewAttrs.height * 7 / 100);
        applyLayout(context.participants, layout);
    };

    function init() {
        LogInfo("init: viewId=" + viewId);
        view = document.getElementById(viewId);
        if (!view) {
            LogErr("init: NULL viewId");
            return false;
        }
        var layoutTemplate = '<div class="videoContainer">' 
        layoutTemplate += FRAME.replace("<frameid>", viewId + SHARE_FRAME_ID).replace("<nameid>", viewId + SHARE_NAME_ID);
        for (var i = 0; i < NUM_ELEMENTS; i++ ) {
            layoutTemplate += FRAME.replace("<frameid>", viewId + REMOTE_FRAME_ID + i).replace("<nameid>", viewId + REMOTE_NAME_ID + i);
        }

        layoutTemplate += FRAME.replace("<frameid>", viewId + SELF_FRAME_ID).replace("<nameid>", viewId + SELF_NAME_ID);
        layoutTemplate += "</div>";

        view.innerHTML = layoutTemplate;

        currentContext.width = view.clientWidth;
        currentContext.height = view.clientHeight;

        var previewVideoElement = document.getElementById(viewId + SELF_FRAME_ID).getElementsByTagName("video")[0];
        if (previewVideoElement) {
            previewVideoElement.style.transform = "scaleX(-1)"; // To mirror the preview
        }

        window.setInterval(function() {
            if (initialized) {
                var w = view.clientWidth;
                var h = view.clientHeight;
                if (currentContext.width !== w || currentContext.height !== h) {
                    currentContext.width = w;
                    currentContext.height = h;
                    calculateLayout(currentContext, currentLayout); 
                }
            }
        }, 3000);
        return true;
    };

    this.initialize = function() {
        if (!initialized) {
            initialized = init();
        }
    };

    this.reset = function(viewId) {
        initialized = false;
    };

    function setPreviewMode() {
        if (currentContext.selfViewMode !== SELF_VIEW_DOCK && currentContext.selfViewMode !== SELF_VIEW_PIP) {
            return;
        }

        // For single participant, self view is dock
        // For more than 2 participants, self view is dock
        // For 1 and 2 participants, self view is pip
        if (currentContext.participantCount <= 0 || currentContext.participantCount > 2) {
            currentContext.selfViewMode = SELF_VIEW_DOCK;
        } else {
            currentContext.selfViewMode = SELF_VIEW_PIP;
        }
    };

    function showPreview (name) {
        currentContext.selfViewMode = SELF_VIEW_DOCK;
        setPreviewMode();
        calculateLayout(currentContext, currentLayout);
        var elem = document.getElementById(viewId + SELF_NAME_ID);
        if (elem) {
            elem.innerHTML = name;
        }
    };

    function hidePreview() {
        currentContext.selfViewMode = "None";
        var elem = document.getElementById(viewId + SELF_NAME_ID);
        if (elem) {
            elem.innerHTML = "";
        }
        calculateLayout(currentContext, currentLayout);
    };

    function showHideShare(show, name) {
        currentContext.isWatchingShare = show;
        calculateLayout(currentContext, currentLayout);
        var elem = document.getElementById(viewId + SHARE_NAME_ID);
        if (elem) {
            elem.innerHTML = name;
        }
    };

    function showVideo(index, name) {
        var elem = document.getElementById(viewId + REMOTE_NAME_ID + index);
        if (elem) {
            elem.innerHTML = name;
        }

        if (currentContext.participants.indexOf(index) !== -1) {
            LogInfo("show: index " + index + " already shown");
            return;
        }

        currentContext.participantCount += 1;
        for (var i = 0; i < NUM_ELEMENTS; i++) {
            if (currentContext.participants[i] === -1) {
                currentContext.participants[i] = index;
                break;
            }
        }    
        setPreviewMode(); // self view mode may change based on the number of participants
        calculateLayout(currentContext, currentLayout);
    };

    function hideVideo(index) {
        if (currentContext.participants.indexOf(index) === -1) {
            LogErr("hide: index " + index + " already hidden");
            return;
        }

        currentContext.participantCount -= 1;
        for (var i = 0; i < NUM_ELEMENTS; i++) {
            if (currentContext.participants[i] === index) {
                currentContext.participants[i] = -1;
                break;
            }
        }
        setPreviewMode(); // self view mode may change based on the number of participants
        calculateLayout(currentContext, currentLayout);

        var elem = document.getElementById(viewId + REMOTE_NAME_ID + index);
        if (elem) {
            elem.innerHTML = "";
        }
    };

    this.getVideoElement = function(type, index) {
        var frame;
        switch (type) {
            case "preview":
                frame = document.getElementById(viewId + SELF_FRAME_ID);
            break;

            case "sharepreview":
            case "share":
                frame = document.getElementById(viewId + SHARE_FRAME_ID);
            break;

            case "video":
                frame = document.getElementById(viewId + REMOTE_FRAME_ID + (index-1));
            break;
        }

        if (frame) {
            return frame.getElementsByTagName("video")[0];
        }

        return frame;
    };

    this.show = function(type, index, name) {
        if (!initialized) {
            LogErr("show: NOT initialized");
            return;
        }
        LogInfo("show " + type + " " + index + " " + name);
        switch (type) {
            case "preview":
                showPreview(name);
            break;

            case "share":
            case "sharepreview":
                showHideShare(true, name);
            break;

            case "video":
                showVideo(index-1, name);
            break;
        }
    };

    this.hide = function(type, index) {
        if (!initialized) {
            LogErr("hide: NOT initialized");
            return;
        }
        LogInfo("hide " + type + " " + index);
        switch (type) {
            case "preview":
                hidePreview();
            break;

            case "share":
            case "sharepreview":
                showHideShare(false, "");
            break;

            case "video":
                hideVideo(index-1);
            break;
        }
    };

    this.videoStatus = function(type, index, status) {
        if (!initialized) {
            LogErr("videoStatus: NOT initialized");
            return;
        }
        LogInfo("videoStatus " + type + " " + index + " " + status);
        var frame;
        switch (type) {
            case "share":
            case "sharepreview":
                frame = document.getElementById(viewId + SHARE_FRAME_ID);
            break;

            case "video":
                frame = document.getElementById(viewId + REMOTE_FRAME_ID + (index - 1));
            break;
        }

        if (frame) {
            if (status === "stalled") {
                frame.getElementsByTagName("video")[0].load();
            } else {
                /**
                frame.className = frame.className.replace("noVideo", "");
                frame.getElementsByTagName("video")[0].style.display = "block";
                **/
            }
        }
    };
}


function VidyoClientTransport(plugInObj, statusChangeHandler, callbackHandler, plugInDivId){

    function randomString(length, chars) {
        var result = '';
        for (var i = length; i > 0; --i) result += chars[Math.floor(Math.random() * chars.length)];
        return result;
    }

    var sessionId = randomString(12, '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ');
    var contextObj = plugInObj;
    var statusChangeCallback = statusChangeHandler;
    var receiveCallback = callbackHandler;

    var session = "";
    var callId = "";
    var ms = "";
    var webrtcServer = VCUtils.webRTCServer;
    var requestNum = 1;
    var webrtcClient = new VidyoClientWebRTC(this);
    var connectionState = "CONNECTING";
    var eventsCounter = 1;

    var loggedInTimer = null;

    var requestQueue = [];
    var requestPending = -1;

    var GetTimeForLogging = function() {
        return new Date().toLocaleTimeString();
    };

    var LogInfo = function(msg) {
        console.log(GetTimeForLogging() + " Transport: " + msg);
    };


    var LogErr = function(msg) {
        console.error(GetTimeForLogging() + " Transport: " + msg);
    };

    var connectionError = function() {
        if (connectionState === "CONNECTED" || connectionState === "CONNECTING") {
            webrtcClient.Uninitialize();
            connectionState = "DISCONNECTED";
            statusChangeCallback({state: "FAILED", description: "Disconnected from the WebRTC Server"});
        }
    };

    var TransportMessageSequential = function(url, params, async, successCb, errorCb, doLog) {
        requestQueue.push({url: url, params: params, async: async, successCb: successCb, errorCb: errorCb, doLog: doLog}); 
        CheckAndSendMessage();

    };

    var CheckAndSendMessage = function() {
        if (requestPending >= 0) {
            LogInfo("CheckAndSendMessage: Waiting for " + requestPending + " QLen=" + requestQueue.length);
        } else {
            var o = requestQueue.shift();
            if (o) {
                requestPending = o.params.requestNum;
                LogInfo("CheckAndSendMessage: Sending " + requestPending);
                TransportMessage(o.url, o.params, o.async, 
                    function(a) {
                        requestPending = -1;
                        o.successCb(a);
                        CheckAndSendMessage();
                    },
                    function(e) {
                        requestPending = -1;
                        o.errorCb(e);
                        CheckAndSendMessage();
                    }
                );
            }
        }
    };

    var TransportMessage = function(url, params, async, successCb, errorCb, doLog) {
        if (connectionState !== "CONNECTING" && connectionState !== "CONNECTED") {
            LogErr("Transport Message in invalid state " + connectionState);
            return;
        }
        var start = Date.now();
        var paramsStr = JSON.stringify(params);
        var logStr = webrtcServer + url + ":" + paramsStr;
        if (!doLog) {
            logStr = url + ":" + paramsStr.replace(/\?.*?"/, "\""); // Do not log the parameters
        }
        LogInfo("Req: async:" + async + " - " + logStr);
        var oReq = new XMLHttpRequest();
        oReq.open("post", webrtcServer + url, async);

        oReq.onload = function() {
            if (oReq.status !== 200) {
                LogErr(logStr + " " + oReq.status + " " + oReq.statusText);
                errorCb(oReq.status + " " + oReq.statusText);
                return;
            }

            var logRespStr = oReq.responseText.replace(/VidyoRoomFeedbackGetRoomPropertiesResult.*VIDYO_ROOMGETPROPERTIESRESULT/, "VidyoRoomFeedbackGetRoomPropertiesResult*****VIDYO_ROOMGETPROPERTIESRESULT");
            LogInfo("Resp: [" + (Date.now() - start) + "] " + logStr + " response: " + logRespStr);


            var response = JSON.parse(oReq.responseText);
            successCb(response);
            return;

            /*
            try {
                var response = JSON.parse(oReq.responseText);
                successCb(response);
                return;
            } catch (e) {
                LogErr("TransportMessage: " + logStr + " Exception - " + e.stack + " " +  e);
                statusChangeCallback({error: e});
            }
            */
        };

        oReq.onerror = function(e) {
            LogErr(logStr + " onerror: " +  e);
            errorCb("error");
        };

        oReq.onabort = function(e) {
            LogErr(logStr + " onabort: " +  e);
            errorCb("abort");
        };

        oReq.send(paramsStr);

    };


    var HandleEvents = function(evts) {
        for (var i = 0; i < evts.length; i++) {
            switch(evts[i].destination) {
                case "VidyoWebRTC":
                    webrtcClient.callback(evts[i].data);
                break;

                case "VidyoClient":
                    receiveCallback(contextObj, JSON.parse(evts[i].data));

                    /*
                    try {
                        receiveCallback(contextObj, JSON.parse(evts[i].data));
                    } catch (e) {
                        LogErr("HandleEvents: VidyoClient error: " + e.stack + " " + e);
                        statusChangeCallback({error: e});
                    }
                    */
                    break;
            }
        }
    };

    var LongPoll = function(retryCnt) {
        if (retryCnt === undefined) {
            retryCnt = 0;
            eventsCounter++;
        } 

        TransportMessage("/events", {session: session, count: eventsCounter}, true,
            function(resp) {
                HandleEvents(resp);
                LongPoll();
            }, function(err) {
                if (err === "error" || err === "abort") {
                    if (retryCnt <= 0) { // try once before giving up
                        retryCnt++;
                        LongPoll(retryCnt);
                    } else {
                        connectionError();
                    }
                } else {
                    connectionError();
                }
            }, true);
    };

    var Initialize = function() {
        TransportMessage("/initialize", {}, true, function(resp) {
            session = resp.session;
            callId = resp.callId;
            ms = resp.ms;
            if (resp.host.length > 0) {
                webrtcServer = "https://" + resp.host;
            }
            connectionState = "CONNECTED";
            statusChangeCallback({state: "READY", description: "WebRTC successfully loaded"});
            LongPoll();
            }, function() {
                connectionState = "DISCONNECTED";
                statusChangeCallback({state: "FAILED", description: "Could not initialize WebRTC transport"});
            }, true);
    };

    this.UpdateViewOnDOM = function(uiEvent, parentDivId, x, y, w, h){
        var plugInDivId = parentDivId ? sessionId + "_" + parentDivId : parentDivId;
        var type = "RENDERER";
        if((uiEvent.indexOf("create") !== -1) || (uiEvent.indexOf("constructor") !== -1) || (uiEvent.indexOf("AssignView") !== -1)){
            if(parentDivId){
                VCUtils.jQuery('#' + parentDivId).html("<div id='" + plugInDivId + "' vidyoclientplugin_type='" + type + "' class='VidyoClientPlugIn' style='width: 100%; height: 100%;'></div>");
            }
        }
        else if (uiEvent.indexOf("ShowView") !== -1){
            if(parentDivId){
                VCUtils.jQuery('#' + parentDivId).css('left', x);
                VCUtils.jQuery('#' + parentDivId).css('top', y);
                VCUtils.jQuery('#' + parentDivId).css('width', w);
                VCUtils.jQuery('#' + parentDivId).css('height', h);
            }
        }
        else if (uiEvent.indexOf("HideView") !== -1){
            if(parentDivId){
                VCUtils.jQuery('#' + parentDivId).html('');
            }
        }

        return plugInDivId;
    }

    this.SendMessage = function(data, asyncSuccess, asyncFailure, async){

        if (connectionState !== "CONNECTED") {
            LogErr("SendMessage in invalid state " + connectionState);
            return {result: "error"};
        }

        var request = {
            destination: "VidyoClient",
            data: data,
            requestNum: requestNum++,
            session: session
        };
        var ret;
        var localAsync = false;
        var failureCallback = connectionError;
        if (async === true && typeof asyncSuccess === "function" && typeof asyncFailure === "function") {
            localAsync = async;
            failureCallback = asyncFailure;
        }
        var doLog = true;
        const DO_NOT_LOG = ["VidyoUserLogin", "VidyoRoomEnter", "VidyoUserSetWebProxyAddressCredentials", "VidyoRoomSetRoomProperties"];
        for (var i = 0; i < DO_NOT_LOG.length; i++) {
            if (data.substring(0, DO_NOT_LOG[i].length) == DO_NOT_LOG[i]) {
                doLog = false;
                break;
            }
        }

        TransportMessageSequential("/transport", request, localAsync,
            function(response) {
                ret = response;
                if (localAsync) {
                    asyncSuccess(response);
                }
                return response;
            }, connectionError, doLog);

        var loggedOut = "VidyoUserFeedbackLoggedOutComplete";

        if (data.substring(0, loggedOut.length) === loggedOut) {
            webrtcClient.Uninitialize();
            connectionState = "DISCONNECTED";
        }

        return ret;
    };

    this.SendWebRTCMessage = function(params, cb) {
        if (connectionState !== "CONNECTED") {
            LogErr("SendMessage in invalid state " + connectionState);
            return false; 
        }

        var request = {
            destination: "VidyoWebRTC",
            data: JSON.stringify(params),
            session: session
        };
        TransportMessage("/transport", request, true, cb, connectionError, true);
        return true;
    };

    this.SendLogs = function(logs, cb) {
        var oReq = new XMLHttpRequest();
        oReq.open("post", webrtcServer + "/uploadlogs?callId="+callId+"&mediaserver="+ms, true);

        oReq.onload = function() {
            cb(true);
        };

        oReq.onerror = function(e) {
            LogErr("SendLogs: onerror: " +  e);
            cb(false);
        };

        oReq.onabort = function(e) {
            LogErr("SendLogs: onabort: " +  e);
            cb(false);
        };


        oReq.send(logs);
    };

    Initialize();
}

w.VidyoClientTransport = VidyoClientTransport;

})(window);

