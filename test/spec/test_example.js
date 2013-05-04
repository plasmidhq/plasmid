'use strict';

describe('Controller: MainCtrl', function () {

  var a, b, c;

  // Initialize the controller and a mock scope
  beforeEach(function () {
    a = 10;
    b = 5;

    c = 15;
  });

  it('should result in 15', function () {
    expect(add(a, b)).toBe(c);
  });
});
