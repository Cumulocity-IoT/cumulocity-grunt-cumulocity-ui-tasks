module.exports = function (grunt) {
  'use strict';

  var c8yRequest = require('../lib/c8yRequest')(grunt),
    c8yUtil = require('../lib/c8yUtil')(grunt),
    Q = require('q'),
    JSONPath = require('JSONPath'),
    _ = require('lodash');

  grunt.loadNpmTasks('grunt-angular-gettext');

  function getCurrentPlugins() {
    var plugins = grunt.config('localplugins') || [];
    return _.filter(plugins, '__isCurrent');
  }

  function appExtractLocalesTemplate(appContextPath) {
    var app = grunt.config('currentlocalapp'),
      dataApp;

    if (!app) {
      grunt.task.run('readManifests');
      grunt.task.run('extractLocalesApp' + (appContextPath ? (':' + appContextPath) : ''));
      return;
    }

    appContextPath = appContextPath || app.contextPath;
    app = findApp(appContextPath);
    dataApp = findApp('c8ydata');

    if (app.contextPath === 'core') {
      grunt.task.run('extractLocalesCore');
      return;
    }
    
    if (app.contextPath === 'c8ydata') {
      grunt.task.run('extractLocalesData');
      return;
    }

    var target = 'app',
      config = {
        files: {}
      };
    
    config.files[app.__dirname + '/locales/locales.pot'] = getPluginsPathApp(app.imports);
    config.files[dataApp.__dirname + '/locales/' + app.contextPath + '.pot'] = getPluginsPathApp(app.imports);
    extractLocales(target, config);
  }

  function getPluginsPathApp(imports) {
    var pluginsPathApp = [];
    _.forEach(imports, function (i) {
      var plugin = findPlugin(i);
      if (plugin && !_.contains(pluginsPathApp, plugin.__dirname)) {
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
    var plugins = grunt.config('localplugins') || [];
    return _.find(plugins, function (p) {
      return plugin === p.__rootContextPath;
    });
  }

  function findApp(app) {
    var apps = grunt.config('localapps') || [];
    return _.find(apps, function (a) {
      return app === a.contextPath;
    });
  }

  function coreExtractLocalesTemplate() {
    var app = findApp('core'),
      dataApp = findApp('c8ydata'),
      target = 'core',
      config = {
        files: {}
      },
      coreFiles = [
        app.__dirname + '/scripts/core/**/*.html',
        app.__dirname + '/scripts/core/**/*.js',
        app.__dirname + '/scripts/ui/**/*.html',
        app.__dirname + '/scripts/ui/**/*.js'
      ];

    config.files[app.__dirname + '/locales/locales.pot'] = coreFiles;
    config.files[dataApp.__dirname + '/locales/' + app.contextPath + '.pot'] = coreFiles;
    extractLocales(target, config);
  }

  function c8ydataExtractLocalesTemplate() {
    var app = findApp('c8ydata'),
      target = 'c8ydata',
      filesAndJsonPaths = {
        'smartrules/rules.json': [
          '$..label.[input,output]',
          '$..description',
          '$..category',
          '$..paramGroups[input,output].label',
          '$..paramGroups[input,output].params[label,default]',
          '$..paramGroups[input,output].label',
          '$..paramGroups[input,output].params.stepTypes[label,default]'
        ],
        'devicecommands/*.json': [
          '$.name',
          '$.templates..[name,category]'
        ],
        'properties/schema.json': [
          '$..title'
        ]
      },
      config = {
        files: {}
      };

    _.each(filesAndJsonPaths, function (jsonPaths, filePattern) {
      var files = grunt.file.expand(app.__dirname + '/' + filePattern);
      _.each(files, function (file) {
        var obj = grunt.file.readJSON(file),
          gettextJs = '';

        _.each(jsonPaths, function (jsonPath) {
          var txts = JSONPath.eval(obj, jsonPath);
          _.each(txts, function (txt) {
            gettextJs += 'gettext(\'' + txt + '\');\n';
          });
        });
        grunt.file.write(app.__dirnameTemp + '/locales/' + file.substr(0, app.__dirname.length + 1), gettextJs);
        
      });
    });

    config.files[app.__dirname + '/locales/' + app.contextPath + '.pot'] = [app.__dirnameTemp + '/gettext.js'];
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
    if (originalAppContextPath !== 'core' && originalAppContextPath !== 'c8ydata') {
      addImport(app.imports, baseManifest.contextPath, 'i18n-core');
      appsWithI18n.push('core');
      addImport(app.imports, baseManifest.contextPath, 'i18n-c8ydata');
      appsWithI18n.push('c8ydata');
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

  grunt.registerTask('extractLocalesApp', 'Extracts translations from specified application', appExtractLocalesTemplate);

  grunt.registerTask('extractLocalesCore', 'Extracts translations from core', coreExtractLocalesTemplate);
  grunt.registerTask('extractLocalesData', 'Extracts translations from c8ydata', c8ydataExtractLocalesTemplate);
  grunt.registerTask('extractLocales', 'Extracts translations from specified plugin', pluginExtractLocalesTemplate);
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
