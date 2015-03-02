var _ = require('underscore'),
    browserify = require('browserify'),
    gulp = require('gulp'),
    livereload = require('gulp-livereload'),
    peg = require('gulp-peg'),
    reactify = require('reactify'),
    source = require('vinyl-source-stream'),
    uglifyify = require('uglifyify'),
    watchify = require('watchify');


var PATHS = {
  src: [  // the files being compiled
      './cycledash/static/js/examine/examine.js',
      './cycledash/static/js/runs/runs.js'
  ],
  dest: './cycledash/static/js/dist/',  // Where the compiled JS bundle will go
  js: ['cycledash/static/js/*.js'],  // All of the JS files we want to watch for changes
  css: ['./cycledash/static/css/*.css'],  // The CSS we want to watch for changes
  pegGrammar: './grammars/querylanguage.pegjs',
  polyfills: [
    './node_modules/es5-shim/es5-shim.min.js',
    './node_modules/es5-shim/es5-sham.min.js'
  ]  // polyfills
};

var REACT_OPTS = {es6: true},
    BROWSERIFY_OPTS =  _.extend({entries: PATHS.src, debug: true}, watchify.args);


// Generates compiled JS bundle, automatically recompiling and reloading the
// browser (by notifying the livereload server, listened to by the js included
// in the layout.html template in USE_RELOADER mode).
//
// Runs JSX, ES6 transforms, browserify, adds sourcemaps, and notifies the
// livereload server that JS has changed.
gulp.task('js', function() {
  var bundler = watchify(browserify(BROWSERIFY_OPTS));

  function rebundle() {
    return bundler
      .transform(_.extend({debug: true}, REACT_OPTS), reactify)
      .on('error', function(e) { console.log(e); })
      .bundle()
      .on('error', function(e) { console.log(e.message); })
      .pipe(source('bundled.js'))
      .pipe(gulp.dest(PATHS.dest))
      .pipe(livereload({ auto: false })); // Because the 'watch' task has
                                          // already started a livereload server.
  }

  rebundle();
  bundler.on('update', rebundle);
});

// Notifies livereload server to reload the browser when CSS changes.
gulp.task('css', function() {
  livereload.changed();
});

// Starts the livereload server and runs the 'js' and 'css' tasks, above.
gulp.task('watch', function() {
  livereload.listen();
  gulp.watch(PATHS.js, ['js']);
  gulp.watch(PATHS.css, ['css']);
});

// Task which builds the production-ready JS.
// Minified, polyfilled, JSX & ES6, and browserified.
gulp.task('build', function() {
  process.env.NODE_ENV = 'production';
  var srcs = PATHS.polyfills.concat(PATHS.src);
  return browserify(srcs)
    .transform(REACT_OPTS, reactify)
    .transform({global: true}, uglifyify) // Global: true indicates that uglify
                                          // will minify all of the module code.
    .bundle()
    .pipe(source('bundled.js'))
    .pipe(gulp.dest(PATHS.dest));
});

// Copy over prebuilt Biodalliance files from node_modules.
gulp.task('dalliance', function() {
  gulp.src('./node_modules/dalliance/{css,fonts,img,help}/*.*',
           {base: './node_modules/dalliance'})
    .pipe(gulp.dest('./cycledash/static/dalliance'));

  gulp.src('./node_modules/dalliance/build/*.js',
           {base: './node_modules/dalliance/build'})
    .pipe(gulp.dest('./cycledash/static/dalliance'));
});

// Copy over prebuilt bootstrap files from node_modules.
gulp.task('bootstrap', function() {
  gulp.src('./node_modules/bootstrap/dist/**/*',
           {base: './node_modules/bootstrap/dist'})
    .pipe(gulp.dest('./cycledash/static/lib/bootstrap'));
});

gulp.task('peg', function() {
  gulp.src(PATHS.pegGrammar)
      .pipe(peg().on('error', console.error))
      .pipe(gulp.dest('./cycledash/static/lib'));
});


// Default task which compiles the JS and then watches the JS and CSS for
// changes.
gulp.task('default', ['watch', 'js']);

// Build production resources and copy them into the serving directory.
gulp.task('prod', ['peg', 'build', 'dalliance', 'bootstrap']);

gulp.task('help', function() {
  console.log([
      '',
      'The following tasks may be run:',
      '  default    -- generates development JS and listens, refreshing',
      '                the browser upon CSS or JS source changes.',
      '  prod       -- all resources needed for production deployment.',
      '  build      -- compile production-ready JS',
      '  dalliance  -- Move biodalliance JS/CSS into place',
      '  bootstrap  -- Move bootstrap JS/CSS into place',
      ''].join('\n'));
});
