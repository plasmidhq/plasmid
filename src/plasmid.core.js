define(function(require, exports, module) {

    var Base64 = require('base64')
    ,   JSONSCA = require('jsonsca')
    ,   promise = require('promise')
    ,   Promise = promise.Promise
    ,   EventListener = promise.EventListener

    ,   Database = require('plasmid.database').Database
    ,   LocalStore = require('plasmid.localstore').LocalStore
    ,   SyncStore = require('plasmid.syncstore').SyncStore
    ,   util = require('plasmid.utilities')
    ;

    window.indexedDB = window.indexedDB || window.mozIndexedDB || window.webkitIndexedDB || window.msIndexedDB;

    /* Utilities
     */


    // Access token API

    // A note on wording.
    //
    // There are two kinds of "tokens" involved: an "access token"
    // and a "secret token". Together, the pair are called "credentials".
    // Credentials without a secret are "Incomplete Credentials".

    var Credentials = function(options) {
        this.options = options || {};
        this.access = this.options.access;
        this.secret = this.options.secret;
        this.credentials = this.options.credentials;
    }
    Credentials.prototype = new EventListener();

    Credentials.prototype.self_cred = function() {
        this.credentials = this;
    };

    Credentials.prototype.complete = function() {
        return !!this.secret;
    };

    Credentials.prototype.list = function() {
        var o = this.options;
        var p = util.http('get', o.api + 'a/' + this.access, null, this.credentials||this);
        p.then(function(resp) {
            promise.ok(resp.permissions);
        });
        var promise = new Promise();
        return promise;
    };

    Credentials.prototype.grant = function(resource, permission, value) {
        var self = this;
        var o = this.options;
        if (resource instanceof Database) {
            reource = resource.name;
        }

        body = {
            permission: permission
        ,   resource: resource
        ,   value: value
        }
        util.http('post', o.api + 'a/' + this.access, body, this.credentials)
        .then(function(data) {
            if (data.error) {
                promise.trigger('error', data.error);
            } else {
                promise.ok();
            }
        });
        var promise = new Promise();
        return promise;
    };

    Credentials.prototype.create = function(type) {
        var self = this;
        var o = this.options;
        var body = {
            'access': this.access,
            'secret': this.secret,
            'type': type,
        };
        var p = util.http('post', o.api + 'a/', body, this.credentials);
        p.then(function(data) {
            if (data.success) {
                var access = data.success.access;
                var secret = data.success.secret;
                self.access = access;
                self.secret = secret;
                promise.ok(data.success);
            } else {
                promise.error(data.error);
            }
        });
        var promise = new Promise(this);
        return promise;
    };

    // Exports

    exports.Credentials = Credentials;
    exports.Database = Database;
    exports.LocalStore = LocalStore;
    exports.SyncStore = SyncStore;
    exports.EventListener = EventListener;
    exports.Promise = Promise;
    exports.http = util.http;

});
