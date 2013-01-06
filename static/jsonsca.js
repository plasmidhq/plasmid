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
    // - File
    // - FileList
    // - Blob
    // - ImageData
    //
    // Will support:
    // - cyclic graphs of references
    
    
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
        } else if (input instanceof RegExp) {
            promise.ok({'regexp': {'source': input.source}});
        } else if (input instanceof ImageData) {
            var blob = new Blob([input.data]);
            var reader = new FileReader();
            var out = {'imagedata': {
                width: input.width,
                height: input.height,
                data: undefined,
            }};
            reader.onloadend = function() {
                out.imagedata.data = reader.result;
                promise.ok(out);
            };
            reader.onerror = function() {
                promise.error("Could not serialize");
            };
            reader.readAsBinaryString(blob);
        } else if (input instanceof File || input instanceof Blob) {
            var type = (input instanceof File) ? 'file' : 'blob';
            var out = {};
            out[type] = {
                contents: null,
                properties: {
                    type: input.type,
                }
            };
            if (input instanceof File) {
                out[type].properties.name = input.name;
            }
            var reader = new FileReader();
            reader.onloadend = function() {
                out[type].contents = reader.result;
                promise.ok(out);
            };
            reader.onerror = function() {
                promise.error("Could not serialize");
            };
            reader.readAsBinaryString(input);
        } else if (input instanceof Array || input instanceof FileList) {
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

        if (input['imagedata']) {
            var canvas = document.createElement('canvas');
            var ctx = canvas.getContext('2d');
            var out = ctx.createImageData(input.imagedata.width, input.imagedata.height);
            for (var i=0; i < input.imagedata.data.length; i++) {
                out.data[i] = input.imagedata.data.charCodeAt(i);
            }
            return out;
        }

        if (input['file'] || input['blob']) {
            var inputdata = input['file'] || input['blob'];
            var ab = new ArrayBuffer(inputdata.contents.length);
            var ia = new Uint8Array(ab);
            for (var i=0; i<inputdata.contents.length; i++) {
                ia[i] = inputdata.contents.charCodeAt(i);
            }
            var out = new Blob([ia],
                {type: inputdata.properties.type}
            );
            if (input['file']) {
                out.name = inputdata.properties.name;
            }
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
