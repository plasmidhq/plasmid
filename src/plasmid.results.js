define(function(require, exports, module) {

    var promise = require('promise')
    ;

    function Results(source, filter) {
        Array.call(this, []);
        this.source = source;
        this.filter = filter;
    }

    Results.prototype = new Array();

    /* Change the result set window */

    Results.prototype.setWindow = function(start, stop) {
        filter = {
            start: start,
            stop: stop,
        };

        var p = new promise.Promise();
        var r = this.source.fetch(filter);
        r.then(function(results) {
            if (results.length === 0) {
                p.error('NoSuchPage');
            } else {
                p.ok(results);
            }
        }, function(e) {
            p.error(e);    
        });
        return p;
    };

    /* Change the size of the result set, but not the starting position */
    
    Results.prototype.addLimit = function(n) {
        this.filter.stop = this.filter.stop + n;

        var p = new promise.Promise();
        var r = this.source.fetch(this.filter);
        r.then(function(results) {
            if (results.length === 0) {
                p.error('NoSuchPage');
            } else {
                p.ok(results);
            }
        }, function(e) {
            p.error(e);    
        });
        return p;
    };

    /* Shift the result set forward one page */

    Results.prototype.next = function() {
        var filter = {};

        for (k in this.filter) {
            filter[k] = this.filter[k];
        }
        filter.start = this.filter.stop;
        filter.stop = this.filter.stop + (this.filter.stop - this.filter.start);

        var p = new promise.Promise();
        var r = this.source.fetch(filter);
        r.then(function(results) {
            if (results.length === 0) {
                p.error('NoSuchPage');
            } else {
                p.ok(results);
            }
        }, function(e) {
            p.error(e);    
        });
        return p;
    }

    /* Shift the result set backward one page */

    Results.prototype.previous = function() {
        var filter = {};

        for (k in this.filter) {
            filter[k] = this.filter[k];
        }

        filter.stop = this.filter.start;
        filter.start = this.filter.start - (this.filter.stop - this.filter.start);

        if (filter.start < 0) {
            var p = new promise.Promise();
            p.error('NoSuchPage');
            return p;
        }

        return this.source.fetch(filter);
    }

    exports.Results = Results;

});
