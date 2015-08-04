var _ = require('lodash');

module.exports = function (grunt) {
  'use strict';

  grunt.loadNpmTasks('grunt-angular-gettext');

  function getCurrentPlugins() {
    var plugins = grunt.config('localplugins') || [];
    return _.filter(plugins, '__isCurrent');
  }

  function coreExtractLocalesTemplate() {
    if (!grunt.file.exists('app/scripts')) {
      return;
    }

    var target = 'core',
      config = {
        files: {
          'app/locales/locales.pot': [
            'app/scripts/ui/**/*.html',
            'app/scripts/ui/**/*.js',
            'app/scripts/core/**/*.html',
            'app/scripts/core/**/*.js'
          ]
        }
      };

    extractLocales(target, config);
  }

  function pluginExtractLocalesTemplate(pluginContextPath) {
    if (pluginContextPath === 'all') {
      runTaskForAllPlugins('extractLocales');
      return;
    }

    var pluginPath = '<%= paths.plugins %>/' + pluginContextPath + '/',
      target = 'plugin_' + pluginContextPath,
      outputFile = pluginPath + 'locales/locales.pot',
      inputFiles = [
        pluginPath + '**/*.html',
        pluginPath + '**/*.js'
      ],
      config = {
        files: {}
      };

    config.files[outputFile] = inputFiles;
    extractLocales(target, config);
  }

  function extractLocales(target, config) {
    runTaskTargetWithConfig('nggettext_extract', target, config);
  }

  function coreCompileLocales() {
    compileLocales('core', 'app/', '<%= paths.temp %>/');
  }

  function pluginCompileLocales(pluginContextPath) {
    if (pluginContextPath === 'all') {
      runTaskForAllPlugins('compileLocales');
      return;
    }
    var srcPath = '<%= paths.plugins %>/' + pluginContextPath + '/',
      destPath = '<%= paths.temp %>/plugins/' + pluginContextPath + '/';

    compileLocales('plugin_' + pluginContextPath, srcPath, destPath);
  }

  function compileLocales(target, srcPath, destPath) {
    var task = 'nggettext_compile',
      config = {
        options: {
          format: 'json'
        },
        files: [{
          expand: true,
          dot: true,
          cwd: srcPath + 'locales/po',
          dest: destPath + 'locales/json',
          src: ['*.po'],
          ext: '.json'
        }]
      };

    runTaskTargetWithConfig(task, target, config);
  }

  function runTaskTargetWithConfig(task, target, config) {
    grunt.config(task + '.' + target, config);
    grunt.task.run(task + ':' + target);
  }

  function runTaskForAllPlugins(taskName) {
    _.forEach(getCurrentPlugins(), function (p) {
      grunt.task.run(taskName + ':' + p.contextPath);
    });
  }

  grunt.registerTask('extractLocalesCore', 'Extracts translations from core', coreExtractLocalesTemplate);
  grunt.registerTask('extractLocales', 'Extracts translations from plugin', pluginExtractLocalesTemplate);
  grunt.registerTask('extractLocalesAll', 'Extract locales from core and all plugins', [
    'readManifests',
    'extractLocalesCore',
    'extractLocales:all'
  ]);

  grunt.registerTask('compileLocalesCore', 'Compiles .po files to .json files in core', coreCompileLocales);
  grunt.registerTask('compileLocales', 'Compiles .po files to .json files in plugin', pluginCompileLocales);
  grunt.registerTask('compileLocalesAll', 'Compiles .po files to .json files in core and all plugins', [
    'readManifests',
    'compileLocalesCore',
    'compileLocales:all'
  ]);
};
