'use strict';

var promise = require('../../src/promise.js');

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

  it('chains a single promise', function() {
    var p1 = new promise.Promise();
    var c = promise.Promise.chain([p1]);

    var r = 0;
    c.then(function(results) {
      expect(results.length).toBe(1);

      r += results[0];
    });

    p1.ok(1);
    expect(r).toBe(1);
  })

  it('chains multiple promises together', function() {
    var p1 = new promise.Promise();
    var p2 = new promise.Promise();
    var c = promise.Promise.chain([p1, p2]);

    var r = 0;
    c.then(function(results) {
      expect(results.length).toBe(2);

      r += results[0];
      r += results[1];
    });

    p1.ok(1);
    expect(r).toBe(0);
    p2.ok(2);
    expect(r).toBe(3);
  })

  it('chains multiple promises together, handling an error', function() {
    var p1 = new promise.Promise();
    var p2 = new promise.Promise();
    var c = promise.Promise.chain([p1, p2]);

    var r = 0;
    c.then(function(results) {
      expect(results.length).toBe(2);

      r += results[0];
      r += results[1];
    }, function(e) {
      r = e;
    });

    p1.ok(1);
    expect(r).toBe(0);
    p2.error('BAD');
    expect(r).toBe('BAD');
  })

})
