var promise = require('./promise.js')
,   Promise = promise.Promise
,   EventListener = promise.EventListener
,   Results = require('./plasmid.results.js').Results
,   util = require('./plasmid.utilities.js')
;

/* LocalStore
 *
 * Provides common helpers to work with data in an IndexedDB store
 */
var LocalStore = function LocalStore(db, storename, options) {
    if (arguments.length > 0) {
        var options = options || {};
        this.db = db;
        this.storename = storename;
        this.options = options;

        if (options.extensions) {
            for (var i=0; i < options.extensions.length; i++) {
                var ext = options.extensions[i];
                ext.extendStore(this);
            }
        }
    } else {
        // I am a prototype
    }
};
LocalStore.prototype = new EventListener();

LocalStore.prototype.toString = function() {
    return "<LocalStore " + this.storename + ">";
};

LocalStore.prototype.setAtPath = function(obj, path, value) {
    var path_parts = path.split('.');
    var seg;
    while (path_parts.length > 1) {
        seg = path_parts.splice(0, 1)[0];
        if (typeof obj[seg] === 'undefined') {
            obj[seg] = {};
        }
        obj = obj[seg];
    }
    obj[path_parts[0]] = value;
}

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

/* LocalStore.by(indexname)
 * Access the store through by an index
 */
LocalStore.prototype.by = function(indexname) {
    function Index(indexname) {
        this.indexname = indexname;
    }
    Index.prototype = this;
    return new Index(indexname);
};


/* LocalStore.walk()
 * triggers 'each' on each value in the store
 */
LocalStore.prototype.walk = function(filter) {
    var request = new Promise(this);
    var store = this;
    var idbstore = this.db._getIDBTrans(this.storename)
        .objectStore(this.storename);
    var idbreq
    ,   range = null
    ,   order = IDBCursor.NEXT
    ,   index = 0
    ;

    var source = idbstore;
    if (this.indexname) {
        source = idbstore.index(this.indexname);
    }

    if (!!filter) {
        /*
        All keys ≤ x    IDBKeyRange.upperBound(x)
        All keys < x    IDBKeyRange.upperBound(x, true)
        All keys ≥ y    IDBKeyRange.lowerBound(y)
        All keys > y    IDBKeyRange.lowerBound(y, true)
        All keys ≥ x && ≤ y     IDBKeyRange.bound(x, y)
        All keys > x &&< y  IDBKeyRange.bound(x, y, true, true)
        All keys > x && ≤ y     IDBKeyRange.bound(x, y, true, false)
        All keys ≥ x &&< y  IDBKeyRange.bound(x, y, false, true)
        The key = z     IDBKeyRange.only(z)

        {gt: X}
        {gte: X}
        {lt: X}
        {lte: X}
        {gt: X, lt: Y}
        {gt: X, lte: Y}
        {gte: X, lt: Y}
        {gte: X, lte: Y}

        */
        var low = filter.gt || filter.gte;
        var high = filter.lt || filter.lte;
        if (low && high) {
            range = IDBKeyRange.bound(
                low, high,
                typeof filter.gt !== 'undefined',
                typeof filter.lt !== 'undefined'
            );
        } else if (high) {
            range = IDBKeyRange.upperBound(high, typeof filter.lt !== 'undefined');
        } else if (low) {
            range = IDBKeyRange.lowerBound(low, typeof filter.gt !== 'undefined');
        } else if (typeof filter !== 'object') {
            range = IDBKeyRange.only(filter);
        }

        if (filter.reverse) {
            order = IDBCursor.PREV || 'prev';
        }
    } else {
        filter = {};
    }
    filter.start = !!filter.start ? filter.start : 0;


    if (typeof order !== 'undefined') {
        idbreq = source.openCursor(range, order);
    } else {
        idbreq = source.openCursor(range);
    }

    idbreq.onsuccess = function(event) {
        var cursor = event.target.result;
        if (cursor) {
            if (index >= filter.start && index < filter.stop || !filter.stop) {
                request.trigger('each', cursor.value);
            }
            index++;
            cursor.continue();
        } else {
            request.ok();
        }
    };
    idbreq.onerror = function(event) {
        request.trigger('error');
    };
    return request;
};

LocalStore.prototype.fetch = function(filter) {
    var results = new Results(this.db, this.storename, this.indexname, filter);
    var promise = new Promise();

    this.walk.apply(this, arguments)
    .on('each', function(obj) {
        results.push(obj);
    })
    .then(function(){
        promise.ok(results);
    });

    return promise;
};

LocalStore.prototype._get_item = function(key) {
    var request = new Promise(this);

    var idbreq = this.db._getIDBTrans(this.storename)
        .objectStore(this.storename)
        .get(key);
    idbreq.onsuccess = function(event) {
        if (event.target.result) {
            request.trigger('success', event.target.result);
        } else {
            request.trigger('missing', JSON.stringify(key));
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
        value_request.ok(item);
    }).on('error', function(e) {
        value_request.trigger('error', e);
    }).on('missing', function() {
        value_request.trigger('missing', key);
    });
    return value_request;
};

/* Common helper for add/put methods */

LocalStore.prototype._set_item = function(action, value) {
    var request = new Promise(this);
    if (action !== 'put' && action !== 'add') {
        request.error("Action must be one of 'put' or 'add'");
    } else {
        var store = this;
        var key = util.random_token(16);
        var t = this.db._getIDBTrans([this.storename], "readwrite");
        var idbstore = t.objectStore(this.storename)
        var method = idbstore[action];

        util.defaults(value, {
            '_id': key,
            '_revision': 'queue',
        });

        store.trigger('preupdate', action, value);
        console.log(action, JSON.stringify(value));
        var idbreq = method.call(idbstore, value);
        idbreq.onsuccess = function(event) {
            if (event.target.result) {
                setTimeout(function(){
                    request.ok(value);
                    store.trigger('update', action, value);
                });
            } else {
                request.trigger('error', 'unknown');
            }
        };
        idbreq.onerror = function(event) {
            request.trigger('error', 'unknown');
        };
    }
    return request;
};

/* Add a new object to the store. Fails if the key already exists. */

LocalStore.prototype.add = function(value) {
    return this._set_item('add', value);
};

/* Put an object into the store. Overwrites the key if it already exists. */

LocalStore.prototype.put = function(value) {
    return this._set_item('put', value);
};

LocalStore.prototype.remove = function(key) {
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
