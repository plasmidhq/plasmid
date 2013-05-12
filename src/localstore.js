define(function(require, exports, module) {

    var promise = require('promise')
    ,   Promise = promise.Promise
    ,   EventListener = promise.EventListener
    ,   util = require('utilities')
    ;

    // Local IndexedDB Store Helper
    // Local IndexedDB Store Helper

    /* LocalStore
     *
     * Provides common helpers to work with data in an IndexedDB store
     */
    var LocalStore = function LocalStore(options) {
        var options = options || {};
        this.db = options.db;
        this.storename = options.storename;
    };
    LocalStore.prototype = new EventListener();

    /* LocalStore.count()
     * success result is the number of objects in the store
     */
    LocalStore.prototype.count = function() {
        var promise = new Promise(this);
        var idbstore = this.db._getIDBTrans(this.storename)
            .objectStore(this.storename);
        var idbreq = idbstore.count();
        idbreq.onsuccess = function(event) {
            promise.ok(event.target.result);
        };
        idbreq.onerror = function() {
            promise.error();
        };
        return promise;
    };

    /* LocalStore.walk()
     * triggers 'each' on each value in the store
     */
    LocalStore.prototype.walk = function(indexname) {
        var request = new Promise(this);
        var store = this;
        var idbstore = this.db._getIDBTrans(this.storename)
            .objectStore(this.storename);
        var results = []
        var idbreq;
        if (indexname) {
            idbreq = idbstore.index(indexname).openCursor();
        } else {
            idbreq = idbstore.openCursor();
        }
        idbreq.onsuccess = function(event) {
            var cursor = event.target.result;
            if (cursor) {
                results.push(cursor.value);
                request.trigger('each', cursor.value);
                cursor.continue();
            } else {
                request.trigger('success', results);
            }
        };
        idbreq.onerror = function(event) {
            request.trigger('error');
        };
        return request;
    }

    LocalStore.prototype._get_item = function(key) {
        var request = new Promise(this);

        var idbreq = this.db._getIDBTrans(this.storename)
            .objectStore(this.storename)
            .get(key);
        idbreq.onsuccess = function(event) {
            if (event.target.result) {
                request.trigger('success', event.target.result);
            } else {
                request.trigger('missing', key);
            }
        };
        idbreq.onerror = function(event) {
            request.trigger('error', 'unknown');
        }

        return request;
    };

    LocalStore.prototype.get = function(key) {
        var item_request = this._get_item(key);
        var value_request = new Promise(this);
        item_request.then(function(item) {
            value_request.ok(item.value);
        }).on('error', function(e) {
            value_request.trigger('error', e);
        }).on('missing', function() {
            value_request.trigger('missing', key);   
        });
        return value_request;
    };

    LocalStore.prototype.add = function(key, value) {
        var store = this;
        var request = new Promise(this);
        var t = this.db._getIDBTrans([this.storename], "readwrite");
        var idbreq = t.objectStore(this.storename).add({
            key: key,
            value: value,
            revision: null
        });
        idbreq.onsuccess = function(event) {
            if (event.target.result) {
                request.trigger('success', event.target.result.value);
                store.trigger('update', key, event.target.result.value);
            } else {
                request.trigger('missing', key);
            }
        };
        idbreq.onerror = function(event) {
            request.trigger('error', 'unknown');
        };
        return request;
    };
    LocalStore.prototype.put = function(key, value, _revision) {
        var store = this;
        var autopush = this.autopush;
        var request = new Promise(this);
        var t = this.db._getIDBTrans([this.storename], "readwrite");
        var key = (key===null) ? util.random_token(16) : key;
        var idbreq = t.objectStore(this.storename).put({
            key: key,
            value: value,
            revision: _revision||"queue"
        });
        idbreq.onsuccess = function(event) {
            if (event.target.result) {
                request.trigger('success', key, event.target.result.value);
                store.trigger('update', key, event.target.result.value);
            } else {
                request.trigger('missing', key);
            }
        };
        idbreq.onerror = function(event) {
            request.trigger('error', 'unknown');
        };
        return request;
    };
    LocalStore.prototype.putmany = function(many) {
        var store = this;
        var autopush = this.autopush;
        var request = new Promise(this);
        var t = this.db._getIDBTrans([this.storename], "readwrite");

        function put_next() {
            if (many.length === 0) {
                request.trigger('success');
            } else {
                var next = many.pop();
                var key = (next.key===null) ? util.random_token(16) : next.key;
                var idbreq = t.objectStore(store.storename).put({
                    key: key,
                    value: next.value,
                    revision: null
                });
                idbreq.onsuccess = function(event) {
                    if (event.target.result) {
                        put_next();
                        store.trigger('update', key, event.target.result.value);
                    } else {
                        request.trigger('missing', key);
                    }
                };
                idbreq.onerror = function(event) {
                    request.trigger('error', 'unknown');
                };
            }
        }

        put_next();

        return request;
    };

    LocalStore.prototype._remove = function(key) {
        var store = this;
        var request = new Promise(this);
        var t = this.db._getIDBTrans([this.storename], "readwrite");
        var idbreq = t.objectStore(this.storename).remove(key);
        idbreq.onsuccess = function(event) {
            if (event.target.result) {
                request.trigger('success', event.target.result.value);
            } else {
                request.trigger('missing', key);
            }
        };
        idbreq.onerror = function(event) {
            request.trigger('error', 'unknown');
        };
        return request;
    };

    exports.LocalStore = LocalStore;
});