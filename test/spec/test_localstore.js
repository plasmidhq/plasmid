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
        console.log("Making database...", name, !!DB);
        ready = false;
        DB = new plasmid.Database({
          name: name,
          schema: schema
        })
        .on('opensuccess', function() {
          console.log("opened database");
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

    it('adds objects with unique keys', function () {
      make_database(1, {
        version: 1,
      });

      var keys = make_fixtures('meta', [
        "test 1 2 3",
      ]);

      var done = false;
      runs(function() {
        DB.meta.get(keys.result[0])
        .then(function(value) {
          expect(value).toBe("test 1 2 3");
          done = true;
        });
      });

      waitsFor(function(){
        return done;
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

    it('walks over indices >', function () {
      var one = 1; // new Date(2000, 0, 1);
      var two = 2; // new Date(2000, 0, 2);

      make_database(2, indexed_schema);
      waitsFor(function(){
        console.log('db open?', ready);
        return ready;    
      }, "Database didn't open in time", 1000);

      // create fixtures
      make_fixtures('notes', [
        {created: one, text: 'one'},
        {created: two, text: 'two'},
      ]);

      // query data
      var done = false;
      var length;
      runs(function() {
        DB.stores.notes.fetch({indexname: 'created', upto: two, exclusive: true})
        .then(function(value) {
          // expect on data
          expect(value.length).toBe(1);
          expect(value[0].value.text, "one");
          done = true;
        }, function(e) {
          expect(true).toBe(false);
          done = true;    
        });
      });

      waitsFor(function(){
          return done;
      });
      runs(function() {
      });

    })

    runs(function(){
      console.log("DONE");
      for (var i=0; i < names.length; i++) {
        var close = indexedDB.deleteDatabase(name[i]);
        close.onsuccess = function() {
          console.debug("closed");
        }
      }
    });

  })
})
