var gulp = require('gulp'),
    livereload = require('gulp-livereload'),
    browserify = require('browserify'),
    watchify = require('watchify'),
    reactify = require('reactify'),
    uglifyify = require('uglifyify'),
    source = require('vinyl-source-stream'),
    mocha = require('gulp-mocha'),
    _ = require('underscore');


var PATHS = {
  examineSrc: ['./cycledash/static/js/examine/ExaminePage.js'], // the File being compiled.
  examineDest: './cycledash/static/js/dist/', // Where the compiled JS bundle will go.
  examineJs: ['cycledash/static/js/*.js'], // All of the JS files we want to watch for changes.
  css: ['./cycledash/static/css/*.css'] // The CSS we want to watch for changes.
};

var REACT_OPTS = {es6: true},
    BROWSERIFY_OPTS =  _.extend({entries: PATHS.examineSrc, debug: true}, watchify.args)


// Runs our React.js transpiler on our tests and the code it'll be testing, then
// runs our mocha tests.
gulp.task('test', function() {
  return browserify(['./test/vcf.tools.test.js'])
    .transform(REACT_OPTS, reactify)
    .bundle()
    .pipe(source('tests.bundled.js'))
    .pipe(gulp.dest('./test'))
    .pipe(mocha());
});

// Generates compiled JS bundle, automatically recompiling and reloading the
// browser (by notifying the livereload server, listened to by the js included
// in the layout.html template in DEBUG mode).
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
      .pipe(source('bundled.js'))
      .pipe(gulp.dest(PATHS.examineDest))
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
  gulp.watch(PATHS.examineJs, ['js']);
  gulp.watch(PATHS.css, ['css']);
});

// Default task which compiles the JS and then watches the JS and CSS for
// changes.
gulp.task('default', ['watch', 'js', 'copydalliance']);

// Task which builds the production-ready JS.
// Minified, JSX & ES6, and browserified.
gulp.task('build', function() {
  return browserify(PATHS.examineSrc)
    .transform(REACT_OPTS, reactify)
    .transform({global: true}, uglifyify) // Global: true indicates that uglify
                                          // will minify all of the module code.
    .bundle()
    .pipe(source('bundled.js'))
    .pipe(gulp.dest(PATHS.examineDest))
});

// Copy over prebuilt Biodalliance files from node_modules.
gulp.task('copydalliance', function() {
  gulp.src('./node_modules/dalliance/{css,fonts,img}/*.*',
           {base: './node_modules/dalliance'})
    .pipe(gulp.dest('./cycledash/static/dalliance'));

  gulp.src('./node_modules/dalliance/build/*.js',
           {base: './node_modules/dalliance/build'})
    .pipe(gulp.dest('./cycledash/static/dalliance'));
});

gulp.task('help', function() {
  console.log();
  console.log("The following tasks may be run:");
  console.log("  default  -- generates development JS and listens, refreshing the");
  console.log("              browser upon CSS or JS source changes.");
  console.log("  build    -- compiles production-ready JS");
  console.log();
});
