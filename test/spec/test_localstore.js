'use strict';

var plasmid = require('../../src/plasmid.core.js');
var utils = require('../util/indexeddb.js');
var make_database = utils.make_database;
var make_fixtures = utils.make_fixtures;
var make_queries = utils.make_queries;

describe('Plasmid: LocalStore', function () {

  it('adds objects with unique keys', function (done) {
    make_database({
      version: 1,
      stores: {
        notes: {sync: false}
      }
    }).then(function(){
      var X = {note: "test 1 2 3"};
      var keys = make_fixtures('notes', [X]);
      var values = make_queries(function() {
        return utils.DB.stores.notes.get(X._id)
      }).then(function(){
        expect(values.result.note).toBe("test 1 2 3");
        done();
      });
    });
  });

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

    beforeEach(function(done){
        make_database(indexed_schema).then(function(){
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
            done();
          });
        })
    });

    it('allows the results to be refreshed', function(done){
      var p = make_queries("refresh 1",
        function() {
          return utils.DB.stores.notes.by('created').fetch({start: 0, stop: 1});
        }
      );
      p.then(function(){
        expect(p.result.length).toBe(1);
        expect(p.result[0].text).toBe("one");

        make_queries("refresh 2",
          function() {
            var item = p.result[0];
            var refresh = new plasmid.Promise();
            item.text = "ONE"
            utils.DB.stores.notes.put(item)
            .then(function() {
              setTimeout(function(){
              p.result.refresh().then(function(){
                refresh.ok('done');
              });
              },0);
            });
            return refresh;
          }
        ).then(function(){
          expect(p.result.length).toBe(1);
          expect(p.result[0].text).toBe("ONE");
          done();
        });
      });
    });

    it('refreshes live results on changes', function(done){
      var p = make_queries("live 1",
        function() {
          return utils.DB.stores.notes.by('created').fetch({start: 0, stop: 1});
        }
      );
      p.then(function(){
        expect(p.result.length).toBe(1);
        expect(p.result[0].text).toBe("one");

        make_queries("live 2",
          function() {
            var item = p.result[0];
            item.text = "ONE";
            p.result.watch();
            return utils.DB.stores.notes.put(item);
          }
        ).then(function(){
          make_queries(function(){
            return p.result.__refreshing;
          }).then(function(){
            expect(p.result.length).toBe(1);
            expect(p.result[0].text).toBe("ONE");
            done();
          });
        })
      });
    });

    it('allows the result window to be set', function(done){
      var p = make_queries("result window 1",
        function() {
          return utils.DB.stores.notes.by('created').fetch({start: 0, stop: 1});
        }
      );
      p.then(function(){
        expect(p.result.length).toBe(1);
        expect(p.result[0].text).toBe("one");

        make_queries("result window 2",
          function() {
            return p.result.setWindow(1, 2);
          }
        ).then(function(){
          expect(p.result.length).toBe(1);
          expect(p.result[0].text).toBe("two");
          done();
        });
      });
    });

    it('allows the result limit to be changed', function(done){
      var p = make_queries("result limit 1",
        function() {
          return utils.DB.stores.notes.by('created').fetch({start: 0, stop: 1});
        }
      );
      p.then(function(){
        expect(p.result.length).toBe(1);
        expect(p.result[0].text).toBe("one");

        var p2 = make_queries("result limit 2",
          function() {
            return p.result.addLimit(1);
          }
        );
        p2.then(function(){
          expect(p.result.length).toBe(2);
          expect(p.result[0].text).toBe("one");
          expect(p.result[1].text).toBe("two");
          done();
        });
      });
    });

    it('allows paging of fetch results', function(done){
      var p = make_queries("paging 1",
        function() {
          return utils.DB.stores.notes.by('created').fetch({start: 0, stop: 2});
        }
      );
      p.then(function(){
        expect(p.result.length).toBe(2);
        expect(p.result[0].text).toBe("one");
        expect(p.result[1].text).toBe("two");

        var p2 = make_queries("paging 2",
          function() {
            return p.result.next();
          }
        );
        p2.then(function(){
          expect(p.result.length).toBe(2);
          expect(p.result[0].text).toBe("three");
          expect(p.result[1].text).toBe("four");
        });

        var p3 = make_queries("paging 3",
          function() {
            return p.result.next();
          }
        );
        p3.then(function(){
          expect(p3._error).toMatch(/NoSuchPage$/);
          expect(p3.result).toBe(undefined);
        });

        var p4 = make_queries("paging 4",
          function() {
            return p.result.previous();
          }
        );
        p4.then(function(){
          expect(p.result.length).toBe(2);
          expect(p.result[0].text).toBe("one");
          expect(p.result[1].text).toBe("two");
        });

        var p5 = make_queries("paging 5",
          function() {
            return p.result.previous();
          }
        );
        p5.then(function(){
          expect(p5.result).toBe(undefined);
          expect(p5._error).toMatch(/NoSuchPage$/);
          done();
        });
      });
    });

    it('walks over a limit', function(done){
      var p = make_queries(
        function() {
          return utils.DB.stores.notes.by('created').fetch({start: 1, stop: 3});
        }
      );
      p.then(function(){
        expect(p.result.length).toBe(2);
        expect(p.result[0].text).toBe("two");
        expect(p.result[1].text).toBe("three");
        done();
      });
    });

    it('walks over all', function(done){
        var p = make_queries(
          function() {
            return utils.DB.stores.notes.by('created').fetch();
          },
          function() {
            return utils.DB.stores.notes.fetch();
          },
          function() {
            return utils.DB.stores.notes.by('created').fetch({});
          }
        );
        p.then(function() {
          expect(p.result[0].length).toBe(4);
          expect(p.result[1].length).toBe(4);
          expect(p.result[2].length).toBe(4);
          done();
        });
    });

    it('filters by <', function(done){
        var upto = make_queries(
          function() {
            return utils.DB.stores.notes.by('created').fetch({lt: 2})
          }
        );
        upto.then(function() {
          // expect on data
          expect(upto.result.length).toBe(1);
          expect(upto.result[0].text, "one");
          done();
        });
    });

    it('filters by >', function(done){
        var downto = make_queries(
          function() {
            return utils.DB.stores.notes.by('created').fetch({gt: 2})
          }
        );
        downto.then(function() {
          // expect on data
          expect(downto.result.length).toBe(2);
          expect(downto.result[0].text, "three");
          expect(downto.result[1].text, "four");
          done();
        });
    });

    it('filters by <=', function(done){
        var uptoinc = make_queries(
          function() {
            return utils.DB.stores.notes.by('created').fetch({lte: 2})
          }
        );
        uptoinc.then(function() {
          // expect on data
          expect(uptoinc.result.length).toBe(2);
          expect(uptoinc.result[0].text, "one");
          expect(uptoinc.result[1].text, "two");
          done();
        });
    });

    it('filters by > and <=', function(done){
        var between = make_queries(
          function() {
            return utils.DB.stores.notes.by('created').fetch({gt: 1, lte: 3});
          }
        );
        between.then(function() {
          expect(between.result.length).toBe(2);
          expect(between.result[0].text).toBe("two");
          expect(between.result[1].text).toBe("three");
          done();
        });
    });

    it('filters by =', function(done){
        var exact = make_queries(
          function() {
            return utils.DB.stores.notes.by('created').fetch(3);
          }
        );
        exact.then(function() {
          expect(exact.result.length).toBe(1);
          expect(exact.result[0].text).toBe("three");
          done();
        });
    });

    it('can walk in reverse', function(done){
        var p = make_queries(
          function() {
            var r = utils.DB.stores.notes.by('created');
            return r.fetch({reverse: true});
          }
        );
        p.then(function() {
          expect(p.result.length).toBe(4);
          expect(p.result[0].text).toBe("four");
          expect(p.result[1].text).toBe("three");
          expect(p.result[2].text).toBe("two");
          expect(p.result[3].text).toBe("one");
          done();
        });
    });

    if('can access meta data', function(done) {
      for (var key in fixtures) { break ; }
      var p = make_queries(
        function() {
          return utils.DB.stores.notes.meta(key, 'metafield', 123);
        }
      );
      p.then(function(){
        expect(typeof p.error).toBe('undefined');
      });
      var p2 = make_queries(
        function() {
          return utils.DB.stores.notes.meta(key, 'metafield');
        }
      );
      p2.then(function() {
        expect(p2.result).toBe(123)
        done();
      })
    });
  })
})
