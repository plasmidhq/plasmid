'use strict';

var Promise = require('../../src/plasmid.core.js').Promise;

var DB
,   names = []
,   db_counter = 0

,   make_database
,   make_fixtures
,   make_queries
,   delete_databases

;

function delete_database(name) {
  var promise = new Promise();
  var close = indexedDB.deleteDatabase(name);
  close.onsuccess = function() {
    promise.ok();
  };
  close.onerror = function() {
    promise.error();
  };
  return promise;
}

exports.make_database = function(schema) {
  var out = new plasmid.Promise();
  var name = 'DB_' + db_counter++;
  names.push(name);

  delete_database(name).then(function() {
    DB = exports.DB = new plasmid.Database({
      name: name,
      schema: schema
    })
    .on('opensuccess', function() {
      out.ok(DB);
    })
    .on('openerror', function() {
      console.error("Could not open database");
      out.error();
    })
  })
  return out;
}


exports.make_fixtures = function(store, objects) {
  var out = new plasmid.Promise();
  // runs(function(){
    var promises = [], p;
    for (var i=0; i < objects.length; i++) {
      p = DB.stores[store].add(objects[i]);
      promises.push(p);
    }
    plasmid.Promise.chain(promises)
    .then(function(value){
      out.ok(value);
    });
  // });
  out.toBeDone = function() {
    return typeof out.result !== 'undefined';
  }
  // waitsFor(out.toBeDone, "fixtures to be made", 1000);
  return out;
}

exports.make_queries = function() {
  var n, f, p, c = [], a, l, r = new plasmid.Promise();
  if (typeof arguments[0] !== 'function') {
    n = Array.prototype.shift.apply(arguments);
  } else {
    n = '(queries)';
  }
  l = arguments.length;
  a = Array.prototype.slice.apply(arguments);

  for (var i = 0; i < l; i++) {
    f = a[i];
    p = f();
    c.push(p);
    if (typeof p === 'undefined') {
        console.log("ERROR make_queries():", n, f.toString());
        throw "query function did not return a promise!";
    }
    p.then(function() {
      //
    }, function(e) {
      r.error('chained promise failed: ' + e);
    });
  }
  c = plasmid.Promise.chain(c);
  c.then(function(v){
    if (r._status === 'waiting') {
      if (l === 1) {
        r.ok(v[0]);
      } else {
        r.ok(v);
      }
    } else {
      //
    }
  }, function(e) {
    console.log("query error, " + n + ": " + e);
    //console.log(["chain status:", c._status, "for", n].join(' '));
    if (r._status === 'waiting') {
      r.error('chain fail: ' + e);
    } else if (r._status === 'fulfilled') {
      console.error("Promise chain found error after fulfillment!");
    } else {
      console.log(["ignoring error...", n, e, r._status, r._error].join(' '));
    }
  });
  return r;
}
