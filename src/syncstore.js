define(function(require, exports, module) {

    var Promise = require('promise').Promise
    ,   LocalStore = require('localstore').LocalStore
    ;

    // SyncStore

    var SyncStore = function SyncStore(options) {
        LocalStore.apply(this, arguments);

        var store = this;

        this.options = options || {};
        this.dbname = options.db.name;
        this.storename = options.storename;
        this.autopush = options.autopush || false;

    };
    SyncStore.prototype = new LocalStore();

    SyncStore.clone = function(name, url) {
        // Clone a remote URL into a new, local store
    };

    SyncStore.prototype.onupdate = function() {
        //this.push();
    }

    SyncStore.prototype.resolve = function(e, key, local, remote) {

        var resolve_puts = [];
        function put(key, value) {
            resolve_puts.push([key, value]);
        }

        // Allow conflict event handles to resolve the conflict first
        this.trigger('conflict', put, key, local, remote);

        // If the resolution put any objects,
        // save those instead of the current value
        if (resolve_puts.length > 0) {
            var steps = [];
            this._remove(key)
            .then(function() {
                while (resolve_puts.length > 0) {
                    var n = resolve_puts.shift();
                    steps.push(this.store.put(n[0], n[1]));
                }
                plasmid.Promise.chain(steps)
                .then(function(){
                    this.db.meta.put('last_revision', revision).then(next);
                });
            });
        } else {
            // Default, keep the remote value...
            console.log('keep', key, remote);
            this.put(key, remote)
            .then(function(){
                this.db.meta.put('last_revision', revision).then(next);
            });
        }
    };

    SyncStore.prototype._queued = function() {
        var request = new Promise(this);
        var store = this;
        var idbreq = this.db._getIDBTrans(this.storename)
            .objectStore(this.storename)
            .openCursor();
        var results = []
        idbreq.onsuccess = function(event) {
            var cursor = event.target.result;
            var value;
            var error = null;
            if (cursor) {
                try {
                    value = cursor.value;
                } catch (error) {
                    console.error("Could not clone data from IndexedDB! For key "+cursor.key+" in store "+this.storename);
                }
                if (error !== null) {
                    console.error(!error);
                } else {
                    if (cursor.value.revision === 'queue') {
                        results.push([store.storename, cursor.value]);
                        request.trigger('each', cursor.value);
                    }
                }
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

    exports.SyncStore = SyncStore;
});
