var plasmid = {};
(function(plasmid) {

    // Request and Event Helper
    
    function EventListener() {}
    EventListener.prototype.trigger = function(type, data) {
        var handler = this['on' + type];
        var event = new Event(type, this.target, data);
        if (!!handler) {
            handler.call(this, event, data);
        }
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

    Request.prototype.on = function(eventname, handler) {
        this['on' + eventname] = handler;
        return this;
    };
    Request.prototype.then = function(handler) {
        return this.on('success', handler);
    };
    Request.prototype.error = function(handler) {
        return this.on('error', handler);
    };

    // Store

    var Store = function Store(name) {
        console.log('Opening plasmid store...');
        var store = this;

        store.name = name;
        var req = indexedDB.open('plasmid');
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
            var idbstore = db.createObjectStore(store.name, {keyPath: 'key'});
            idbstore.createIndex('revision', 'revision', {unique: false});

            // Meta storage
            var metastore = db.createObjectStore(store.name + '__plasmid_meta', {keyPath: 'property'});
            metastore.createIndex('property', 'property', {unique: true});

            metastore.add({property: "last_revision", value: 1});
            metastore.add({property: "plasmid_schema_version", value: 1});

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
            var idbreq = this._db.transaction(this.name + '__plasmid_meta')
                .objectStore(this.name + '__plasmid_meta')
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
            var idbreq = this._db.transaction(this.name + '__plasmid_meta', 'readwrite')
                .objectStore(this.name + '__plasmid_meta')
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
        var idbreq = this._db.transaction(this.name)
            .objectStore(this.name)
            .openCursor();
        idbreq.onsuccess = function(event) {
            var cursor = event.target.result;
            if (cursor && typeof cursor.value.revision == 'undefined') {
                request.trigger('each', cursor.value);
                cursor.continue();
            } else {
                request.trigger('done');
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
        var httpreq = new XMLHttpRequest();
        var url;
        this.meta(function(error, last_revision) {
            url = api + this.name + '/update/' + last_revision;
            httpreq.onreadystatechange = process_pull_response;
            httpreq.open('GET', url);
            httpreq.send();
        }, 'last_revision');
        function process_pull_response() {
            console.log(httpreq, httpreq.status);
            if (httpreq.readyState === 4) {
                if (httpreq.status === 200) {
                    console.log(httpreq.responseText);
                } else {
                    console.log('There was a problem with the request.');
                }
            }
        }
    };

    Store.prototype.push = function() {
        // TODO: Totally fake. Make not fake.
        var store = this;
        this.meta(get_queued, 'last_revision');
        function get_queued(error, last_revision) {
            this._queued(function(error, queued) {
                for (var i=0; i<queued.length; i++) {
                    queued[i].revision = last_revision + 1;
                    var name = this.name;
                    var t = this._db.transaction([name], "readwrite");
                    t.objectStore(name).put(queued[i]);
                }
                this.meta(function(){}, 'last_revision', last_revision + 1);
            });
        }
    };

    Store.prototype.get = function(key) {
        var request = new Request(this);

        var idbreq = this._db.transaction(this.name)
            .objectStore(this.name)
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

    };

    Store.prototype.put = function(key, value) {
        var request = new Request(this);
        var name = this.name;
        var t = this._db.transaction([name], "readwrite");
        var idbreq = t.objectStore(name).put({
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

    Store.prototype.delete = function(object) {
    };

    // Exports

    plasmid.Store = Store;
    plasmid.Request = Request;
})(plasmid);
