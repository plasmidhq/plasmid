define(function(require, exports, module) {

    exports.noop = function noop(){};

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
});
