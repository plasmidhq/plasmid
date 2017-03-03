'use strict';

var utilities = require('../../src/plasmid.utilities.js');

describe('Utilities: Stream Zipper', function () {

  // Initialize the controller and a mock scope
  beforeEach(function () {
  });

  // it('fires pre-bind triggers, once', function () {
  //   var o = new promise.EventListener()
  //   ,   r = 0
  //   ;
  //   o.trigger('X');
  //   o.on('X', function() {
  //     r += 1;
  //   });
  //   o.on('X', function() {
  //     r += 1;
  //   });
  //   expect(r).toBe(1);
  // });

  it('Passes single streams through', function() {
      var results = []
      var zs = utilities.zipStreams(1, (value) => {
          results.push(value);
      })
      zs.push(0, 1)
      zs.push(0, 2)
      zs.push(0, 3)

      expect(results).toEqual([1, 2, 3])
  })

  it('Waits for all streams to queue values before returning any', function() {
      var results = []
      var zs = utilities.zipStreams(3, (value) => {
          results.push(value);
      })
      zs.push(0, 'a', true)
      expect(results).toEqual([])

      zs.push(1, 'b', true)
      expect(results).toEqual([])

      zs.push(2, 'c', true)
      expect(results).toEqual(['a', 'b', 'c'])
  })

  it('Sends values in the right order', function() {
      var results = []
      var cmp = (a, b) => a.localeCompare(b)
      var zs = utilities.zipStreams(3, cmp, (value) => {
          results.push(value);
      })
      zs.push(0, 'b', true)
      expect(results).toEqual([])

      zs.push(1, 'a', true)
      expect(results).toEqual([])

      zs.push(2, 'c', true)
      expect(results).toEqual(['a', 'b', 'c'])
  })

  it('Exhausts all buffers when possible', function() {
      var results = []
      var cmp = (a, b) => a.localeCompare(b)
      var zs = utilities.zipStreams(3, cmp, (value) => {
          results.push(value);
      })
      zs.push(0, 'a', true)
      expect(results).toEqual([])

      zs.push(1, 'b')
      zs.push(1, 'c', true)
      expect(results).toEqual([])

      zs.push(2, 'd', true)
      expect(results).toEqual(['a', 'b', 'c', 'd'])
  })

  it('Indicates last value via callback flag', function() {
      var results = []
      var cmp = (a, b) => a.localeCompare(b)
      var zs = utilities.zipStreams(3, cmp, (value) => {
          results.push(value);
      }, () => {
          expect(results[3]).toEqual('d')
      })
      zs.push(0, 'a', true)
      expect(results).toEqual([])

      zs.push(1, 'b')
      zs.push(1, 'c', true)
      expect(results).toEqual([])

      zs.push(2, 'd', true)
      expect(results).toEqual(['a', 'b', 'c', 'd'])
  })
});
