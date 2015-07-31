var _ = require('lodash');

module.exports = function (grunt) {
  'use strict';

  grunt.loadNpmTasks('grunt-angular-gettext');

  function getCurrentPlugins() {
    var plugins = grunt.config('localplugins') || [];
    return _.filter(plugins, '__isCurrent');
  }

  function coreExtractLocalesTemplate() {
    var ngGetTextExtractTask = {
      task: 'nggettext_extract',
      target: 'core',
      config: {
        files: {
          'app/locales/locales.pot': [
            'app/scripts/ui/**/*.html',
            'app/scripts/ui/**/*.js',
            'app/scripts/core/**/*.html',
            'app/scripts/core/**/*.js'
          ]
        }
      }
    };
    grunt.config(ngGetTextExtractTask.task + '.' + ngGetTextExtractTask.target, ngGetTextExtractTask.config);
    grunt.task.run(ngGetTextExtractTask.task + ':' + ngGetTextExtractTask.target);
  }

  function pluginExtractLocalesTemplate(pluginContextPath) {
    if (pluginContextPath === 'all') {
      _.forEach(getCurrentPlugins(), function (p) {
        grunt.task.run('extractLocales:' + p.contextPath);
      });
      return;
    }

    var pluginPath = '<%= paths.plugins %>/' + pluginContextPath + '/',
      ngGetTextExtractTask = {
        task: 'nggettext_extract',
        target: 'plugin_' + pluginContextPath,
        outputFile: pluginPath + 'locales/locales.pot',
        inputFiles: [
          pluginPath + '**/*.html',
          pluginPath + '**/*.js'
        ],
        config: {
          files: {}
        }
      };

    ngGetTextExtractTask.config.files[ngGetTextExtractTask.outputFile] = ngGetTextExtractTask.inputFiles;
    grunt.config(ngGetTextExtractTask.task + '.' + ngGetTextExtractTask.target, ngGetTextExtractTask.config);
    grunt.task.run(ngGetTextExtractTask.task + ':' + ngGetTextExtractTask.target);
  }

  grunt.registerTask('extractLocalesCore', 'Extracts translations from core', coreExtractLocalesTemplate);
  grunt.registerTask('extractLocales', 'Extracts translations from plugin', pluginExtractLocalesTemplate);
  grunt.registerTask('extractLocalesAll', 'Extract locales from core and all plugins', [
    'readManifests',
    'extractLocalesCore',
    'extractLocales:all'
  ]);
};
