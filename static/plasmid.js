var plasmid = {};
(function(plasmid) {

    var _;

    window.indexedDB = window.indexedDB || window.mozIndexedDB || window.webkitIndexedDB || window.msIndexedDB;

    // Request and Event Helper
    
    function EventListener() {}
    EventListener.prototype.trigger = function(type, args) {
        if (arguments.length > 2) {
            var args = Array.prototype.slice.call(arguments, 1);
        } else if (arguments.length == 2) {
            var args = [args];
        } else {
            var args = [];
        }
        var handler = this['on' + type];
        var event = new Event(type, this.target, args);
        if (!!handler) {
            handler.apply(this.target||this, args);
        }
    };
    EventListener.prototype.on = function(eventname, handler) {
        this['on' + eventname] = handler;
        return this;
    };
    EventListener.prototype.then = function(handler) {
        return this.on('success', handler);
    };
    EventListener.prototype.error = function(handler) {
        return this.on('error', handler);
    };
    EventListener.prototype.onerror = function() {
        console.error('Unhandled error', arguments);
    };
    
    function Event(eventname, target, data) {
        this.type = eventname;
        this.target = target;
        this.data = data;
    };
    
    function Request(target) {
        this.target = target; 
    };
    Request.prototype = new EventListener();

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
        /* LocalStore.all()
         * triggers 'each' on each value in the store
         */
    LocalStore.prototype.all = function() {
        var request = new Request(this);
        var store = this;
        var idbreq = this.db.idb.transaction(this.storename)
            .objectStore(this.storename)
            .openCursor();
        var results = []
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
    LocalStore.prototype.get = function(key) {
        var request = new Request(this);

        var idbreq = this.db.idb.transaction(this.storename)
            .objectStore(this.storename)
            .get(key);
        idbreq.onsuccess = function(event) {
            if (event.target.result) {
                request.trigger('success', event.target.result.value);
            } else {
                request.trigger('missing', key);
            }
        };
        idbreq.onerror = function(event) {
            request.trigger('error', 'unknown');
        }

        return request;
    };
    LocalStore.prototype.add = function(key, value) {
        var store = this;
        var request = new Request(this);
        var t = this.db.idb.transaction([this.storename], "readwrite");
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
        var request = new Request(this);
        var t = this.db.idb.transaction([this.storename], "readwrite");
        var idbreq = t.objectStore(this.storename).put({
            key: key,
            value: value,
            revision: _revision||null
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
    
    var Database = function Database(options) {
        this.options = options;
        this.transaction = null;
        this.name = options.name;
        this.api = options.api;
        var remote = options.remote || (this.remote = options.api + options.name + '/');

        var db = this;
        db.stores = {};
        var req = indexedDB.open(this.name, options.schema.version);

        req.onerror = function(event) {
            db.trigger('openerror', event);
        };
        req.onsuccess = function(event) {
            db.idb = event.target.result;

            var st;
            for (storename in options.schema.stores) {
                st = options.schema.stores[storename].sync ? SyncStore : LocalStore;
                db.stores[storename] = new st({
                    db: db,
                    storename: storename,
                });
            }

            db.trigger('opensuccess')
        };
        req.onupgradeneeded = function(event) {
            console.log('Setting up plasmid store...')
            var db = event.target.result;
            db.idb = db;

            // Meta storage
            if (!db.objectStoreNames.contains('meta')) {
                var metastore = db.createObjectStore('meta', {keyPath: 'key'});
                metastore.createIndex('key', 'key', {unique: true});

                metastore.add({key: "last_revision", value: 1});
                metastore.add({key: "plasmid_schema_version", value: 1});
                metastore.add({key: "remote_url", value: remote});
            }

            // Data storage
            for (storename in options.schema.stores) {
                if (!db.objectStoreNames.contains(storename)) {
                    var idbstore = db.createObjectStore(storename, {keyPath: 'key'});
                    idbstore.createIndex('revision', 'revision', {unique: false});
                }
            }

            console.log('Plasmid store established.');
        };

        this.meta = new LocalStore({
            db: this
        ,   storename: 'meta'
        });
        this.stores.meta = this.meta;
    };
    Database.prototype = new EventListener();

    Database.prototype.sync = function() {
        var request = new Request();
        var database = this;
        attempt();

        return request;

        function attempt() {
            database.push().on('error', function(reason) {
                if (reason === 'outofdate') {
                    database.pull().then(attempt);
                } else {
                    request.trigger('error', reason);
                }
            }).then(function() {
                request.trigger('success');   
            });
        }
    };

    Database.prototype.pull = function() {
        // Pull the latest updates from the remote sync service
        // Triggers a 'conflict' event on the store for every conflicting item
        // Triggers a 'update' event on every item changed by the operation
        // Triggers a 'pullsuccess' event on the store when the operation completes
        var database = this;
        var httpreq = new XMLHttpRequest();
        var remote = this.remote;
        var url;
        this.meta.get('last_revision')
        .then(function(last_revision) {
            url = remote + 'update/' + last_revision;
            httpreq.onreadystatechange = parse_json;
            httpreq.open('GET', url);
            httpreq.send(null);
        });

        var request = new Request();
        return request;

        function parse_json() {
            if (httpreq.readyState === 4) {
                if (httpreq.status === 200) {
                    var data = JSON.parse(httpreq.responseText);
                    var updates = data.updates;
                    if (updates.length > 0) {
                        function next() {
                            var r;
                            if (updates.length > 0) {
                                r = updates.shift();
                                var storename = r.shift();
                                var revision = r.shift();
                                var key = r.shift();
                                var value = r.shift();

                                database.stores[storename].put(key, value, revision)
                                    .then(function(){
                                        database.meta.put('last_revision', revision).then(next);
                                    })
                                    .error(function(){
                                        console.error(arguments);
                                    })
                                ;
                            } else {
                                r = null;
                            }
                            return r
                        }
                        next();
                    } else {
                        database.meta.put('last_revision', data.until);
                    }
                    request.trigger('success') 
                } else {
                    console.error('There was a problem with the request.');
                }
            }
        }
    };

    Database.prototype.push = function() {
        var database = this;
        var httpreq = new XMLHttpRequest();
        var url = database.remote + 'update/';
        var last_revision;
        var sync_stores = [];
        for (storename in this.options.schema.stores) {
            if (this.options.schema.stores[storename].sync) {
                sync_stores.push(storename);
            }
        }

        this.meta.get('last_revision')
        .then(function(v) {
            last_revision = v;
            collect_next_store_queue();
        });

        var db_queued = [];
        function collect_next_store_queue() {
            var store = database.stores[sync_stores.shift()];
            store._queued()
            .then(function(store_queued){
                while (store_queued.length > 0) {
                    db_queued.push(store_queued.pop());
                }
                if (sync_stores.length > 0) {
                    collect_next_store_queue();
                } else {
                    send_queued();
                }
            });
        }
    
        function send_queued() {
            var req_body = {
                last_revision: last_revision 
            };
            req_body.data = {}
            for (var i=0; i<db_queued.length; i++) {
                var q = db_queued[i];
                var store = q[0];
                var obj = q[1];
                if (typeof req_body.data[store] === 'undefined') {
                    req_body.data[store] = {};
                }
                req_body.data[store][obj.key] = obj.value;
            }
            httpreq.onreadystatechange = handle_post;
            httpreq.open('POST', url);
            httpreq.send(JSON.stringify(req_body));
        }

        var request = new Request();
        return request;

        function handle_post() {
            if (httpreq.readyState === 4) {
                if (httpreq.status === 200) {
                    var data = JSON.parse(httpreq.responseText);
                    if (!data.error) {
                        database.trigger('push');
                        request.trigger('success');
                    } else {
                        if (data.reason == 'outofdate') {
                            request.trigger('error', data.reason);
                        }
                    }
                } else {
                    console.error('There was a problem with the request.');
                }
            }
        }
    };

    // SyncStore

    var SyncStore = function SyncStore(options) {
        LocalStore.apply(this, arguments);

        var store = this;

        this.options = options || {};
        this.dbname = options.db.name;
        this.storename = options.storename;
        this.autopush = options.autopush || false;

        this.transaction = null;
    };
    SyncStore.prototype = new LocalStore();

    SyncStore.clone = function(name, url) {
        // Clone a remote URL into a new, local store
    };

    SyncStore.prototype.onupdate = function() {
        //this.push();
    }

    SyncStore.prototype._queued = function() {
        var request = new Request(this);
        var store = this;
        var idbreq = this.db.idb.transaction(this.storename)
            .objectStore(this.storename)
            .openCursor();
        var results = []
        idbreq.onsuccess = function(event) {
            var cursor = event.target.result;
            if (cursor) {
                if (!cursor.value.revision) {
                    results.push([store.storename, cursor.value]);
                    request.trigger('each', cursor.value);
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

    // Exports

    plasmid.Database = Database;
    plasmid.LocalStore = LocalStore;
    plasmid.SyncStore = SyncStore;
    plasmid.Request = Request;

})(plasmid);
