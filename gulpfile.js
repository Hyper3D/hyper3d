/*jslint node: true */ // allow 'require' global
'use strict';

var gulp = require('gulp'),
  concat = require('gulp-concat'),
  concatUtil = require('gulp-concat-util'),
  del = require('del'),
  util = require('gulp-util'),
  es = require('event-stream'),
  ts = require('gulp-typescript'),
  less = require('gulp-less'),
  bump = require('gulp-bump'),
  git = require('gulp-git'),
  es = require('event-stream'),
  through = require('through2'),
  hyperShaders = require('./tools/gulp-hyper-shaders'),
  mainBowerFiles = require('main-bower-files'),
  filter = require('gulp-filter'),
  tagVersion = require('gulp-tag-version'),
  inquirer = require('inquirer'),
  path = require('path');

var sources = {
  lib: {
    js: ['./src/**/*.js'],
    tsd: ['./src/*.d.ts'],
    ts: ['./src/**/*.ts', '!./src/*.d.ts'],
    tsMain: ['./src/renderer/public/*.ts'],
    shaders: ['./src/renderer/shaders/**/*.glsl']
  }
};
var shaderTemplateSource = './src/renderer/shaders/ShadersTemplate.txt';

var destinations = {
  pub_js: './dist/',
  pub_lib: './dist/lib/'
};

gulp.task('dep:lib', function() {
  gulp.src(mainBowerFiles()).pipe(gulp.dest(destinations.pub_lib));
});

function addSource(inp) {
  var p = through.obj();
  return es.duplex(p, es.merge(inp, p));
}

gulp.task('js:lib', function() {
  var tsProject = ts.createProject('tsconfig.json', {
    sortOutput: true,
    out: 'hyper3d.js'
  });
  
  var tsFiles = gulp.src(sources.lib.tsMain);
    
  var shaderChunks = gulp.src(sources.lib.shaders)
    .pipe(hyperShaders(shaderTemplateSource ));
    
  var tsStream = tsFiles
    .pipe(addSource(shaderChunks))
    .pipe(ts(tsProject));

  return es.merge(
    tsStream.dts.pipe(gulp.dest(destinations.pub_js)),
    tsStream.js
    .pipe(concatUtil.header('(function(Hyper){\n"use strict";\n'))
    .pipe(concatUtil.footer('})(this.Hyper = this.Hyper || {});'))
    .pipe(gulp.dest(destinations.pub_js)),
    gulp.src(
      sources.lib.js,
      { base: 'src' }
    )
    .pipe( gulp.dest(destinations.pub_js) ),
    gulp.src(
      sources.lib.tsd,
      { base: 'src' }
    )
    .pipe( gulp.dest(destinations.pub_js) )
  );
});

// deletes the dist folder for a clean build
gulp.task('clean', function() {
  del(['./dist'], function(err, deletedFiles) {
    if(deletedFiles.length) {
      util.log('Deleted', util.colors.red(deletedFiles.join(' ,')) );
    } else {
      util.log(util.colors.yellow('/dist directory empty - nothing to delete'));
    }
  });
});

gulp.task('build', [
  'js:lib',
  'dep:lib'
]);

gulp.task('bump', function() {

  var questions = [
    {
      type: 'input',
      name: 'bump',
      message: 'Are you sure you want to bump the patch version? [Y/N]'
    }
  ];

  inquirer.prompt( questions, function( answers ) {
    if(answers.bump === 'Y') {

      return gulp.src(['./package.json', './bower.json'])
          .pipe(bump({type: 'patch'}))
          .pipe(gulp.dest('./'))
          .pipe(git.commit('bump patch version'))
          .pipe(filter('package.json'))  // read package.json for the new version
          .pipe(tagVersion());           // create tag

    }
  });
});

// watch scripts, styles, and templates
gulp.task('watch', function() {
  gulp.watch(sources.lib.ts, ['js:lib']);
  gulp.watch(sources.lib.js, ['js:lib']);
  gulp.watch(sources.lib.shaders, ['js:lib']);
  gulp.watch([shaderTemplateSource], ['js:lib']);
  gulp.watch(mainBowerFiles().concat(['bower.json']), ['dep:lib']);
});

// default
gulp.task('default', ['build', 'watch']);
