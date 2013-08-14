// Karma configuration

// base path, that will be used to resolve files and exclude
basePath = '';

// list of files / patterns to load in the browser
files = [
  JASMINE,
  JASMINE_ADAPTER,
  REQUIRE,
  REQUIRE_ADAPTER,

  {pattern: 'src/*.js', included: false},
  {pattern: 'src/**/*.js', included: false},

  {pattern: 'test/util/*.js'},

  {pattern: 'test/spec/test_*.js', included: false},

  'test/main.js',
];

// list of files to exclude
exclude = [];

// test results reporter to use
// possible values: dots || progress || growl
reporters = ['progress'];

// web server port
port = 8080;

// cli runner port
runnerPort = 9100;

// enable / disable colors in the output (reporters and logs)
colors = true;

// level of logging
// possible values: LOG_DISABLE || LOG_ERROR || LOG_WARN || LOG_INFO || LOG_DEBUG
logLevel = LOG_INFO;

// enable / disable watching file and executing tests whenever any file changes
autoWatch = false;

// Start these browsers, currently available:
// - Chrome
// - ChromeCanary
// - Firefox
// - Opera
// - Safari (only Mac)
// - PhantomJS
// - IE (only Windows)

browsers = [
    'Firefox',
];
var isWin = !!process.platform.match(/^win/);
if (isWin) {
    browsers.push('IE');
    browsers.push('Chrome');
} else {
    browsers.push('/usr/bin/chromium-browser');
}

// If browser does not capture in given timeout [ms], kill it
captureTimeout = 30000;

// Continuous Integration mode
// if true, it capture browsers, run tests and exit
singleRun = false;