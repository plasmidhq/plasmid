exports.noop = function noop(){};

exports.extend = function(dest, src) {
    for (var prop in src) {
        if (src.hasOwnProperty(prop)) {
            dest[prop] = src[prop];
        }
    }
};

exports.defaults = function(dest, src) {
    for (var prop in src) {
        if (src.hasOwnProperty(prop) && !dest.hasOwnProperty(prop)) {
            dest[prop] = src[prop];
        }
    }
};

exports.bind = function bind(ctx) {
    var args = Array.apply(this, arguments);
    var ctx = Array.prototype.shift.apply(args);
    var func = Array.prototype.shift.apply(args);
    return function() {
        var combined = Array.apply(this, args);
        while (arguments.length > 0) {
            combined.push(Array.prototype.shift.apply(arguments));
        }
        return func.apply(ctx, combined);
    };
};

exports.http = function http(method, url, body, access, secret) {
    var method = method.toUpperCase();
    var httpreq = new XMLHttpRequest();
    httpreq.onreadystatechange = statechange;
    httpreq.open(method, url);
    if (access && !secret) {
        secret = access.secret;
        access = access.access;
    }
    if (access && secret) {
        var auth = "Basic " + Base64.encode(access + ':' + secret);
        httpreq.setRequestHeader('authorization', auth);
    }
    if (method == 'POST' || method == 'PUT') {
        httpreq.send(JSON.stringify(body));
    } else {
        httpreq.send(null);
    }

    var request = new Promise();
    return request;

    function statechange() {
        if (httpreq.readyState === 4) {
            if (httpreq.status === 401) {
                console.log("Not authorized");
            } else if (httpreq.status == 200) {
                var data = JSON.parse(httpreq.responseText);
                request.trigger('success', data);
            }
        }
    }
}

exports.random_token = function(size) {
    var alphanum = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuv0123456789";
    var chars = [];
    while (size > 0) {
        chars.push(alphanum[parseInt(Math.random() * alphanum.length)]);
        size--;
    }
    return chars.join('');
};

// Returns a "Stream Zipper" object
// Which can combine N streams into one, expecting
// the input streams are all ordered.
exports.zipStreams = function(n, cmp, callback, done) {
    if (arguments.length === 2) {
        callback = arguments[1]
        cmp = null
    }
    if (cmp === null) {
        cmp = (a, b) => a - b
    }
    var buffers = [];
    for (var i=0; i < n; i++) {
        buffers.push({values: [], finished: false})
    }

    // internal utilities
    function hasUnfinishedBuffers() {
        for (var i=0; i < n; i++) {
            if (!buffers[i].finished) {
                return true;
            }
        }
        return false;
    }
    function hasWaitingBuffers() {
        for (var i=0; i < n; i++) {
            if (buffers[i].values.length === 0 && !buffers[i].finished) {
                return true;
            }
        }
        return false;
    }
    function hasReadyBuffers() {
        for (var i=0; i < n; i++) {
            if (buffers[i].values.length > 0) {
                return true;
            }
        }
        return false;
    }

    function pop(i) {
        return buffers[i].values.splice(0, 1)[0]
    }

    function sendNext() {
        var candidates = []
        for (var i=0; i < n; i++) {
            if (buffers[i].values.length > 0) {
                candidates.push({
                    i: i,
                    value: buffers[i].values[0],
                })
            }
        }
        candidates.sort((a, b) => cmp(a.value, b.value))

        if (candidates.length > 0) {
            var value = pop(candidates[0].i)
            callback(value)
            doneIfDone()
        }
    }

    var doneCalled = false;
    function doneIfDone() {
        if (!doneCalled && !hasUnfinishedBuffers() && !hasReadyBuffers()) {
            if (typeof done === 'function') {
                done()
                doneCalled = true;
            }
        }
    }

    function sendUntilExhausted() {
        while (hasReadyBuffers()) {
            if (hasWaitingBuffers()) {
                return;
            } else {
                sendNext();
            }
        }
    }

    return {
        push: function(streamNumber, value, last) {
            buffers[streamNumber].values.push(value);
            if (last) {
                buffers[streamNumber].finished = true;
            }
            sendUntilExhausted()
        },
        done: function(streamNumber) {
            buffers[streamNumber].finished = true;
            sendUntilExhausted()
            doneIfDone()
        },
    }
};
