'use strict';

var plasmid = require('../../src/plasmid.core.js');
var utils = require('../util/indexeddb.js');

describe('Plasmid: Database', function () {

  var DB, ready = false;

  // Initialize the controller and a mock scope
  beforeEach(function () {
    ready = false;
  });

  afterEach(function () {
    if (DB.idb !== null) {
      indexedDB.deleteDatabase(DB.idb.name);
    }
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

  it('triggers openerror', function () {
    runs(function(){
      DB = new plasmid.Database({
        name: 'test',
        schema: {version: 1/0},
      })
      .on('opensuccess', function() {
        ready = "success";
      })
      .on('openerror', function() {
        ready = "error";
      })
    });

    waitsFor(function(){
      return ready.length>0;
    });

    runs(function(){
      //expect(ready).toBe("error");
    });
  })

})
