'use strict';

define(['plasmid'], function(plasmid) {
  describe('Plasmid: Database', function () {

    var DB, ready = false;

    // Initialize the controller and a mock scope
    beforeEach(function () {
      ready = false;
    });

    afterEach(function () {
      indexedDB.deleteDatabase(DB.idb.name);
    });

    it('creates a database', function () {
      runs(function(){
        DB = new plasmid.Database({
          name: 'test',
          schema: {version: 1},
        })
        .on('opensuccess', function() {
          ready = true;
        })
      });

      waitsFor(function(){
        return ready;
      });

      runs(function(){
        expect(DB.idb.name).toBe('test');
      });
      
    })
  })
})
