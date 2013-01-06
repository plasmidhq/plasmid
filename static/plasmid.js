var plasmid = {};
(function(plasmid) {

    var _;

    window.indexedDB = window.indexedDB || window.mozIndexedDB || window.webkitIndexedDB || window.msIndexedDB;

    /* Utilities
     */

    function noop(){};

    function bind(ctx) {
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

    function http(method, url, body, access, secret) {
        var httpreq = new XMLHttpRequest();
        httpreq.onreadystatechange = statechange;
        httpreq.open(method, url);
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

    // Promise and Event Helper
    
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
        } else {
            if (typeof this.__eventqueue === 'undefined') {
                this.__eventqueue = {};
            }
            if (typeof this.__eventqueue[type] === 'undefined') {
                this.__eventqueue[type] = [];
            }
            this.__eventqueue[type].push(args);
        }
    };
    EventListener.prototype.on = function(eventname, handler) {
        this['on' + eventname] = handler;
        while (this.__eventqueue && this.__eventqueue[eventname] && this.__eventqueue[eventname].length > 0) {
            var args = this.__eventqueue[eventname].pop(0);
            args.splice(0, 0, eventname);
            this.trigger.apply(this, args);
        }
        return this;
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
    
    function Promise(target) {
        this.target = target; 
    };
    Promise.prototype = new EventListener();

    Promise.prototype.then = function(handler) {
        return this.on('success', handler);
    };
    Promise.prototype.ok = function(result) {
        this.result = result;
        this.trigger('success', result);
    };
    Promise.prototype.chain = function(promises, doneevent) {
        var self = this;
        var waiting = promises.length;
        var i;
        var results = [];
        for (i = 0; i < promises.length; i++) {
            if (promises[i].hasOwnProperty('result')) {
                waiting = waiting - 1;
                results[i] = promises[i].result;
            } else {
                promises[i].__chainoriginalsuccess = promises[i].onsuccess;
                promises[i].then(create_result_handler(i));
                promises[i].on('error', cancel);
            }
        }
        if (waiting === 0) {
            self.trigger(doneevent||'success', results);
        }

        return this;

        function cancel() {
            self.error();
        };

        function create_result_handler(i) {
            function one_done(result) {
                results[i] = result;
                waiting = waiting - 1;
                (promises[i].__chainoriginalsuccess||noop)(result);
                if (waiting === 0) {
                    self.trigger(doneevent||'success', results);
                }
            }
            return one_done;
        }
    };

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

    /* LocalStore.walk()
     * triggers 'each' on each value in the store
     */
    LocalStore.prototype.walk = function(indexname) {
        var request = new Promise(this);
        var store = this;
        var idbstore = this.db.idb.transaction(this.storename)
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

    LocalStore.prototype.get = function(key) {
        var request = new Promise(this);

        var idbreq = this.db.idb.transaction(this.storename)
            .objectStore(this.storename)
            .get(key);
        idbreq.onsuccess = function(event) {
            if (event.target.result) {
                request.trigger('__gotraw__', event.target.result);
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
        var request = new Promise(this);
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
        var request = new Promise(this);
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
        var remote = options.remote || (this.remote = options.api + 'd/' + options.name + '/');

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

            if (options.autoSync) {
                db.autoSync(options.autoSync);
            }

            db.trigger('opensuccess')
        };
        req.onupgradeneeded = function(event) {
            var db = event.target.result;
            var txn = event.target.transaction;
            var storename, indexname, idbstore, indexopt;

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
                } else {
                    idbstore = txn.objectStore(storename);
                }
                for (indexname in options.schema.stores[storename].indexes) {
                    indexopt = options.schema.stores[storename].indexes[indexname];
                    if (indexopt) {
                        idbstore.createIndex(indexname, "value." + indexopt.key,
                            {unique: indexopt.unique, multi: indexopt.multi}
                        );
                    }
                }
            }
        };

        this.meta = new LocalStore({
            db: this
        ,   storename: 'meta'
        });
        this.stores.meta = this.meta;
    };
    Database.prototype = new EventListener();

    Database.prototype.http = function(method, url, body) {
        return http(method, url, body, this.options.access, this.options.secret);
    };

    Database.prototype.autoSync = function(interval) {
        this.autoSyncIntervalTime = interval;
        if (!!this.autoSyncInterval) {
            window.clearInterval(this.autoSyncInterval);
        }
        if (!!interval) {
            this.autoSyncInterval = window.setInterval(do_auto_sync, this.autoSyncIntervalTime);
        }

        var database = this;
        function do_auto_sync() {
            try {
                database.sync();
            } catch (e) {
                console.error("auto sync error: " + e);
            }
        }
    };

    Database.prototype.sync = function() {
        var request = new Promise();
        var database = this;
        if (!!database.syncing) {
            return database.syncing;
        }
        database.syncing = request;
        attempt();

        return request;

        function attempt() {
            database.push().on('error', function(reason) {
                if (reason === 'outofdate') {
                    database.pull().then(attempt);
                } else {
                    request.trigger('error', reason);
                    database.syncing = null;
                }
            }).then(function() {
                request.trigger('success');   
                database.syncing = null;
            });
        }
    };

    Database.prototype.pull = function() {
        // Pull the latest updates from the remote sync service
        // Triggers a 'conflict' event on the store for every conflicting item
        // Triggers a 'update' event on every item changed by the operation
        // Triggers a 'pullsuccess' event on the store when the operation completes
        var database = this;
        var httpreq;
        var remote = this.remote;
        var url;
        this.meta.get('last_revision')
        .then(function(last_revision) {
            url = remote + 'update/' + last_revision;
            httpreq = database.http('GET', url);
            httpreq.then(parse_json);
        });

        var request = new Promise();
        return request;

        function parse_json(data) {
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

                        value = JSONSCA.unpack(value);
                        console.log('pulled data', key, value);

                        function set_value() {
                            database.stores[storename].put(key, value, revision)
                                .then(function(){
                                    console.log('saved');
                                    database.meta.put('last_revision', revision).then(next);
                                })
                                .error(function(){
                                    console.log('error');
                                    console.error(arguments);
                                })
                            ;
                        }

                        // Discover potential conflict
                        database.stores[storename].get(key)
                            .on('__gotraw__', function(obj) {
                                if (obj.revision === null) {
                                    // conflict!
                                    request.trigger('conflict', key, obj.value, value)
                                }
                                set_value();
                            }).on('missing', set_value);
                        ;
                    } else {
                        r = null;
                        database.trigger('updated');
                    }
                    return r
                }
                next();
            } else {
                database.meta.put('last_revision', data.until);
            }
            request.trigger('success');
        }
    };

    Database.prototype.push = function() {
        var database = this;
        var httpreq;
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

        // Get all the unsent (queued) objects from all stores

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
                    pack_next();
                }
            });
        }

        // JSON/SCA pack the data
        var pack_i = -1;
        function pack_next() {
            pack_i++;
            if (pack_i + 1 <= db_queued.length) {
                JSONSCA.pack(db_queued[pack_i][1].value).then(function(packed) {
                    db_queued[pack_i][1].value = packed;
                    pack_next();
                });
            } else {
                send_queued();
            }
        }

        // Send all queued objects to the sync server
    
        var req_body;
        function send_queued() {
            req_body = {
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
            database.http('POST', url, req_body).then(handle_post);
        }

        var request = new Promise();
        return request;

        function handle_post(data) {
            if (!data.error) {
                // Update the revision for the saved objects.
                function update_next_obj() {
                    var next = db_queued.pop();
                    if (!!next) {
                        var store = next[0];
                        var obj = next[1];
                        var value = JSONSCA.unpack(obj.value);
                        database.stores[store].put(obj.key, value, data.revision).then(
                        function() {
                            if (db_queued.length > 0) {
                                update_next_obj();
                            } else {
                                finish();
                            }
                        });
                    } else {
                        finish();
                    }
                }
                function finish() {
                    database.meta.put('last_revision', data.revision).then(function() {
                        database.trigger('push');
                        request.trigger('success');
                    });
                }
                update_next_obj();
            } else {
                if (data.reason == 'outofdate') {
                    request.trigger('error', data.reason);
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
        var request = new Promise(this);
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
    plasmid.Promise = Promise;

    plasmid.http = http;

})(plasmid);
