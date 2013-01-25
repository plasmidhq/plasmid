define(function(require, exports, module) {

    var plasmid = require('plasmid');
    var Promise = plasmid.Promise;
    var EventListener = plasmid.EventListener;

    function Resolver(store) {
        this.store = store;
    };
    Resolver.prototype = new EventListener();

    Resolver.prototype.resolve = function(local_item, remote_item) {

        var resolve_puts = [];
        function put(key, value) {
            resolve_puts.push([key, value]);
        }

        // Allow conflict event handles to resolve the conflict first
        this.store.trigger('conflict', put, key, obj.value, value);

        // If the resolution put any objects,
        // save those instead of the current value
        if (resolve_puts.length > 0) {
            var steps = [];
            this.store._remove(key)
            .then(function() {
                while (resolve_puts.length > 0) {
                    var n = resolve_puts.shift();
                    steps.push(this.store.put(n[0], n[1]));
                }
                Promise.chain(steps)
                .then(function(){
                    database.meta.put('last_revision', revision).then(next);
                });
            });
        } else {
            // Default, keep the local value...
            put(key, obj.value);
        }
    };

});
