var _ = require('lodash');
var shell = require('shelljs');
var fs = require('fs');
var path = require('path');

module.exports = function (grunt) {
  'use strict';

  var c8yUtil = require('../lib/c8yUtil')(grunt);
  var c8yRequest = require('../lib/c8yRequest')(grunt);

  var configKey = 'c8yDeployUI',
    targetCfgDefaults = {
      manifests: {
        apps: {
          resourcesUsername: 'resourcesUsername',
          resourcesPassword: 'resourcesPassword'
        }
      }
    },
    appCfgDefaults = {
      __manifest: 'cumulocity.json'
    };

  function getConfig() {
    return grunt.config(configKey) || {};
  }

  function setConfig(config) {
    grunt.config.set(configKey, config);
  }

  function getTargetCfgPath() {
    return './deploy/targets/' + (grunt.option('target') || 'cumulocity') + '.json';
  }

  function getTargetCfgWithDefaults(targetCfg) {
    return _.merge(targetCfgDefaults, targetCfg);
  }

  function getAppCfgWithDefaults(appCfg) {
    return _.merge({}, appCfgDefaults, appCfg);
  }

  function getAllApps() {
    return grunt.config('localapps');
  }

  function getAllPlugins() {
    return grunt.config('localplugins');
  }

  function getAppForCfg(appCfg, targetCfg) {
    var app = {manifest: null, plugins: []},
      manifest = getAppExtendedManifest(appCfg),
      allPlugins = getAllPlugins();

    if (manifest) {
      manifest = cleanAppManifest(manifest, appCfg, targetCfg);
      grunt.log.ok('Packed application: ' + appCfg.contextPath + ' (' + appCfg.__manifest + ')');
      _.each(allPlugins, function (plgManifest) {
        if (plgManifest.__rootContextPath.match('^' + appCfg.contextPath + '/')) {
          var pluginManifest = _.clone(plgManifest);
          pluginManifest = cleanPluginManifest(pluginManifest, appCfg, targetCfg);
          app.plugins.push(pluginManifest);
          grunt.log.ok('Packed plugin: ' + appCfg.contextPath + '/' + pluginManifest.contextPath);
        }
      });
      app.manifest = manifest;
      return app;
    } else {
      grunt.fail.fatal('Cannot find manifest for target app: ' + appCfg.contextPath);
    }
  }

  function getAppExtendedManifest(appCfg) {
    var allApps = getAllApps(),
      matchingApps = _.filter(allApps, function (a) {
        return a.contextPath === appCfg.contextPath && a.__manifest === appCfg.__manifest;
      });

    if (matchingApps.length === 0) {
      grunt.fail.fatal('No matching manifests found for app ' + appCfg.contextPath + '!');
    }

    if (matchingApps.length > 1) {
      grunt.log.warn('More than one matching manifests found for app ' + appCfg.contextPath + '!');
    }

    return _.clone(matchingApps[0]);
  }

  function cleanAppManifest(manifest, appCfg, targetCfg) {
    if (targetCfg && targetCfg.manifests && targetCfg.manifests.apps) {
      manifest = _.merge(manifest, targetCfg.manifests.apps);
    }
    if (appCfg.manifest) {
      manifest = _.merge(manifest, appCfg.manifest);
    }
    if (appCfg.removeImports) {
      _.each(appCfg.removeImports, function (imp) {
        manifest.imports = _.without(manifest.imports, imp);
      });
    }
    if (appCfg.addImports) {
      _.each(appCfg.addImports, function (imp) {
        manifest.imports.push(imp);
      });
    }
    manifest.resourcesUrl = ['/'].join('');
    _.each(manifest, function (val,  key) {
      if (key.match('^__')) {
        delete manifest[key];
      }
    });
    return manifest;
  }

  function cleanPluginManifest(manifest, appCfg, targetCfg) {
    if (targetCfg && targetCfg.manifests && targetCfg.manifests.plugins) {
      manifest = _.merge(manifest, targetCfg.manifests.plugins);
    }
    _.each(manifest, function (val,  key) {
      if (key.match('^__')) {
        delete manifest[key];
      }
    });
    return manifest;
  }

  function getManifestsPackWritePath(targetCfg) {
    return './deploy/manifests/' + targetCfg.name + '_' + targetCfg.version + '.json';
  }

  function getManifestsPackLoadPath(targetCfg) {
    return grunt.option('manifests') || 'manifests.json';
  }

  grunt.registerTask('c8yDeployUI:packManifests', 'Exports manifests to manifests pack', [
    'readManifests',
    'c8yDeployUI:loadTargetConfig',
    'c8yDeployUI:hgPullUpdate',
    'readManifests',
    'c8yDeployUI:zipBuilds',
    'c8yDeployUI:prepareManifestsPack',
    'c8yDeployUI:writeManifestsPack'
  ]);

  grunt.registerTask('c8yDeployUI:loadTargetConfig', 'Loads target config for deployment', function () {
    var config = getConfig(),
      path = getTargetCfgPath();

    if (grunt.file.exists(path)) {
      config.targetCfg = getTargetCfgWithDefaults(grunt.file.readJSON(path));
      config.targetCfg.applications = _.map(config.targetCfg.applications, function (appCfg) {
        return getAppCfgWithDefaults(appCfg);
      });
      grunt.log.ok('Loaded target config from ' + path + '.');
    } else {
      grunt.fail.fatal('Cannot find target config in ' + path + '!');
    }

    setConfig(config);
  });

  grunt.registerTask('c8yDeployUI:zipBuilds', function () {
    var config = getConfig();
    // grunt-contrib-compress config, default values are in
    // grunt-cumulocity-build.js, search for "grunt.config.set('compress"
    var compressConf = grunt.config('compress');
    var buildConf = compressConf.build;
    // Go through apps
    _.each(config.targetCfg.applications, function (appCfg) {
      var cfg = getAppExtendedManifest(appCfg);
      if (cfg.contextPath === 'core') {
        buildConf.files[0].dest = './';
        return;
      }
      // clone default conf, set it up
      var newConf = _.cloneDeep(buildConf);
      newConf.options.archive = ['deploy', 'zips', cfg.contextPath, 'build.zip'].join('/');
      if (cfg.contextPath === 'c8ydata') {
        newConf.files[0].cwd = cfg.__dirname + '/';
      }
      else {
        newConf.files[0].cwd = cfg.__dirname + '/build/';
      }
      newConf.files[0].dest = './';
      compressConf[cfg.contextPath] = newConf;
    });
    grunt.config.set('compress', compressConf);
    grunt.task.run('compress');
  });

  grunt.registerTask('c8yDeployUI:hgPullUpdate', 'Updates all required repositories to required branches or tags', function () {
    var config = getConfig(),
      hgPullCmd = 'hg pull',
      hgUpdateCmd = 'hg update';

    _.each(config.targetCfg.applications, function (appCfg) {
      var app = getAppExtendedManifest(appCfg),
        pullCmd = hgPullCmd, pullCmdOutput,
        updateCmd = hgUpdateCmd + ' ' + appCfg.branch, updateCmdOutput;

      shell.pushd(app.__dirname);

      grunt.log.ok(app.contextPath + ': ' + pullCmd);
      pullCmdOutput = shell.exec(pullCmd).output;
      if (pullCmdOutput.match(/^abort:/)) {
        grunt.fail.fatal('Aborted due to hg pull errors - see above!');
      }

      grunt.log.ok(app.contextPath + ': ' + updateCmd);
      updateCmdOutput = shell.exec(updateCmd).output;
      if (updateCmdOutput.match(/^abort:/)) {
        grunt.fail.fatal('Aborted due to hg update errors - see above!');
      }

      shell.popd();
    });
  });

  grunt.registerTask('c8yDeployUI:prepareManifestsPack', 'Prepares manifests pack to write', function () {
    var config = getConfig(),
      manifestsPack = {apps: []};

    _.each(config.targetCfg.applications, function (appCfg) {
      var app = getAppForCfg(appCfg, config.targetCfg);
      manifestsPack.apps.push(app);
    });

    config.manifestsPack = manifestsPack;
    setConfig(config);
  });

  grunt.registerTask('c8yDeployUI:writeManifestsPack', 'Writes manifests pack to file', function () {
    var config = getConfig(),
      path = getManifestsPackWritePath(config.targetCfg);

    grunt.file.write(path, JSON.stringify(config.manifestsPack));
    grunt.log.ok('Manifests pack saved to ' + path + '.');
  });

  grunt.registerTask('c8yDeployUI:registerManifests', 'Registers manifests from provided file', [
    'c8yDeployUI:loadManifestsPack',
    'c8yDeployUI:registerManifestsPack'
  ]);

  grunt.registerTask('c8yDeployUI:loadManifestsPack', 'Loads manifests pack from file', function () {
    var config = getConfig(),
      path = getManifestsPackLoadPath();

    if (grunt.file.exists(path)) {
      config.manifestsPack = grunt.file.readJSON(path);
      grunt.log.ok('Loaded manifests pack from ' + path + '.');
    } else {
      grunt.fail.fatal('Cannot find manifests pack in ' + path + '! Use --manifests option to provide proper path.');
    }

    setConfig(config);
  });

  grunt.registerTask('c8yDeployUI:registerManifestsPack', 'Registers manifests from pack', function () {
    var config = getConfig(),
      apps = config.manifestsPack.apps;

    _.each(apps, function (app) {
      var appManifest = app.manifest;
      grunt.task.run(
        'c8yDeployUI:appRegister:' + appManifest.contextPath + ':noImports',
        'c8yDeployUI:uploadZip'
      );
      _.each(app.plugins, function (plugin) {
        grunt.task.run('c8yDeployUI:pluginRegister:' + appManifest.contextPath + ':' + plugin.contextPath + ':noImports');
      });
    });

    _.each(apps, function (app) {
      var appManifest = app.manifest;
      _.each(app.plugins, function (plugin) {
        if (plugin.imports && plugin.imports.length) {
          grunt.task.run('c8yDeployUI:pluginRegister:' + appManifest.contextPath + ':' + plugin.contextPath);
        }
      });
      if (appManifest.imports && appManifest.imports.length) {
        grunt.task.run('c8yDeployUI:appRegister:' + appManifest.contextPath);
      }
    });
  });

  c8yUtil.registerAsync('c8yDeployUI:uploadZip', function () {
    var appCfg = grunt.config.get('c8yAppRegister');
    var app = appCfg.app;
    var appId = appCfg.appId;
    var fileStream = fs.createReadStream(path.resolve(['zips', app.contextPath, 'build.zip'].join('/')));
    var uriPath = ['application/applications/', appId, '/binaries/'].join('');
    return c8yRequest.upload(fileStream, uriPath).then(function (uploadedBinary) {
      grunt.log.ok(['Uploaded build.zip for', app.contextPath].join(' '));
      grunt.task.run('c8yDeployUI:activateZip:' + uploadedBinary.id);
    }, function (err) {
      grunt.fail.fatal(['ERROR', err.statusCode, err.body && err.body.message].join(' :: '));
    });
  });

  c8yUtil.registerAsync('c8yDeployUI:activateZip', function (credentials, zipId) {
    var appCfg = grunt.config.get('c8yAppRegister');
    var app = appCfg.app;
    var appId = appCfg.appId;
    var uriPath = ['application/applications/', appId].join('');
    return c8yRequest.put(uriPath, {activeVersionId: zipId}).then(function () {
      grunt.log.ok(['Activated uploaded build.zip for', app.contextPath].join(' '));
    }, function (err) {
      grunt.fail.fatal(['ERROR', err.statusCode, err.body && err.body.message].join(' :: '));
    });
  });

  grunt.registerTask('c8yDeployUI:appRegister', 'Register app from manifests pack', function (appContextPath, option) {
    var config = getConfig(),
      app = _.find(config.manifestsPack.apps, function (a) {
        return a.manifest.contextPath === appContextPath;
      }),
      appManifest = app.manifest;

    if (option === 'noImports') {
      appManifest.imports = [];
    }

    if (config.appManifests && config.appManifests.resourcesUsername) {
      appManifest.resourcesUsername = config.appManifests.resourcesUsername;
    }

    if (config.appManifests && config.appManifests.resourcesPassword) {
      appManifest.resourcesPassword = config.appManifests.resourcesPassword;
    }

    grunt.config.set('c8yAppRegister', {app: app.manifest});
    grunt.task.run('c8yAppRegister');
  });

  grunt.registerTask('c8yDeployUI:pluginRegister', 'Register plugin from manifests pack', function (appContextPath, pluginContextPath, option) {
    var config = getConfig(),
      app = _.find(config.manifestsPack.apps, function (a) {
        return a.manifest.contextPath === appContextPath;
      }),
      appManifest = app.manifest,
      pluginManifest = _.find(app.plugins, function (p) {
        return p.contextPath === pluginContextPath;
      });

    pluginManifest.directoryName = pluginManifest.contextPath;

    if (option === 'noImports') {
      pluginManifest.imports = [];
    }

    grunt.config.set('c8yPluginRegister', {app: appManifest, plugin: pluginManifest});
    grunt.task.run('c8yPluginRegister');
  });
};
