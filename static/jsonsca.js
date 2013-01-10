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
    
    
    JSONSCA.pack = function(input, reftracker) {
        var promise = new plasmid.Promise();
        var t = typeof input;
        if (typeof reftracker === 'undefined') {
            var reftracker = new JSONSCA._ReferenceTracker();
        }
        var reference = reftracker.reference(input);
        if (reference && reference.ref) {
            promise.ok({'reference': reference.ref});
        } else if (t === 'string' || t === 'number' || t === 'boolean') {
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
            var out = {
                'id': reference['new'],
                'imagedata': {
                    width: input.width,
                    height: input.height,
                    data: undefined,
                }
            };
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
            var out = {
                'id': reference['new'],
            };
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
            var promises = [];
            for (var i=0; i < input.length; i++) {
                promises.push(JSONSCA.pack(input[i], reftracker));
            }
            var wait = new plasmid.Promise();
            wait.chain(promises).then(function(results) {
                promise.ok({
                    'id': reference['new'],
                    'array': results
                });
            });
        } else {

            // If nothing else, this treat as a simple object and pack the properties

            var promises = [];
            var out = {};
            var proppromise;
            for (prop in input) {
                if (input.hasOwnProperty(prop)) {
                    proppromise = JSONSCA.pack(input[prop], reftracker);
                    proppromise.prop = prop
                    promises.push(proppromise);
                }
            }
            var wait = new plasmid.Promise();
            wait.chain(promises).then(function() {
                promise.ok({'object': out});
            })
            .on('onedone', function(i, promise, result) {
                out[prop] = result;
            });
        }

        return promise;
    };

    JSONSCA.unpack = function(input, references) {
        var t = typeof input;
        var references = references||{};
        var id = input.id;

        // string, number, boolean
        if (t !== 'object') {
            return input;
        }

        if (input['reference']) {
            console.log('ref', input.reference, references[input.reference]);
            return references[input.reference];
        }
        
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
            references[input.id] = out;
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
            references[input.id] = out;
            if (input['file']) {
                out.name = inputdata.properties.name;
            }
            return out;
        }

        if (input['undefined']) {
            return undefined;
        }

        if (input['array']) {
            var out = [];
            references[input.id] = out;
            for (var i=0; i < input.array.length; i++) {
                out.push(JSONSCA.unpack(input.array[i], references));
            }
            return out;
        };

        if (input['object']) {
            var out = {}
            references[input.id] = out;
            for (prop in input['object']) {
                out[prop] = JSONSCA.unpack(input['object'][prop], references);
            }
            return out;
        }
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

    function objsize(obj) {
        var c = 0;
        for (p in obj) {
            if (obj.hasOwnProperty(p)) {
                c++;
            }
        }
        return c;
    };

    JSONSCA._ReferenceTracker = function() {
        this.tracked = {};
        this.next_id = 1;
    };
    JSONSCA._ReferenceTracker.prototype.reference = function(obj) {
        var t = typeof obj;
        if (t==='object') {
            for (ref in this.tracked) {
                if (this.tracked[ref] === obj) {
                    return {'ref': ref};
                }
            }
            var ref = this.next_id;
            this.tracked[this.next_id] = obj;
            this.next_id++;
            return {'new': ref};
        } else {
            return null;
        }
    };

    JSONSCA.__map = map;

})(JSONSCA);
