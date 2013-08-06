'use strict';

var DB
,   names = []
,   db_counter = 0

,   make_database
,   make_fixtures
,   make_queries
,   delete_databases

,   db_prefix = Math.random().toString().slice(2);
;

require(['plasmid'], function(plasmid) {

make_database = function(schema) {
  var out = new plasmid.Promise();
  var name = db_prefix + db_counter++;
  names.push(name);
  runs(function(){
    DB = new plasmid.Database({
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
  });
  waitsFor(function(){
    return out._status !== 'waiting';
  }, 'database to be ready', 1500);
  return out;
}

make_fixtures = function(store, objects) {
  var out = new plasmid.Promise();
  runs(function(){
    var promises = [], p;
    for (var i=0; i < objects.length; i++) {
      p = DB.stores[store].add(null, objects[i]);
      promises.push(p);
    }
    plasmid.Promise.chain(promises)
    .then(function(value){
      out.ok(value);
    });
  });
  out.toBeDone = function() {
    return typeof out.result !== 'undefined';
  }
  waitsFor(out.toBeDone, "fixtures to be made", 1000);
  return out;
}

make_queries = function() {
  var n, f, p, c = [], a, l, r = new plasmid.Promise();
  if (typeof arguments[0] !== 'function') {
    n = Array.prototype.shift.apply(arguments);
  } else {
    n = '(queries)';
  }
  l = arguments.length;
  a = Array.prototype.slice.apply(arguments);
  runs(function(){
    for (var i = 0; i < l; i++) {
      f = a[i];
      p = f();
      c.push(p);
      if (typeof p === 'undefined') {
          console.log("ERROR make_queries():", n, f);
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
  });
  waitsFor(function() {
    //console.log(["waiting status:", c._status, "for", n].join(' '));
    return c._status !== 'waiting';
  }, n, 1000);
  return r;
}

delete_databases = function() {
    runs(function(){
      for (var i=0; i < names.length; i++) {
        var close = indexedDB.deleteDatabase(name[i]);
        close.onsuccess = function() {
          console.debug("closed");
        }
      }
    });
}

});
