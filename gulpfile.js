var _ = require('underscore'),
    browserify = require('browserify'),
    gulp = require('gulp'),
    livereload = require('gulp-livereload'),
    livereactload = require('livereactload'),
    peg = require('gulp-peg'),
    reactify = require('reactify'),
    source = require('vinyl-source-stream'),
    uglifyify = require('uglifyify'),
    watchify = require('watchify'),
    sass = require('gulp-sass'),
    ext_replace = require('gulp-ext-replace'),
    es = require('event-stream');


var PATHS = {
  src: [  // the files being compiled
      './cycledash/static/js/examine/examine.js',
      './cycledash/static/js/runs/runs.js',
      './cycledash/static/js/comments/comments.js'
  ],
  dest: './cycledash/static/js/dist/',  // Where the compiled JS bundle will go
  js: ['cycledash/static/js/*.js'],  // All of the JS files we want to watch for changes
  sass: ['./cycledash/static/scss/*.scss'],  // The SASS we want to watch for changes
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
  livereactload.monitor(PATHS.dest + 'bundled.js')

  var bundler = watchify(browserify(_.extend({transform: [livereactload]}, BROWSERIFY_OPTS)));

  function rebundle() {
    return bundler
      .transform(_.extend({debug: true}, REACT_OPTS), reactify)
      .on('error', function(e) { console.log(e); })
      .bundle()
      .on('error', function(e) { console.log(e.message); })
      .pipe(source('bundled.js'))
      .pipe(gulp.dest(PATHS.dest));
  }

  rebundle();
  return bundler.on('error', console.log).on('update', rebundle);
});

gulp.task('sass', ['staticlibs'], function () {
  return gulp.src('./cycledash/static/scss/*.scss')
        .pipe(sass.sync().on('error', sass.logError))
        .pipe(gulp.dest('./cycledash/static/css'))
        .pipe(livereload({ auto: false }));
});

// Starts the livereload server and runs the 'js' and 'sass' tasks, above.
gulp.task('watch', function() {
  livereload.listen();
  gulp.watch(PATHS.sass, ['sass']);
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

gulp.task('peg', function() {
  return gulp.src(PATHS.pegGrammar)
      .pipe(peg().on('error', console.error))
      .pipe(gulp.dest('./cycledash/static/lib'));
});

gulp.task('staticlibs', function() {
  // These subtasks all run in parallel.
  return es.merge([
    // jQuery
    gulp.src('./node_modules/jquery/dist/*.{js,map}',
             {base: './node_modules/jquery/dist'})
      .pipe(gulp.dest('./cycledash/static/lib/jquery')),

    // Bootstrap
    gulp.src('./node_modules/bootstrap/dist/**/*',
             {base: './node_modules/bootstrap/dist'})
      .pipe(gulp.dest('./cycledash/static/lib/bootstrap')),

    // Change bootstrap.min.css to bootstrap.min.scss
    gulp.src('./cycledash/static/lib/bootstrap/css/bootstrap.min.css')
      .pipe(ext_replace('.scss', '.min.css'))
      .pipe(gulp.dest('./cycledash/static/lib/bootstrap/scss')),

    // pileup.js
    gulp.src('./node_modules/pileup/style/*.*',
             {base: './node_modules/pileup/style'})
       .pipe(gulp.dest('./cycledash/static/lib/pileup.js')),
    gulp.src('./node_modules/pileup/build/*.js',
             {base: './node_modules/pileup/build'})
      .pipe(gulp.dest('./cycledash/static/lib/pileup.js'))
  ]);
});




// Default task which compiles the JS and then watches the JS and CSS for
// changes.
gulp.task('default', ['watch', 'js', 'sass']);

// Build production resources and copy them into the serving directory.
gulp.task('prod', ['peg', 'build', 'staticlibs', 'sass']);

gulp.task('help', function() {
  console.log([
      '',
      'The following tasks may be run:',
      '  default    -- generates development JS and listens, refreshing',
      '                the browser upon CSS or JS source changes.',
      '  prod       -- all resources needed for production deployment.',
      '  build      -- compile production-ready JS',
      '  staticlibs -- Move third-party static content into place',
      ''].join('\n'));
});
