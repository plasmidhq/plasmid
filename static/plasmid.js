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

    // Store

    var Store = function Store(name, remote) {
        var store = this;
        this.name = name;
        this.remote = remote;
        this.transaction = null;

        var req = indexedDB.open(name);
        req.onerror = function(event) {
            store.trigger('openerror', event);
        };
        req.onsuccess = function(event) {
            var db = event.target.result;
            store._db = db;
            store.trigger('opensuccess')
        };
        req.onupgradeneeded = function(event) {
            console.log('Setting up plasmid store...')
            var db = event.target.result;
            store._db = db;

            // Data storage
            var idbstore = db.createObjectStore('localsync', {keyPath: 'key'});
            idbstore.createIndex('revision', 'revision', {unique: false});

            // Meta storage
            var metastore = db.createObjectStore('meta', {keyPath: 'property'});
            metastore.createIndex('property', 'property', {unique: true});

            metastore.add({property: "last_revision", value: 1});
            metastore.add({property: "plasmid_schema_version", value: 1});
            metastore.add({property: "remote_url", value: remote});

            store._meta = metastore;

            console.log('Plasmid store established.');
        };
    };
    Store.prototype = new EventListener();

    Store.clone = function(name, url) {
        // Clone a remote URL into a new, local store
    };

    Store.prototype.meta = function(key, value) {
        var request = new Request(this);
        var store = this;
        if (typeof value === 'undefined') {
            var idbreq = this._db.transaction(['meta'])
                .objectStore('meta')
                .get(key);
            idbreq.onsuccess = function(event) {
                if (event.target.result) {
                    request.trigger('success', event.target.result.value);
                } else {
                    request.trigger('missing', key);
                }
            };
            idbreq.onerror = function(event) {
                request.trigger('error');
            }
        } else {
            var idbreq = this._db.transaction(['meta'], 'readwrite')
                .objectStore('meta')
                .put({
                    property: key,
                    value: value
                });
        }
        return request
    };

    Store.prototype._queued = function() {
        var request = new Request(this);
        var store = this;
        var idbreq = this._db.transaction('localsync')
            .objectStore('localsync')
            .openCursor();
        var results = []
        idbreq.onsuccess = function(event) {
            var cursor = event.target.result;
            if (cursor) {
                if (!cursor.value.revision) {
                    results.push(cursor.value);
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

    Store.prototype.pull = function() {
        // Pull the latest updates from the remote sync service
        // Triggers a 'conflict' event on the store for every conflicting item
        // Triggers a 'update' event on every item changed by the operation
        // Triggers a 'pullsuccess' event on the store when the operation completes
        var store = this;
        var httpreq = new XMLHttpRequest();
        var url;
        this.meta('last_revision')
        .then(function(last_revision) {
            url = this.remote + 'update/' + last_revision;
            httpreq.onreadystatechange = parse_json;
            httpreq.open('GET', url);
            httpreq.send(null);
        });

        function parse_json() {
            if (httpreq.readyState === 4) {
                if (httpreq.status === 200) {
                    var data = JSON.parse(httpreq.responseText);
                    var updates = data.updates;
                    function next() {
                        var r;
                        if (updates.length > 0) {
                            r = updates.shift();
                            store.trigger('pulldata', r[0], r[1], r[2], next);
                        }
                        return r
                    }
                    next();
                } else {
                    console.error('There was a problem with the request.');
                }
            }
        }
    };
    Store.prototype.onpulldata = function(revision, key, value, next) {
        this.put(key, value, revision)
            .then(function(){
                this.meta('last_revision', revision).then(next);
            })
            .error(function(){
                console.error(arguments);
            })
            ;
    };

    Store.prototype.push = function() {
        var httpreq = new XMLHttpRequest();
        var url;
        this.meta('last_revision')
        .then(function(last_revision) {
            url = this.remote + 'update/';
            this._queued()
            .then(function(queued) {
                var req_body = {
                    last_revision: last_revision 
                };
                req_body.data = {}
                for (var i=0; i<queued.length; i++) {
                    var q = queued[i];
                    req_body.data[q.key] = q.value;
                }
                httpreq.onreadystatechange = handle_post;
                httpreq.open('POST', url);
                httpreq.send(JSON.stringify(req_body));
            })
        });

        function handle_post() {
            if (httpreq.readyState === 4) {
                if (httpreq.status === 200) {
                    console.log(httpreq.responseText);
                } else {
                    console.error('There was a problem with the request.');
                }
            }
        }
    };

    Store.prototype.get = function(key) {
        var request = new Request(this);

        var idbreq = this._db.transaction('localsync')
            .objectStore('localsync')
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

    Store.prototype.walk = function(match) {
        
    };

    Store.prototype.add = function(key, value) {
        var request = new Request(this);
        var t = this._db.transaction(['localsync'], "readwrite");
        var idbreq = t.objectStore('localsync').add({
            key: key,
            value: value,
            revision: null
        });
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

    Store.prototype.put = function(key, value, _revision) {
        var request = new Request(this);
        var t = this._db.transaction(['localsync'], "readwrite");
        var idbreq = t.objectStore('localsync').put({
            key: key,
            value: value,
            revision: _revision||null
        });
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

    Store.prototype.delete = function(object) {
    };

    // Exports

    plasmid.Store = Store;
    plasmid.Request = Request;

})(plasmid);
