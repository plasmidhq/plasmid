'use strict';

var plasmid = require('../../src/plasmid.core.js');
var ext = require('../../src/plasmid.ext.js');
var utils = require('../util/indexeddb.js');
var make_database = utils.make_database;
var make_fixtures = utils.make_fixtures;
var make_queries = utils.make_queries;

describe('Plasmid: Extensions', function() {

  var C = 0;
  function counter() {
    return C++;
  }

  var created = new ext.Default('created', 'add', counter);
  var updated = new ext.Default('updated', counter);

  var schema_ext = {
    version: 1,
    stores: {
      notes: {
        sync: false,
        extensions: [
          created,
          updated,
        ]
      }
    }
  };

  describe('invokes extension hooks', function (done) {

    it('sets up event hooks for extension', function(){

      spyOn(created, 'extendStore');
      spyOn(updated, 'extendStore');

      make_database(schema_ext).then(function(){
        expect(created.extendStore).toHaveBeenCalled();
        expect(updated.extendStore).toHaveBeenCalled();

        done();
      });
    });

    it('triggers correct extension events', function() {
      var md = make_database(schema_ext);

      var X = {note: 123};
      var Y = {note: 'abc'};

      var events = [];
      created.on('storepreupdate', function(store, action, value) {
        events.push({action:action, value:value});
      });

      md.then(function(){
        var p = make_queries('writes to track by extension',
          function () {
            return utils.DB.stores.notes.add(X);
          },
          function () {
            return utils.DB.stores.notes.put(Y);
          }
        );
        p.then(function() {
          expect(events.length).toBe(2);

          expect(events[0].action).toBe('add');
          expect(events[0].value.note).toBe(123);

          expect(events[1].action).toBe('put');
          expect(events[1].value.note).toBe('abc');
        });
      })
    });

    it('s dates', function(){

      var X = {note: 123};
      C = 0;
      make_database(schema_ext).then(function(){
        make_queries('writes to track by extension',
          function () {
            return utils.DB.stores.notes.add(X);
          }
        );
        var p = make_queries('get saved value',
          function() {
            return utils.DB.stores.notes.get(X._id);
          }
        );
        p.then(function(){
          expect(C).toBe(2);
          expect(p.result.created).toBe(0);
          expect(p.result.updated).toBe(1);
        });

        make_queries('writes to track by extension',
          function () {
            var X = p.result;
            X.note = 'abc';
            return utils.DB.stores.notes.put(X);
          }
        );
        var p2 = make_queries('get saved value',
          function() {
            return utils.DB.stores.notes.get(X._id);
          }
        );
        p2.then(function(){
          expect(C).toBe(3);
          expect(p2.result.created).toBe(0);
          expect(p2.result.updated).toBe(2);
        });
      })
    });

  });

});
