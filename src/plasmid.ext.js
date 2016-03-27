var plasmid = require('./plasmid.core.js');

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

exports.Default = function(path, when, callback) {
  if (arguments.length === 2) {
    callback = when;
    when = null;
  }

  this.path = path;
  this.when = when;

  this.on('storepreupdate', function(store, action, value) {
    if (!when || action === when) {
      var inj = callback();
      store.setAtPath(value, path, inj);
    }
  });
};
exports.Default.prototype = new ExtensionBase();

exports.Timestamp = function(path, when) {
  exports.Default.call(this, path, when, Date);
};
exports.Timestamp.prototype = new ExtensionBase();
