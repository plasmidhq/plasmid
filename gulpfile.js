var gulp = require('gulp');
var fs = require('fs');
var source = require('vinyl-source-stream'); // Used to stream bundle for further handling
var browserify = require('browserify');
var watchify = require('watchify');
var babelify = require('babelify');
var gulpif = require('gulp-if');
var uglify = require('gulp-uglify');
var streamify = require('gulp-streamify');
var notify = require('gulp-notify');
var concat = require('gulp-concat');
var gutil = require('gulp-util');
var rename = require('gulp-rename');
var connect = require('gulp-connect');
var glob = require('glob');
var path = require('path');
var livereload = require('gulp-livereload');
var child_exec = require('child_process').exec;

var spawn = require('child_process').spawn;
var argv = require('yargs')
  .default('port', 8000)
  .default('address', '0.0.0.0')
  .argv;

// External dependencies you do not want to rebundle while developing,
// but include in your application deployment
var dependencies = [
];

var browserifyTask = function (options) {
  var promise;

  // Our app bundler
  var appBundler = browserify({
    entries: [options.src], // Only need initial file, browserify finds the rest
    transform: [babelify], // We want to convert JSX to normal javascript
    debug: options.development, // Gives us sourcemapping
    cache: {}, packageCache: {}, fullPaths: options.development // Requirement of watchify
  });

  // We set our dependencies as externals on our app bundler when developing
  (options.development ? dependencies : []).forEach(function (dep) {
    appBundler.external(dep);
  });

  // The rebundle process
  var rebundle = function () {
    var start = Date.now();
    console.log('Building APP bundle');
    return new Promise(function(resolve, reject) {
      appBundler.bundle()
        .on('error', gutil.log)
        .pipe(source('distribution_shim.js'))
        // .pipe(gulpif(!options.development, streamify(uglify())))
        .pipe(rename('bundle.js'))
        .pipe(gulp.dest(options.dest))
        .pipe(gulpif(options.development, livereload()))
        .pipe(notify(function () {
          console.log('APP bundle built in ' + (Date.now() - start) + 'ms');
          resolve();
        }));
    });
  };

  // Fire up Watchify when developing
  if (options.development) {
    // appBundler = watchify(appBundler);
    // appBundler.on('update', rebundle);
  }

  promise = rebundle();

  // We create a separate bundle for our dependencies as they
  // should not rebundle on file changes. This only happens when
  // we develop. When deploying the dependencies will be included
  // in the application bundle
  if (options.development) {

    var testBundler = browserify({
      debug: true,
      require: dependencies,
      entries: ['test/main.js'], // Only need initial file, browserify finds the rest
    });

    // Run the vendor bundle
    var start = new Date();
    console.log('Building TEST bundle');
    testBundler.bundle()
      .on('error', gutil.log)
      .pipe(source('../test/main.js'))
      // .pipe(streamify(uglify())
      .pipe(rename('testbundle.js'))
      .pipe(gulp.dest('./build/'))
      .pipe(notify(function () {
        console.log('TEST bundle built in ' + (Date.now() - start) + 'ms');
      }));
  }
  return promise;
}

function rebuild(options) {
  var options = options || {};

  return browserifyTask({
    development: options.development,
    src: './src/distribution_shim.js',
    dest: './build/'
  });
}


gulp.task('jsdoc', function (cb) {
  child_exec('node ./node_modules/jsdoc/jsdoc.js -c ./.jsdoc.json -r ./rescue_id/static/js -d ./docs/js/', undefined, cb);
});


gulp.task('default', function (cb) {
  livereload.listen();

  rebuild({
    development: true,
  });

  connect.server();

});

function test(opts) {
  var env = Object.assign(process.env);
  if (opts.detect_browsers) {
    env['KARMA_DETECT_BROWSERS'] = 'TRUE';
  }
  rebuild({
    development: true,
  }).then(function() {
    var runserver = spawn("./node_modules/karma/bin/karma", ["start"], {
      stdio: "inherit",
      env: env,
    });
    runserver.on('close', function(code) {
      if (code !== 0) {
        console.error('Tests exited with error code: ' + code);
      }
    });
  });
}
gulp.task('test', test);

gulp.task('testfull', function() {
  test({
    detect_browsers: true,
  })
})

gulp.task('build', function() {
  rebuild({
    development: true,
  })
});

gulp.task('deploy', function() {
  var package = JSON.parse(fs.readFileSync('./package.json'));
  rebuild({
    development: false,
  }).then(function(){
    gulp.src('./build/bundle.js')
      .pipe(rename('plasmid-' + package.version + '.js'))
      .pipe(gulp.dest('./dist/'));
    gulp.src('./build/bundle.js')
      .pipe(streamify(uglify()))
      .pipe(rename('plasmid-' + package.version + '-min.js'))
      .pipe(gulp.dest('./dist/'));
  });
});
