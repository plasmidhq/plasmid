'use strict';

define(['promise'], function(promise) {
  describe('Utility: Events', function () {

    // Initialize the controller and a mock scope
    beforeEach(function () {
    });

    it('fires pre-bind triggers, once', function () {
      var o = new promise.EventListener()
      ,   r = 0
      ;
      o.trigger('X');
      o.on('X', function() {
        r += 1;
      });
      o.on('X', function() {
        r += 1;
      });
      expect(r).toBe(1);
    });
  });
});
