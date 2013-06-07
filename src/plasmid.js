define(function(require, exports, module) {

    var core = require('plasmid.core');
    var util = require('plasmid.utilities');

    exports.Credentials = core.Credentials;
    exports.Database = core.Database;
    exports.LocalStore = core.LocalStore;
    exports.SyncStore = core.SyncStore;
    exports.EventListener = core.EventListener;
    exports.Promise = core.Promise;
    exports.http = util.http;

});
