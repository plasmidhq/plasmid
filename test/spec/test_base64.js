'use strict';

var Base64 = require('../../src/base64.js');

describe('Utility: Base64', function () {

  // Initialize the controller and a mock scope
  beforeEach(function () {
  });

  it('should decode its own data', function () {
    var encoded = Base64.encode('test');
    var decoded = Base64.decode(encoded);
    expect(decoded).toBe('test');
  });

  it('should handle all bytes', function () {
    var data = [];
    for (var i=0; i<256; i++) {
      data.push( String.fromCharCode(i) );
    }
    data = data.join('');
    var encoded = Base64.encode(data);
    var decoded = Base64.decode(encoded);
    expect(decoded).toBe(data);
  });
});
