var Q = require('q'),
  inquirer = require('inquirer'),
  _ = require('lodash'),
  cumulocityServer = require('../lib/cumulocityServer');

module.exports = function (grunt) {
  'use strict';

  function getCredentials() {
    var defer = Q.defer(),
      userConfig = grunt.file.exists('.cumulocity') ? grunt.file.readJSON('.cumulocity') : {};

    if (userConfig.tenant && userConfig.user) {
      defer.resolve(userConfig);
    } else {
      inquirer.prompt([
        {message: 'What is your cumulocity tenant?', name: 'tenant'},
        {message: 'What is your username?', name: 'user'}
      ], function (answers) {
        grunt.file.write('.cumulocity', JSON.stringify(answers, null, 2));
        defer.resolve(answers);
      });
    }

    return defer.promise;
  }

  function getPassword() {
    var defer = Q.defer();

    if (process.env.C8Y_PASS) {
      defer.resolve(process.env.C8Y_PASS);
    } else {
      inquirer.prompt([
        {message: 'What is your password?', name: 'password', type: 'password'}
      ], function (answers) {
        var pass = process.env.C8Y_PASS = answers.password;
        defer.resolve(pass);
      });
    }

    return defer.promise;
  }

  function checkCredentials() {
    return getCredentials().then(function (credentials) {
      return getPassword().then(function (password) {
        cumulocityServer.init(credentials.tenant, credentials.user, password, grunt.config('cumulocity.host'), grunt.config('cumulocity.protocol'));
        return true;
      });
    });
  }

  function applicationSave(app) {
    return cumulocityServer.findApplication(app)
      .then(cumulocityServer.saveApplication);
  }

  function pluginSave(plugin) {
    var pManifest = grunt.template.process([
        '<%= paths.plugins %>/',
        plugin.directoryName ,
        '/cumulocity.json',
      ].join(''), grunt.config);

    return cumulocityServer.findPlugin(plugin)
      .then(cumulocityServer.savePlugin)
      .then(function (_plugin) {
        return plugin;
      });
  }

  function pluginClearId(_plugin) {
    var manifestPath = grunt.template.process('<%= paths.plugins %>/' + _plugin + '/cumulocity.json');

    if (grunt.file.exists(manifestPath)) {
      var manifestdata = grunt.file.readJSON(manifestPath);
      delete manifestdata._id;
      grunt.file.write(manifestPath, JSON.stringify(manifestdata, null, 2));
      grunt.log.oklns('Plugin id cleared');
    } else {
      grunt.fail.fatal('Plugin ' + _plugin + ' manifest cannot be found');
    }
  }

  function onError(err) {
    console.log(arguments);
    grunt.fail.fatal(['ERROR', err.statusCode, err.body && err.body.message].join(' :: '));
  }

  grunt.registerTask('c8yAppRegister', 'Task to register and update application', function () {
    var appConfig = 'cumulocity.json',
      done = this.async();

    if (grunt.file.exists(appConfig)) {
      var app = grunt.file.readJSON(appConfig);
    } else {
      grunt.fail.fatal('Application cumulocity.json file not found.');
    }

    checkCredentials().then(function () {
      grunt.log.writeln('Credentials registered');
      grunt.log.writeln('Registering application.');

      return applicationSave(app).then(function () {
        grunt.log.ok('Application registered');
        return done();
      }, onError);
    }, onError);
  });

  grunt.registerTask('c8yPluginRegister', 'Task to register and update specified plugin', function (_plugin) {

    if (!_plugin) {
      grunt.fail.fatal('You must supply a plugin name');
    }

    var appConfig = 'cumulocity.json',
      pluginConfig = grunt.template.process('<%= paths.plugins %>/' + _plugin + '/cumulocity.json', grunt.config),
      app,
      plugin,
      done = this.async();

    if (grunt.file.exists(appConfig)) {
      app = grunt.file.readJSON(appConfig);
    } else {
      grunt.fail.fatal('Application cumulocity.json file not found.');
    }

    if (grunt.file.exists(pluginConfig)) {
      plugin = grunt.file.readJSON(pluginConfig);
      plugin.directoryName = _plugin;
    } else {
      grunt.fail.fatal('Plugin ' + _plugin + ' file not found');
    }

    return checkCredentials()
      .then(function () {
        var appPromise = grunt.config('appPromise');
        if (!appPromise) {
          appPromise = cumulocityServer.findApplication(app);
          grunt.config('appPromise', appPromise);
        }
        return appPromise;
      })
      .then(function (app) {

        if (!app.id) {
          grunt.fail.fatal('Application must be registered');
        }
        plugin.app_id = app.id;
        plugin.rootContextPath = app.contextPath + '/' + plugin.directoryName;
        return plugin;
      })
      .then(pluginSave)
      .then(function () {
        grunt.log.ok('Plugin ' + _plugin + ' successfully registered');
        done();
      })
      .fail(onError);

  });

  grunt.registerTask('pluginRegister', function (_plugin) {
    if (!_plugin) {
      grunt.fail.fatal('You must supply a plugin name');
    }
    grunt.task.run('c8yPluginRegister:' + _plugin);
  });

  grunt.registerTask('_pluginRegisterAll', function () {
    grunt.task.run('c8yAppRegister');
    grunt.config('localPlugins').forEach(function (p) {
      grunt.task.run('c8yPluginRegister:' + p.contextPath);
    });
  });

  grunt.registerTask('pluginRegisterAll', [
    'readPlugins',
    '_pluginRegisterAll'
  ]);

  grunt.registerTask('appRegister', ['c8yAppRegister']);

  //Plugin clear id
  grunt.registerTask('pluginClearId', pluginClearId);
  grunt.registerTask('_pluginClearIdAll', function () {
    grunt.config('localPlugins').forEach(function (p) {
      grunt.task.run('pluginClearId:' + p.contextPath);
    });
  });

  grunt.registerTask('pluginClearIdAll', [
    'readPlugins',
    '_pluginClearIdAll'
  ]);


};
