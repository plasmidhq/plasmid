'use strict';

define(['promise'], function(promise) {
  describe('Utility: Promise', function () {

    // Initialize the controller and a mock scope
    beforeEach(function () {
    });

    it('fires a callback with results, once', function () {
      var p = new promise.Promise();
      var r = 0;
      p.then(function(n) {
        r += n;
      });
      p.ok(1);
      expect(r).toBe(1);

      expect(function(){
        p.ok(1);
      }).toThrow();

      expect(function(){
        p.error(1);
      }).toThrow();
    })

    it('cannot be resolved after an error', function() {
      var p = new promise.Promise();
      var r = 0;
      p.then(function(n) {
        r += n;
      });
      
      p.error(-1);
      expect(r).toBe(0);
    })

    it('fires post-resolve then callbacks', function() {
      var p = new promise.Promise();
      var r = 0;
      p.ok(1);
      p.then(function(n) {
        r += n;
      });

      expect(r).toBe(1);
    })

    it('fires errbacks, once', function() {
      var p = new promise.Promise();
      var r = 0;
      p.then(function(n) {
        r += n;
      }, function(e) {
        r = e;    
      });

      p.error('BAD');

      expect(r).toBe('BAD');

      expect(function(){
        p.error('WORSE');
      }).toThrow();

      expect(function(){
        p.ok('GOOD');
      }).toThrow();
    })

  })
})
