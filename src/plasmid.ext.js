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

  exports.Timestamp = function(path, when, indexed) {
    if (when !== 'added' && when != 'saved') {
      throw "Timestamp second argument must be 'saved' or 'added'";
    } else if (!!indexed && indexed != 'indexed') {
      throw "Timestamp third argument must be missing or 'indexed'";
    }
    this.path = path;
    this.when = when;
    this.indexed = indexed;

    this.on('storepreupdate', function(store, action, key, value) {
      if (action === when) {
        store.setAtPath(value, path, new Date());
        console.log('set', value);
      }
    });
  };
  exports.Timestamp.prototype = new ExtensionBase();

});
