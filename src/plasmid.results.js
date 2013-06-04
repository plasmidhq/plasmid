define(function(require, exports, module) {

    var promise = require('promise')
    ;

    function Results(source, filter) {
        Array.call(this, []);
        this.source = source;
        this.filter = filter;
    }
    Results.prototype = new Array();
    Results.prototype.next = function() {
        var filter = {};

        for (k in this.filter) {
            filter[k] = this.filter[k];
        }
        filter.start = this.filter.stop;
        filter.stop = this.filter.stop + (this.filter.stop - this.filter.start);

        return this.source.fetch(filter);
    }

    exports.Results = Results;

});
