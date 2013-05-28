'use strict';

define(['plasmid'], function(plasmid) {
  describe('Plasmid: LocalStore', function () {

    var DB
    ,   ready = false
    ,   names = [];
    ;

    afterEach(function () {
      var closed = false;
    
      console.debug("closing...");
      if (!!DB && !!DB.idb) {
        var close = indexedDB.deleteDatabase(DB.idb.name);
        close.onsuccess = function() {
          console.debug("closed");
        }
      }
    });

    function make_database(name, schema) {
      var out = new plasmid.Promise();
      names.push(name);
      runs(function(){
        ready = false;
        DB = new plasmid.Database({
          name: name,
          schema: schema
        })
        .on('opensuccess', function() {
          ready = true;
          out.ok(DB);
        })
        .on('openerror', function() {
          console.error("Could not open database");
          ready = true;
          out.error();
        })
      });
      waitsFor(function(){
        return out._status !== 'waiting';
      }, 'database to be ready', 1500);
      return out;
    }
    function wait_database() {
      return ready;
    }


    function make_fixtures(store, objects) {
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

    function make_queries() {
      var f, p, c = [], a = arguments, l = arguments.length, r = new plasmid.Promise();
      runs(function(){
        for (var i = 0; i < l; i++) {
            f = a[i];
            p = f();
            c.push(p);
        }
        c = plasmid.Promise.chain(c);
        c.then(function(v){
          if (l === 1) {
            r.ok(v[0]);
          } else {
            r.ok(v);
          }
        });
      });
      waitsFor(function() {
        return c._status !== 'waiting';
      }, "queries to be made", 1000);
      return r;
    }

    it('adds objects with unique keys', function () {
      make_database(1, {
        version: 1,
      });

      var keys = make_fixtures('meta', [
        "test 1 2 3",
      ]);

      var values = make_queries(
        function() {
          return DB.meta.get(keys.result[0])
        }
      );
  
      runs(function() {
        expect(values.result).toBe("test 1 2 3");
      });
    })

    var indexed_schema = {
        version: 1,
        stores: {
            notes: {
                sync: false,
                indexes: {
                    created: {key: 'created'}
                }
            }
        }
    };

    it('walks over indices', function () {

      make_database(2, indexed_schema);
      waitsFor(function(){
        return ready;    
      }, "Database didn't open in time", 1000);

      // create fixtures
      make_fixtures('notes', [
        {created: 1, text: 'one'},
        {created: 2, text: 'two'},
        {created: 3, text: 'three'},
        {created: 4, text: 'four'},
      ]);

      var upto = make_queries(
        function() {
          return DB.stores.notes.fetch({indexname: 'created', upto: 2, exclusive: true})
        }
      );
      runs(function() {
        // expect on data
        expect(upto.result.length).toBe(1);
        expect(upto.result[0].value.text, "one");
      });

      var downto = make_queries(
        function() {
          return DB.stores.notes.fetch({indexname: 'created', downto: 2, exclusive: true})
        }
      );
      runs(function() {
        // expect on data
        expect(downto.result.length).toBe(2);
        expect(downto.result[0].value.text, "three");
        expect(downto.result[1].value.text, "four");
      });

      var uptoinc = make_queries(
        function() {
          return DB.stores.notes.fetch({indexname: 'created', upto: 2, exclusive: false})
        }
      );
      runs(function() {
        // expect on data
        expect(uptoinc.result.length).toBe(2);
        expect(uptoinc.result[0].value.text, "one");
        expect(uptoinc.result[1].value.text, "two");
      });

      var between = make_queries(
        function() {
          return DB.stores.notes.fetch({indexname: 'created', between: [1, 3], exclusive: [true, false]})
        }
      );
      runs(function() {
        expect(between.result.length).toBe(2);
        expect(between.result[0].value.text).toBe("two");
        expect(between.result[1].value.text).toBe("three");
      });

    })

    runs(function(){
      for (var i=0; i < names.length; i++) {
        var close = indexedDB.deleteDatabase(name[i]);
        close.onsuccess = function() {
          console.debug("closed");
        }
      }
    });

  })
})
