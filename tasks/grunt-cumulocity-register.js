module.exports = function (grunt) {
  'use strict';

  var _ = require('lodash'),
    c8yServer = require('../lib/c8yServer')(grunt),
    c8yCredentials = require('../lib/c8yCredentials')(grunt);

  function getCurrentPlugins() {
    var plugins = grunt.config('localplugins') || [];
    return _.filter(plugins, '__isCurrent');
  }

  function checkCredentials() {
    return c8yCredentials.get().then(function (credentials) {
      c8yServer.init(credentials);
      return true;
    });
  }

  function applicationSave(app) {
    return c8yServer.findApplication(app)
      .then(c8yServer.saveApplication);
  }

  function pluginSave(plugin) {
    return c8yServer.findPlugin(plugin)
      .then(c8yServer.savePlugin)
      .then(function () {
        return plugin;
      });
  }

  function onError(err) {
    console.log(arguments);
    grunt.fail.fatal(['ERROR', err.statusCode, err.body && err.body.message].join(' :: '));
  }

  grunt.registerTask('c8yAppRegister', 'Task to register and update application', function () {
    var app = grunt.config.get('c8yAppRegister.app'),
      done = this.async();

    return checkCredentials().then(function () {
      grunt.log.writeln('Registering ' + app.contextPath + ' application...');
      return applicationSave(app).then(function () {
        grunt.log.ok('Application ' + app.contextPath + ' registered.');
        return done();
      }, onError);
    }, onError);
  });

  grunt.registerTask('appRegister', 'Task to register and update current application for given option and branch', function (option, branch) {
    var appConfig = (grunt.option('manifest') || 'cumulocity') + '.json',
      app;

    if (grunt.file.exists(appConfig)) {
      app = grunt.file.readJSON(appConfig);
      grunt.log.ok('Loaded application manifest from ' + appConfig + '.');
    } else {
      grunt.fail.fatal('Application manifest not found in ' + appConfig + '.json.');
      return;
    }

    if (option === 'noImports') {
      app.imports = [];
    }

    if (option === 'branch' && branch) {
      var url = app.resourcesUrl,
        inHouse = url.match('bitbucket.org/m2m/');

      if (inHouse) {
        url = url.replace(/raw\/[^\/]+/, 'raw/' + branch);
        app.resourcesUrl = url;
      }
    }

    grunt.config.set('c8yAppRegister', {app: app});
    grunt.task.run('c8yAppRegister:' + app.contextPath + ':' + (branch ? branch : option));
  });

  grunt.registerTask('c8yPluginRegister', 'Task to register and update specified plugin', function () {
    var app = grunt.config.get('c8yPluginRegister.app'),
      plugin = grunt.config.get('c8yPluginRegister.plugin'),
      done = this.async();

    grunt.log.writeln('Registering ' + app.contextPath + '/' + plugin.directoryName + ' plugin...');
    return checkCredentials()
      .then(function () {
        var appPromise = grunt.config('appPromise.' + app.contextPath);
        if (!appPromise) {
          appPromise = c8yServer.findApplication(app);
          grunt.config('appPromise.' + app.contextPath, appPromise);
        }
        return appPromise;
      })
      .then(function (app) {
        if (!app.id) {
          grunt.fail.fatal('Application must be registered first!');
        }
        plugin.app_id = app.id;
        plugin.rootContextPath = app.contextPath + '/' + plugin.directoryName;
        return plugin;
      })
      .then(pluginSave)
      .then(function () {
        grunt.log.ok('Plugin ' + app.contextPath + '/' + plugin.directoryName + ' successfully registered.');
        return done();
      })
      .fail(onError);
  });

  grunt.registerTask('pluginRegister', 'Task to register given plugin from current application', function (pluginName) {
    if (!pluginName) {
      grunt.fail.fatal('Plugin name is missing! Use: pluginRegister:<pluginName>');
    }

    var appConfig = (grunt.option('manifest') || 'cumulocity') + '.json',
      pluginConfig = grunt.template.process('<%= paths.plugins %>/' + pluginName + '/cumulocity.json', grunt.config),
      app,
      plugin;

    if (grunt.file.exists(appConfig)) {
      app = grunt.file.readJSON(appConfig);
      grunt.log.ok('Using app manifest: ' + appConfig + '.');
    } else {
      grunt.fail.fatal('Application manifest not found in ' + appConfig + '.json.');
    }

    if (grunt.file.exists(pluginConfig)) {
      plugin = grunt.file.readJSON(pluginConfig);
      plugin.directoryName = pluginName;
      grunt.log.ok('Using plugin manifest: ' + pluginConfig + '.');
    } else {
      grunt.fail.fatal('Plugin manifest not found in ' + pluginConfig + '.json.');
    }

    grunt.config.set('c8yPluginRegister', {app: app, plugin: plugin});
    grunt.task.run('c8yPluginRegister:' + app.contextPath + ':' + pluginName);
  });

  grunt.registerTask('_pluginRegisterAll', function () {
    var plugins = getCurrentPlugins();

    plugins.sort(function (a, b) {
      var alength = (a.imports && a.imports.length) || 0;
      var blength = (b.imports && b.imports.length) || 0;
      return alength - blength;
    });


    plugins.forEach(function (p) {
      grunt.task.run('pluginRegister:' + p.contextPath);
    });
  });

  grunt.registerTask('pluginRegisterAll', [
    'readManifests',
    '_pluginRegisterAll'
  ]);

  grunt.registerTask('register', function (target) {
    grunt.task.run('appRegister:noImports');
    grunt.task.run('pluginRegisterAll');
    grunt.task.run('appRegister:branch:' + target);
  });
};
