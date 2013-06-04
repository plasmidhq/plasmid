'use strict';

define(['plasmid.core'], function(plasmid) {
  describe('Plasmid: LocalStore', function () {

    var DB
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

    var db_counter = 0;
    function make_database(schema) {
      var out = new plasmid.Promise();
      var name = db_counter++;
      names.push(name);
      runs(function(){
        DB = new plasmid.Database({
          name: name,
          schema: schema
        })
        .on('opensuccess', function() {
          out.ok(DB);
        })
        .on('openerror', function() {
          console.error("Could not open database");
          out.error();
        })
      });
      waitsFor(function(){
        return out._status !== 'waiting';
      }, 'database to be ready', 1500);
      return out;
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
      make_database({
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

    describe('walks over indices', function () {

      beforeEach(function(){
          make_database(indexed_schema);

          // create fixtures
          make_fixtures('notes', [
            {created: 2, text: 'two'},
            {created: 4, text: 'four'},
            {created: 1, text: 'one'},
            {created: 3, text: 'three'},
          ]);
      });

      it('allows paging of fetch results', function(){
        var p = make_queries(
          function() {
            return DB.stores.notes.by('created').fetch({start: 0, stop: 2});
          }
        );
        runs(function(){
          expect(p.result.length).toBe(2);
          expect(p.result[0].value.text).toBe("one");
          expect(p.result[1].value.text).toBe("two");
        });

        var p2 = make_queries(
          function() {
            return p.result.next();
          }
        );
        runs(function(){
          expect(p2.result.length).toBe(2);
          expect(p2.result[0].value.text).toBe("three");
          expect(p2.result[1].value.text).toBe("four");
        });
      });

      it('walks over a limit', function(){
        var p = make_queries(
          function() {
            return DB.stores.notes.by('created').fetch({start: 1, stop: 3});
          }
        );
        runs(function(){
          expect(p.result.length).toBe(2);
          expect(p.result[0].value.text).toBe("two");
          expect(p.result[1].value.text).toBe("three");
        });
      });

      it('walks over all', function(){
          var p = make_queries(
            function() {
              return DB.stores.notes.by('created').fetch();
            },
            function() {
              return DB.stores.notes.fetch();
            },
            function() {
              return DB.stores.notes.by('created').fetch({});
            }
          );
          runs(function() {
            expect(p.result[0].length).toBe(4);
            expect(p.result[1].length).toBe(4);
            expect(p.result[2].length).toBe(4);
          });
      });

      it('filters by <', function(){
          var upto = make_queries(
            function() {
              return DB.stores.notes.by('created').fetch({lt: 2})
            }
          );
          runs(function() {
            // expect on data
            expect(upto.result.length).toBe(1);
            expect(upto.result[0].value.text, "one");
          });
      });

      it('filters by >', function(){
          var downto = make_queries(
            function() {
              return DB.stores.notes.by('created').fetch({gt: 2})
            }
          );
          runs(function() {
            // expect on data
            expect(downto.result.length).toBe(2);
            expect(downto.result[0].value.text, "three");
            expect(downto.result[1].value.text, "four");
          });
      });

      it('filters by <=', function(){
          var uptoinc = make_queries(
            function() {
              return DB.stores.notes.by('created').fetch({lte: 2})
            }
          );
          runs(function() {
            // expect on data
            expect(uptoinc.result.length).toBe(2);
            expect(uptoinc.result[0].value.text, "one");
            expect(uptoinc.result[1].value.text, "two");
          });
      });

      it('filters by > and <=', function(){
          var between = make_queries(
            function() {
              return DB.stores.notes.by('created').fetch({gt: 1, lte: 3});
            }
          );
          runs(function() {
            expect(between.result.length).toBe(2);
            expect(between.result[0].value.text).toBe("two");
            expect(between.result[1].value.text).toBe("three");
          });
      });

      it('filters by =', function(){
          var exact = make_queries(
            function() {
              return DB.stores.notes.by('created').fetch(3);
            }
          );
          runs(function() {
            expect(exact.result.length).toBe(1);
            expect(exact.result[0].value.text).toBe("three");
          });
      });

      it('can walk in reverse', function(){
          var p = make_queries(
            function() {
              return DB.stores.notes.by('created').fetch({reverse: true});
            }
          );
          runs(function() {
            expect(p.result.length).toBe(4);
            expect(p.result[0].value.text).toBe("four");
            expect(p.result[1].value.text).toBe("three");
            expect(p.result[2].value.text).toBe("two");
            expect(p.result[3].value.text).toBe("one");
          });
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
