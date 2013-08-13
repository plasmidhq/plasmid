define(function(require, exports, module) {
  var plasmid = require('plasmid');

  function ExtensionBase() {};
  ExtensionBase.prototype = new plasmid.EventListener();
  ExtensionBase.prototype.extendStore = function(store) {
    var ext = this;

    function delegate(eventname) {
      var f = function() {
        Array.prototype.splice.call(arguments, 0, 0, eventname, store);
        ext.trigger.apply(ext, arguments);
      }
      f.name = eventname + '_handler';
      return f;
    }

    store.on('preupdate', delegate('storepreupdate'));
    store.on('update', delegate('storeupdate'));

  };

  exports.Default = function(path, when, indexed, callback) {
    if (!!indexed && indexed != 'indexed') {
      throw "Default third argument must be missing or 'indexed'";
    }
    this.path = path;
    this.when = when;
    this.indexed = indexed;

    this.on('storepreupdate', function(store, action, key, value) {
      if (action === when) {
        store.setAtPath(value, path, callback());
      }
    });
  };
  exports.Default.prototype = new ExtensionBase();

  exports.Timestamp = function(path, when, indexed) {
    exports.Default.call(this, path, when, indexed, function(){ return new Date(); });
  };
  exports.Timestamp.prototype = new ExtensionBase();

});
