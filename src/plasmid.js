define(function(require, exports, module) {

    var Base64 = require('base64')
    ,   JSONSCA = require('jsonsca')
    ,   promise = require('promise')
    ,   Promise = promise.Promise
    ,   EventListener = promise.EventListener
    ;

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

    random_token = function(size) {
        var alphanum = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuv0123456789";
        var chars = [];
        while (size > 0) {
            chars.push(alphanum[parseInt(Math.random() * alphanum.length)]);
            size--;
        }
        return chars.join('');
    };

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
        var p = http('get', o.api + 'a/' + this.access, null, this.credentials||this);
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
        http('post', o.api + 'a/' + this.access, body, this.credentials)
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
        var p = http('post', o.api + 'a/', body, this.credentials);
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
        var key = (key===null) ? random_token(16) : key;
        var idbreq = t.objectStore(this.storename).put({
            key: key,
            value: value,
            revision: _revision||"queue"
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
                var key = (next.key===null) ? random_token(16) : next.key;
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
        var key = (key===null) ? random_token(16) : key;
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
    
    var Database = function Database(options) {
        this.options = options;
        this.credentials = options.credentials;
        this.name = options.name;
        this.api = options.api;
        this.localname = options.localname || options.name;
        this.remotename = options.remotename || null;

        var db = this;
        db.stores = {};
        var st;
        for (storename in options.schema.stores) {
            st = options.schema.stores[storename].sync ? SyncStore : LocalStore;
            db.stores[storename] = new st({
                db: db,
                storename: storename,
            });
        }

        var req = indexedDB.open(this.localname, options.schema.version);

        req.onerror = function(event) {
            db.trigger('openerror', event);
        };
        req.onsuccess = function(event) {
            db.idb = event.target.result;


            if (options.autoSync) {
                db.autoSync(options.autoSync);
            }

            if (!db.remotename) {
                db.meta.get('remotename').then(set_remote);
            } else {
                set_remote(db.remotename);
            }

            function set_remote(remotename) {
                db.remotename = remotename;
            }
            db.trigger('opensuccess')
        };
        req.onupgradeneeded = function(event) {
            var idb = event.target.result;
            var txn = event.target.transaction;
            var storename, indexname, idbstore, indexopt;

            db.idb = idb;

            // Meta storage
            if (!idb.objectStoreNames.contains('meta')) {
                var metastore = idb.createObjectStore('meta', {keyPath: 'key'});
                metastore.createIndex('key', 'key', {unique: true});

                metastore.add({key: "last_revision", value: 1});
                metastore.add({key: "plasmid_schema_version", value: 1});
                metastore.add({key: "remote_url", value: db._getRemoteEndpoint()});
            }

            // Data storage
            for (storename in options.schema.stores) {
                if (!idb.objectStoreNames.contains(storename)) {
                    var idbstore = idb.createObjectStore(storename, {keyPath: 'key'});
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

    Database.prototype._getIDBTrans = function() {
        var idbt = this.idb.transaction.apply(this.idb, arguments);
        return idbt;
    };

    Database.prototype.transaction = function(stores, mode) {
        var idbt = this.idb.transaction(stores, mode);
        function TransactionFactory() {
            this.stores = {};

            this.abort = function() {
                idbt.abort();
            };

            this.commit = function() {
                // IndexedDB transactions only commit when
                // they are out of scope
                idbt = null;
            };

            this._getIDBTrans = function(stores, mode) {
                if (typeof stores === 'string') {
                    var stores = [stores];
                }
                if (stores.length == idbt.objectStoreNames.length) {
                    for (var i=0; i < stores.length; i++) {
                        if (stores[i] !== idbt.objectStoreNames[i]) {
                            // different stores
                            return Database.prototype._getIDBTrans.apply(this, arguments);
                        }
                    }
                    if (mode !== idbt.mode) {
                        return Database.prototype._getIDBTrans.apply(this, arguments);
                    }

                    // same stores, same mode, reuse transaction!
                    return idbt;
                }
            }

            for (var i=0; i < stores.length; i++) {
                this.stores[ stores[i] ] =
                    new LocalStore({
                        db: this,
                        storename: stores[i]
                    });
            }
        };
        TransactionFactory.prototype = this;
        var pt = new TransactionFactory();
        return pt;
    };

    Database.prototype._getRemoteEndpoint = function() {
        var remote = this.options.api + 'd/' + this.remotename + '/';
        return remote;
    };

    Database.prototype.setRemote = function(remotename) {
        var first_remote = (this.remotename === null);
        this.remotename = remotename;
        this.trigger('remotechanged', remotename);
        var promise = new Promise(this);
        this.meta.put('remotename', remotename)
            .then(function(){
                promise.ok();
            })
            .on('error', function(e) {
                promise.trigger('error', e);
            })
        ;
        return promise;
    };

    Database.prototype.http = function(method, url, body) {
        return http(method, url, body, this.credentials);
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
        var request = new Promise();
        var database = this;
        var httpreq;
        if (this.remotename === null) {
            request.trigger('error', 'noremote');
        } else {
            var remote = this._getRemoteEndpoint();
            var url;
            this.meta.get('last_revision')
            .then(function(last_revision) {
                url = remote + 'update/' + last_revision;
                httpreq = database.http('GET', url);
                httpreq.then(parse_json);
            });
        }

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
                        var store = database.stores[storename];

                        value = JSONSCA.unpack(value);

                        function set_value() {
                            store.put(key, value, revision)
                                .then(function(){
                                    database.meta.put('last_revision', revision).then(next);
                                })
                                .error(function(){
                                    console.error(arguments);
                                })
                            ;
                        }

                        // Discover potential conflict
                        store._get_item(key)
                            .then(function(obj) {
                                if (obj.revision === null) {
                                    // conflict!
                                    store.resolve(store, key, obj.value, value)
                                } else {
                                    set_value();
                                }
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
        var request = new Promise();
        if (this.remotename === null) {
            request.trigger('error', 'noremote');
            return request;
        }

        var database = this;
        var httpreq;
        var url = database._getRemoteEndpoint() + 'update/';
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
                if (data) {
                    request.trigger('error', data.reason);
                }
            }
        }
    };

    Database.prototype.drop = function() {
        var idbreq = indexedDB.deleteDatabase(this.localname);
        this.idb.close();
        idbreq.onsuccess = function(event) {
            promise.ok();
        };
        idbreq.onerror = function(event) {
            promise.trigger('error');
        };

        var promise = new Promise();
        return promise;
    };

    Database.prototype.reset = function() {
        var self = this;
        this.drop().then(recreate);
        function recreate() {
            Database.call(self, self.options);
        }
    };

    Database.prototype.forgetPushed = function() {
        var puts = [];
        for (storename in this.stores) {
            var store = this.stores[storename];
            store.walk().on('each', function(item){
                var pp = store.put(item.key, item.value, null);
                puts.push(pp);
            });
        }
        var promise = Promise.chain(puts);
        return promise;
    };

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

    // Exports

    exports.Credentials = Credentials;
    exports.Database = Database;
    exports.LocalStore = LocalStore;
    exports.SyncStore = SyncStore;
    exports.EventListener = EventListener;
    exports.Promise = Promise;
    exports.http = http;

});
