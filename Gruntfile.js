'use strict';
var lrSnippet = require('grunt-contrib-livereload/lib/utils').livereloadSnippet;
var mountFolder = function (connect, dir) {
  return connect.static(require('path').resolve(dir));
};
var package_config = require('./package');

module.exports = function (grunt) {
  // load all grunt tasks
  require('matchdep').filterDev('grunt-*').forEach(grunt.loadNpmTasks);
  grunt.loadNpmTasks('grunt-contrib-requirejs');

  // configurable paths
  var yeomanConfig = {
    name: package_config.name,
    version: package_config.version,
    src: 'src',
    dist: 'dist'
  };

  try {
    yeomanConfig.src = require('./component.json').appPath || yeomanConfig.src;
  } catch (e) {}

  grunt.initConfig({
    yeoman: yeomanConfig,
    watch: {
      livereload: {
        files: [
          '<%= yeoman.src %>/{,*/}*.html',
          '{.tmp,<%= yeoman.src %>}/styles/{,*/}*.css',
          '{.tmp,<%= yeoman.src %>}/scripts/{,*/}*.js',
          '<%= yeoman.src %>/images/{,*/}*.{png,jpg,jpeg,gif,webp,svg}'
        ],
        tasks: ['livereload']
      }
    },
    connect: {
      options: {
        port: 9000,
        // Change this to '0.0.0.0' to access the server from outside.
        hostname: 'localhost'
      },
      livereload: {
        options: {
          middleware: function (connect) {
            return [
              lrSnippet,
              mountFolder(connect, '.tmp'),
              mountFolder(connect, yeomanConfig.src)
            ];
          }
        }
      },
      test: {
        options: {
          middleware: function (connect) {
            return [
              mountFolder(connect, '.tmp'),
              mountFolder(connect, 'test')
            ];
          }
        }
      }
    },
    open: {
      server: {
        url: 'http://localhost:<%= connect.options.port %>'
      }
    },
    clean: {
      dist: {
        files: [{
          dot: true,
          src: [
            '.tmp',
            '<%= yeoman.dist %>/*',
            '!<%= yeoman.dist %>/.git*'
          ]
        }]
      },
      server: '.tmp'
    },
    jshint: {
      options: {
        jshintrc: '.jshintrc'
      },
      all: [
        'Gruntfile.js',
        '<%= yeoman.src %>/{,*/}*.js'
      ]
    },
    karma: {
      unit: {
        configFile: 'karma.conf.js',
        singleRun: true
      }
    },
    requirejs: {
      compile: {
        options: {
          baseUrl: "<%= yeoman.src %>/",
          mainConfigFile: "build.js",
          name: "plasmid",
          include: [],
          out: "dist/<%= yeoman.name %>-<%= yeoman.version %>-modules.js"
        }
      }
    },
    concat: {
      combine: {
        files: {
          '<%= yeoman.dist %>/<%= yeoman.name %>-<%= yeoman.version %>.js': [
            'static/require.js',
            '.tmp/{,*/}*.js',
            "dist/<%= yeoman.name %>-<%= yeoman.version %>-modules.js"
          ]
        }
      }
    },
    uglify: {
      dist: {
        files: {
          '<%= yeoman.dist %>/<%= yeoman.name %>-<%= yeoman.version %>.min.js': [
            '<%= yeoman.dist %>/<%= yeoman.name %>-<%= yeoman.version %>.js'
          ]
        }
      }
    },
    copy: {
      dist: {
        files: [{
          expand: true,
          dot: true,
          cwd: '<%= yeoman.src %>',
          dest: '<%= yeoman.dist %>',
          src: [
          ]
        }]
      }
    }
  });

  grunt.renameTask('regarde', 'watch');

  grunt.registerTask('server', [
    'clean:server',
    'livereload-start',
    'connect:livereload',
    'open',
    'watch'
  ]);

  grunt.registerTask('test', [
    'clean:server',
    'connect:test',
    'karma'
  ]);

  grunt.registerTask('build', [
    'clean:dist',
    //'jshint',
    'test',
    'requirejs',
    'concat:combine',
    'copy',
    'uglify',
  ]);

  grunt.registerTask('default', ['build']);
};
