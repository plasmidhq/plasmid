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
    if (DB && DB.idb !== null) {
      indexedDB.deleteDatabase(DB.idb.name);
    }
  });

  it('creates a database', function (done) {
    DB = new plasmid.Database({
      name: 'test',
      schema: {version: 1},
    })
    .on('opensuccess', function() {
      expect(DB.idb.name).toBe('test');
      done();
    })
  })

  it('triggers openerror', function (done) {
    DB = new plasmid.Database({
      name: 'test',
      schema: {version: 1/0},
    })
    .on('opensuccess', function() {
      ready = "success";
      expect(ready).toBe("error");
      done();
    })
    .on('openerror', function() {
      ready = "error";
      expect(ready).toBe("error");
      done();
    })
  })

})
