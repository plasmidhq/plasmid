'use strict';

define(['plasmid.core'], function(plasmid) {
  describe('Plasmid: LocalStore', function () {

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

      var fixtures = {};

      beforeEach(function(){
          make_database(indexed_schema);

          fixtures = {};
          var fixture_data = [
            {created: 2, text: 'two'},
            {created: 4, text: 'four'},
            {created: 1, text: 'one'},
            {created: 3, text: 'three'},
          ];

          // create fixtures
          make_fixtures('notes', fixture_data)
          .then(function(keys) {
            for (var i=0; i<keys.length; i++) {
              fixtures[keys[i]] = fixture_data[i];
            }
          });
      });
      
      it('allows the results to be refreshed', function(){
        var p = make_queries("refresh 1",
          function() {
            return DB.stores.notes.by('created').fetch({start: 0, stop: 1});
          }
        );
        runs(function(){
          expect(p.result.length).toBe(1);
          expect(p.result[0].value.text).toBe("one");
        });

        var p2 = make_queries("refresh 2",
          function() {
            var item = p.result[0];
            var refresh = new plasmid.Promise();
            DB.stores.notes.put(item.key, {created: 1, text: "ONE"})
            .then(function() {
              setTimeout(function(){
              p.result.refresh().then(function(){
                refresh.ok('done');
              });
              },0);
            });
            return refresh;
          }
        );
        runs(function(){
          expect(p.result.length).toBe(1);
          expect(p.result[0].value.text).toBe("ONE");
        });
      });

      it('refreshes live results on changes', function(){
        var p = make_queries("live 1",
          function() {
            return DB.stores.notes.by('created').fetch({start: 0, stop: 1});
          }
        );
        runs(function(){
          expect(p.result.length).toBe(1);
          expect(p.result[0].value.text).toBe("one");
        });

        var p2 = make_queries("live 2",
          function() {
            var item = p.result[0];
            var refresh = new plasmid.Promise();
            p.result.watch();
            DB.stores.notes.put(item.key, {created: 1, text: "ONE"})
            .then(function() {
              setTimeout(function(){
                refresh.ok('done');
              },800);
            });
            return refresh;
          }
        );
        runs(function(){
          expect(p.result.length).toBe(1);
          expect(p.result[0].value.text).toBe("ONE");
        });
      });

      it('allows the result window to be set', function(){
        var p = make_queries("result window 1",
          function() {
            return DB.stores.notes.by('created').fetch({start: 0, stop: 1});
          }
        );
        runs(function(){
          expect(p.result.length).toBe(1);
          expect(p.result[0].value.text).toBe("one");
        });

        var p2 = make_queries("result window 2",
          function() {
            return p.result.setWindow(1, 2);
          }
        );
        runs(function(){
          expect(p.result.length).toBe(1);
          expect(p.result[0].value.text).toBe("two");
        });
      });

      it('allows the result limit to be changed', function(){
        var p = make_queries("result limit 1",
          function() {
            return DB.stores.notes.by('created').fetch({start: 0, stop: 1});
          }
        );
        runs(function(){
          expect(p.result.length).toBe(1);
          expect(p.result[0].value.text).toBe("one");
        });

        var p2 = make_queries("result limit 2",
          function() {
            return p.result.addLimit(1);
          }
        );
        runs(function(){
          expect(p.result.length).toBe(2);
          expect(p.result[0].value.text).toBe("one");
          expect(p.result[1].value.text).toBe("two");
        });
      });

      it('allows paging of fetch results', function(){
        var p = make_queries("paging 1",
          function() {
            return DB.stores.notes.by('created').fetch({start: 0, stop: 2});
          }
        );
        runs(function(){
          expect(p.result.length).toBe(2);
          expect(p.result[0].value.text).toBe("one");
          expect(p.result[1].value.text).toBe("two");
        });

        var p2 = make_queries("paging 2",
          function() {
            return p.result.next();
          }
        );
        runs(function(){
          expect(p.result.length).toBe(2);
          expect(p.result[0].value.text).toBe("three");
          expect(p.result[1].value.text).toBe("four");
        });

        var p3 = make_queries("paging 3",
          function() {
            return p.result.next();
          }
        );
        runs(function(){
          expect(p3._error).toMatch(/NoSuchPage$/);
          expect(p3.result).toBe(undefined);
        });

        var p4 = make_queries("paging 4",
          function() {
            return p.result.previous();
          }
        );
        runs(function(){
          expect(p.result.length).toBe(2);
          expect(p.result[0].value.text).toBe("one");
          expect(p.result[1].value.text).toBe("two");
        });

        var p5 = make_queries("paging 5",
          function() {
            return p.result.previous();
          }
        );
        runs(function(){
          expect(p5.result).toBe(undefined);
          expect(p5._error).toMatch(/NoSuchPage$/);
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
              var r = DB.stores.notes.by('created');
              return r.fetch({reverse: true});
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

      if('can access meta data', function() {
        for (var key in fixtures) { break ; }
        var p = make_queries(
          function() {
            return DB.stores.notes.meta(key, 'metafield', 123);
          }
        );
        runs(function(){
          expect(typeof p.error).toBe('undefined');
        });
        var p2 = make_queries(
          function() {
            return DB.stores.notes.meta(key, 'metafield');
          }
        );
        runs(function() {
          expect(p2.result).toBe(123)
        })
      });

    })

    delete_databases();

  })
})
