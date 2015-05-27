var Q = require('q'),
  inquirer = require('inquirer'),
  _ = require('lodash'),
  cumulocityServer = require('../lib/cumulocityServer');

module.exports = function (grunt) {
  'use strict';

  function getCurrentPlugins() {
    var plugins = grunt.config('localplugins') || [];
    return _.filter(plugins, '__isCurrent');
  }

  function getUserConfig() {
    var output  = {};
    if (process.env.C8Y_TENANT && process.env.C8Y_USER) {
      output = {
        tenant : process.env.C8Y_TENANT,
        user: process.env.C8Y_USER
      };
    } else if (grunt.file.exists('.cumulocity')) {
      output = grunt.file.readJSON('.cumulocity');
    }

    return output;
  }

  function getCredentials() {
    var defer = Q.defer(),
      userConfig = getUserConfig();

    if (userConfig.tenant && userConfig.user) {
      defer.resolve(userConfig);
    } else {
      inquirer.prompt([
        {message: 'What is your cumulocity tenant?', name: 'tenant'},
        {message: 'What is your username?', name: 'user'}
      ], function (answers) {
        grunt.file.write('.cumulocity', JSON.stringify(answers, null, 2));
        grunt.log.ok('Credentials stored in .cumulocity file.');
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
        cumulocityServer.init(
          credentials.tenant,
          credentials.user,
          password,
          grunt.config('cumulocity.host'),
          grunt.option('protocol') || grunt.config('cumulocity.protocol'),
          grunt.config('cumulocity.port')
        );
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

  grunt.registerTask('c8yAppRegister', 'Task to register and update application', function (appName, optionOrBranch) {
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
      
    grunt.log.writeln('Registering ' + app.contextPath + '/' + plugin.contextPath + ' plugin...');
    return checkCredentials()
      .then(function () {
        var appPromise = grunt.config('appPromise.' + app.contextPath);
        if (!appPromise) {
          appPromise = cumulocityServer.findApplication(app);
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
        grunt.log.ok('Plugin ' + app.contextPath + '/' + plugin.contextPath + ' successfully registered.');
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
