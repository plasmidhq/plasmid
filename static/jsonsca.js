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
        var t = typeof input;
        if (t === 'string' || t === 'number' || t === 'boolean') {
            return input;
        }

        if (t === 'undefined') {
            return {'undefined': true};;;;
        }

        if (input === null) {
            return {'null': true};
        }

        if (input instanceof Date) {
            return {'date': input.getTime()};
        }

        if (input instanceof Array) {
            return map(JSONSCA.pack, input);
        }

        // If nothing else, this treat as a simple object and pack the properties
        var out = {};
        for (prop in input) {
            if (input.hasOwnProperty(prop)) {
                out[prop] = JSONSCA.pack(input[prop]);
            }
        }
        return {'object': out};
    };

    JSONSCA.unpack = function(input) {
        var t = typeof input;

        // string, number, boolean
        if (t !== 'object') {
            return input;
        }

        if (t instanceof Array) {
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
        return JSON.stringify(JSONSCA.pack(data));
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
