'use strict';

define(['plasmid.core', 'plasmid.ext'], function(plasmid, ext) {
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

    describe('invokes extension hooks', function () {

      it('sets up event hooks for extension', function(){

        spyOn(created, 'extendStore');
        spyOn(updated, 'extendStore');

        make_database(schema_ext);

        runs(function(){
          expect(created.extendStore).toHaveBeenCalled();
          expect(updated.extendStore).toHaveBeenCalled();
        });
      });

      it('triggers correct extension events', function() {
        make_database(schema_ext);

        var events = [];
        created.on('storepreupdate', function(store, action, key, value) {
          events.push({action:action, key:key, value:value});
        });

        var p = make_queries('writes to track by extension',
          function () {
            return DB.stores.notes.add('X', {note: 123});
          },
          function () {
            return DB.stores.notes.put('Y', {note: 'abc'});
          }
        );
        runs(function() {
          expect(events.length).toBe(2);

          expect(events[0].action).toBe('add');
          expect(events[0].key).toBe('X');
          expect(events[0].value.note).toBe(123);

          expect(events[1].action).toBe('put');
          expect(events[1].key).toBe('Y');
          expect(events[1].value.note).toBe('abc');
        });

      });

      it('injects dates', function(){

        C = 0;
        make_database(schema_ext);

        make_queries('writes to track by extension',
          function () {
            return DB.stores.notes.add('X', {note: 123});
          }
        );
        var p = make_queries('get saved value',
          function() {
            return DB.stores.notes.get('X');
          }
        );
        runs(function(){
          expect(C).toBe(2);
          expect(p.result.created).toBe(0);
          expect(p.result.updated).toBe(1);
        });

        make_queries('writes to track by extension',
          function () {
            var X = p.result;
            X.note = 'abc';
            return DB.stores.notes.put('X', X);
          }
        );
        var p2 = make_queries('get saved value',
          function() {
            return DB.stores.notes.get('X');
          }
        );
        runs(function(){
          expect(C).toBe(3);
          expect(p2.result.created).toBe(0);
          expect(p2.result.updated).toBe(2);
        });
      });

    });

  });

});
