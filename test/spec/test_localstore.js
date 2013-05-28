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
      names.push(name);
      return function() {
        console.log("Making database...", name, !!DB);
        ready = false;
        DB = new plasmid.Database({
          name: name,
          schema: schema
        })
        .on('opensuccess', function() {
          console.log("opened database");
          ready = true;
        })
        .on('openerror', function() {
          console.error("Could not open database");
          ready = true;
        })
      }
    }
    function wait_database() {
      return ready;
    }

    it('adds objects with unique keys', function () {
      runs(make_database(1, {
        version: 1,
      }));
      waitsFor(wait_database);

      var key = null;
      runs(function(){
        DB.meta.put(null, "test 1 2 3")
        .then(function(_key, value) {
          key = _key;
        });
      });

      waitsFor(function(){
        return key !== null;
      });

      var done = false;
      runs(function() {
        DB.meta.get(key)
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
      return out;
    }

    it('walks over indices >', function () {
      var one = 1; // new Date(2000, 0, 1);
      var two = 2; // new Date(2000, 0, 2);

      runs(make_database(2, indexed_schema));
      waitsFor(function(){
        console.log('db open?', ready);
        return ready;    
      }, "Database didn't open in time", 1000);

      // create fixtures
      var fixtures = make_fixtures('notes', [
        {created: one, text: 'one'},
        {created: two, text: 'two'},
      ]);
      waitsFor(fixtures.toBeDone, "fixtures to be created", 1000);

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
