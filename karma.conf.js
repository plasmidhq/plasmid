// Karma configuration
// Generated on Fri Apr 01 2016 21:37:58 GMT-0400 (EDT)

var frameworks = ['jasmine', 'browserify'];
if (process.env.KARMA_DETECT_BROWSERS) {
  frameworks.push('detectBrowsers');
}

module.exports = function(config) {
  config.set({

    // base path that will be used to resolve all patterns (eg. files, exclude)
    basePath: '',

    // frameworks to use
    // available frameworks: https://npmjs.org/browse/keyword/karma-adapter
    frameworks: frameworks,

    // list of files / patterns to load in the browser
    files: [
      'build/bundle.js',
      'build/testbundle.js'
    ],

    // list of files to exclude
    exclude: [
    ],


    // preprocess matching files before serving them to the browser
    // available preprocessors: https://npmjs.org/browse/keyword/karma-preprocessor
    preprocessors: {
      '**/*.js': ['sourcemap']
    },

    browserify: {
     debug: true,
     transform: [ ]
   },

   postDetection: function(availableBrowser) {
      var result = availableBrowser;

      //Remove PhantomJS if another browser has been detected
      if (availableBrowser.length > 1 && availableBrowser.indexOf('PhantomJS')>-1) {
        var i = result.indexOf('PhantomJS');

        if (i !== -1) {
          result.splice(i, 1);
        }
      }

      return result;
    },

    // test results reporter to use
    // possible values: 'dots', 'progress'
    // available reporters: https://npmjs.org/browse/keyword/karma-reporter
    reporters: ['spec'],


    // web server port
    port: 9876,


    // enable / disable colors in the output (reporters and logs)
    colors: true,


    // level of logging
    // possible values: config.LOG_DISABLE || config.LOG_ERROR || config.LOG_WARN || config.LOG_INFO || config.LOG_DEBUG
    logLevel: config.LOG_INFO,


    // enable / disable watching file and executing tests whenever any file changes
    autoWatch: false,


    // start these browsers
    // available browser launchers: https://npmjs.org/browse/keyword/karma-launcher
    browsers: ['Chrome'],


    // Continuous Integration mode
    // if true, Karma captures browsers, runs the tests and exits
    singleRun: true,

    // Concurrency level
    // how many browser should be started simultaneous
    concurrency: 1
  })
}
