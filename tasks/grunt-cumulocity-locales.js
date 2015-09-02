module.exports = function (grunt) {
  'use strict';

  var c8yRequest = require('../lib/c8yRequest')(grunt),
    c8yUtil = require('../lib/c8yUtil')(grunt),
    Q = require('q'),
    _ = require('lodash');

  grunt.loadNpmTasks('grunt-angular-gettext');

  var pluginsPathApp = [],
    allPlugins;

  function getPluginsPathApp(imports) {
    _.forEach(imports, function (i) {
      var plugin = findPlugin(i);
      if(plugin && !_.contains(pluginsPathApp, plugin.__dirname)) {
        pluginsPathApp = _.union(pluginsPathApp, buildPluginPath(plugin.__dirname));
        getPluginsPathApp(plugin.imports);
      }
    });
    return pluginsPathApp;
  }

  function buildPluginPath(path) {
    return [
      path + '/**/*.html',
      path + '/**/*.js'
    ];
  }

  function findPlugin(plugin) {
    return _.find(allPlugins, function(p) {
      return plugin === p.__rootContextPath;
    });
  }

  function getCurrentPlugins() {
    var plugins = grunt.config('localplugins') || [];
    return _.filter(plugins, '__isCurrent');
  }

  function appExtractLocalesTemplate() {
    if (grunt.file.exists('app/scripts')) {
      return;
    }

    allPlugins = grunt.config('localplugins');

    if (!allPlugins) {
      grunt.task.run('readManifests');
      grunt.task.run('appExtractLocalesTemplate');
      return;
    }


    var currentApp = grunt.file.readJSON('./cumulocity.json'),
      appImports = currentApp.imports,
      target = 'app',
      config = {
        files: {
          'locales/locales.pot': getPluginsPathApp(appImports)
        }
      };
    extractLocales(target, config);
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
          dest: destPath + 'locales',
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

  function localizeApp(credentials, appContextPath, languageCodePO) {
    if (!appContextPath) {
      grunt.fail.fatal('Missing application context path!');
    }

    c8yRequest.setCredentials(credentials);
    return c8yRequest.get('application/applications?pageSize=1000')
      .then(_.partial(findAppByContextPath, appContextPath))
      .then(copyOrUpdateManifest)
      .then(_.partialRight(createOrUpdateI18nPlugins, languageCodePO));
  }

  function findAppByContextPath(contextPath, apps) {
    return _.find(apps.applications, function (app) {
      return app.contextPath === contextPath;
    });
  }

  function copyOrUpdateManifest(app) {
    var baseManifestPath = 'cumulocity.json',
      baseManifest = grunt.file.readJSON(baseManifestPath),
      originalAppContextPath = app.contextPath,
      existingAppManifestPath = 'cumulocity.' + originalAppContextPath + '.json',
      existingAppManifest = grunt.file.exists(existingAppManifestPath) ? grunt.file.readJSON(existingAppManifestPath) : {},
      originalAppManifest = _.extend({}, existingAppManifest),
      appsWithI18n = [];
  
    if (!app) {
      grunt.log.fail('Could not get manifest for requested app!');
      return appsWithI18n;
    }

    if (!existingAppManifest.contextPath) {
      app.name = app.name || app.contextPath;
      app.name += ' I18N';
      app.contextPath += '-i18n';
      app.key = app.contextPath + '-application-key';
      app.availability = 'PRIVATE';
      app.resourcesUrl = baseManifest.resourcesUrl;
      app.resourcesUsername = baseManifest.resourcesUsername;
      app.resourcesPassword = baseManifest.resourcesPassword;
      app.imports = app.manifest.imports || [];
      app.noAppSwitcher = !!app.manifest.noAppSwitcher;
      app.tabsHorizontal = !!app.manifest.tabsHorizontal;
      delete app.id;
      delete app.owner;
      delete app.self;
      delete app.manifest;
    } else {
      existingAppManifest.imports = app.manifest.imports || [];
      app = existingAppManifest;
      delete app.manifest;
    }
    if (originalAppContextPath !== 'core') {
      addImport(app.imports, baseManifest.contextPath, 'i18n-core');
      appsWithI18n.push('core');
    }
    addImport(app.imports, baseManifest.contextPath, 'i18n-' + originalAppContextPath);
    appsWithI18n.push(originalAppContextPath);
    grunt.file.write(existingAppManifestPath, JSON.stringify(app, null, 2));
    if (!_.isEqual(originalAppManifest, app)) {
      grunt.log.warn('Note: Updated manifest for ' + app.contextPath + ' app!');
      grunt.log.warn('You will need to register it.');
    }
    return appsWithI18n;
  }

  function addImport(imports, app, plugin) {
    var pluginImport = [app, '/', plugin].join('');
    if (!_.contains(imports, pluginImport)) {
      imports.push(pluginImport);
    }
  }
  
  function createOrUpdateI18nPlugins(appsWithI18n) {
    var promises = [];
    _.each(appsWithI18n, function (appContextPath) {
      promises.push(createOrUpdateI18nPlugin(appContextPath));
    });
    return Q.all(promises);
  }

  function createOrUpdateI18nPlugin(appContextPath) {
    var promises = [];
    if (!grunt.file.exists('plugins/i18n-' + appContextPath)) {
      var pluginManifest = {
        name: appContextPath + ' - translations',
        description: 'Translation plugin for ' + appContextPath + ' app',
        languages: []
      };
      grunt.file.write('plugins/i18n-' + appContextPath + '/cumulocity.json', JSON.stringify(pluginManifest, null, 2));
      grunt.log.ok('Created manifest for plugin: ' + 'i18n-' + appContextPath +  '.');
      promises.push(
        c8yRequest.get('apps/c8ydata/locales/' + appContextPath + '.pot')
        .then(function (contents) {
          grunt.file.write('plugins/i18n-' + appContextPath + '/locales/locales.pot', contents);
          grunt.log.ok('Downloaded translation template for ' + 'i18n-' + appContextPath + ' plugin: locales/locales.pot');
        }, function (err) {
          grunt.log.fail('Could not download translation template for ' + 'i18n-' + appContextPath + ' plugin!');
        })
      );
      grunt.file.mkdir('plugins/i18n-' + appContextPath + '/locales/po');
      grunt.log.ok('Created plugins/i18n-' + appContextPath + '/locales/po for translation files.');
    } else {
      var pluginManifest = grunt.file.readJSON('plugins/i18n-' + appContextPath + '/cumulocity.json');
      promises.push(
        c8yRequest.get('apps/c8ydata/locales/' + appContextPath + '.pot')
        .then(function (contents) {
          var originalContents = grunt.file.read('plugins/i18n-' + appContextPath + '/locales/locales.pot');
          if (!_.isEqual(originalContents, contents)) {
            grunt.file.write('plugins/i18n-' + appContextPath + '/locales/locales.pot', contents);
            grunt.log.warn('Downloaded updated translation template for ' + 'i18n-' + appContextPath + ' plugin: locales/locales.pot');
          } else {
            grunt.log.ok('No newer translation template available for ' + 'i18n-' + appContextPath + ' plugin.');
          }          
        }, function (err) {
          grunt.log.fail('Could not download translation template for ' + 'i18n-' + appContextPath + ' plugin!');
        })
      );
    }
    return Q.all(promises);
  }

  grunt.registerTask('appExtractLocalesTemplate', 'Extracts translations from application', appExtractLocalesTemplate);

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

  c8yUtil.registerAsync('localizeApp', localizeApp);
};
