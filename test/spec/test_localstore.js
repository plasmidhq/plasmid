'use strict';

define(['plasmid'], function(plasmid) {
  describe('Plasmid: LocalStore', function () {

    var DB, ready = false;

    // Initialize the controller and a mock scope
    beforeEach(function () {
      ready = false;
    });

    afterEach(function () {
      if (!!DB.idb) {
        indexedDB.deleteDatabase(DB.idb.name);
      }
    });

    function make_database(schema) {
      return function() {
        DB = new plasmid.Database({
          name: 'test',
          schema: schema
        })
        .on('opensuccess', function() {
          ready = true;
        })
      }
    }
    function wait_database() {
      return ready;
    }

    it('adds objects with unique keys', function () {
      runs(make_database({
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

  })
})
