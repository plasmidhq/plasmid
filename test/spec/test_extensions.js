'use strict';

define(['plasmid.core', 'plasmid.ext'], function(plasmid, ext) {
  describe('Plasmid: Extensions', function() {

    var created = new ext.Timestamp('created', 'added', 'indexed');
    var updated = new ext.Timestamp('updated', 'saved');

    var schema_ext = {
      version: 1,
      stores: {
        notes: {
          sync: false,
          extensions: [
            created,
          //  updated,
          ]
        }
      }
    };

    describe('invokes extension hooks', function () {

      it('sets up event hooks for extension', function(){

        spyOn(created, 'extendStore');
        //spyOn(updated, 'extendStore');

        make_database(schema_ext);

        runs(function(){
          expect(created.extendStore).toHaveBeenCalled();
          //expect(updated.extendStore).toHaveBeenCalled();
        });
      });

      it('triggers correct extension events', function() {
        make_database(schema_ext);

        var watcher = {
          add_keys: [],
          put_keys: [],

          updated: function(store, action, key, value){
          },

          preupdated: function(store, action, key, value){
            watcher[action + '_keys'].push(key);
          }
        };

        created.on('storeupdate', watcher.updated);
        //updated.on('storeupdate', watcher.updated);

        created.on('storepreupdate', watcher.preupdated);
        //updated.on('storepreupdate', watcher.preupdated);

        var p = make_queries('add X',
          function () {
            return DB.stores.notes.add('X', {note: 123});
          }
          //,function() {
            //return DB.stores.notes.put('Y', {note: 'abc'});
          //}
        );
        runs(function() {
          expect(watcher.add_keys.length).toBe(1);
          expect(watcher.add_keys[0]).toBe('X');
        });

      });

    });

  });

});
