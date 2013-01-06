var JSONSCA = {};
(function(JSONSCA) {

    // JSON/SCA is a way to represent more datatypes than allowed by JSON
    //
    // Currently supports:
    // - strings
    // - numbers
    // - booleans
    // - null
    // - undefined
    // - arrays
    // - objects
    // - dates
    //
    // Will support:
    // - File
    // - FileList
    // - Blob
    // - ImageData
    
    
    JSONSCA.pack = function(input) {
        var promise = new plasmid.Promise();
        var t = typeof input;
        if (t === 'string' || t === 'number' || t === 'boolean') {
            promise.ok(input);
        } else if (t === 'undefined') {
            promise.ok({'undefined': true});
        } else if (input === null) {
            promise.ok({'null': true});
        } else if (input instanceof Date) {
            promise.ok({'date': input.getTime()});
        } else if (input instanceof Array) {
            var promises = map(JSONSCA.pack, input);
            promise.chain(promises, 'readytowrap').on('readytowrap', function(results) {
                promise.ok(results);
            });

        } else {

            // If nothing else, this treat as a simple object and pack the properties

            var promises = [];
            var out = {};
            var proppromise;
            for (prop in input) {
                if (input.hasOwnProperty(prop)) {
                    proppromise = JSONSCA.pack(input[prop]);
                    proppromise.then((function(prop){
                        return function(packedprop) {
                            out[prop] = packedprop;
                        };
                    })(prop));
                    promises.push(proppromise);
                }
            }
            promise.chain(promises, 'readytowrap').on('readytowrap', function() {
                promise.ok({'object': out});
            });
        }

        return promise;
    };

    JSONSCA.unpack = function(input) {
        var t = typeof input;

        // string, number, boolean
        if (t !== 'object') {
            return input;
        }

        if (input instanceof Array) {
            return map(JSONSCA.unpack, input);
        };

        if (input['null']) {
            return null;
        }

        if (input['date']) {
            var out = new Date();
            out.setTime(input['date']);
            return out;
        }

        if (input['undefined']) {
            return undefined;
        }

        var out = {}
        for (prop in input['object']) {
            out[prop] = JSONSCA.unpack(input['object'][prop]);
        }
        return out;
    };

    JSONSCA.parse = function(data) {
        return JSONSCA.unpack(JSON.parse(data));
    };

    JSONSCA.stringify = function(data) {
        var pack_promise = JSONSCA.pack(data);
        var stringify_promise = new plasmid.Promise();
        pack_promise.then(function(packed) {
            stringify_promise.ok(JSON.stringify(packed));
        });
        return stringify_promise;
    };

    function map(func, data) {
        var out = [];
        var i;
        for (i=0; i<data.length; i++) {
            out.push(func(data[i]));
        }
        return out;
    };

    JSONSCA.__map = map;

})(JSONSCA);
