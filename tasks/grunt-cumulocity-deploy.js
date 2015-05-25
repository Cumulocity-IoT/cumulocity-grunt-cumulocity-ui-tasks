var _ = require('lodash');

module.exports = function (grunt) {
  'use strict';
  
  var configKey = 'c8yDeployUI';
  
  function getConfig() {
    return grunt.config(configKey) || {};
  }
  
  function setConfig(config) {
    grunt.config.set(configKey, config);
  }
  
  function getTargetCfgPath() {
    return './deploy/configs/' + (grunt.option('environment') || 'cumulocity') + '.json';
  }
  
  function getAllApps() {
    var currentApp = grunt.config('currentlocalapp'),
      apps = grunt.config('localapps'),
      allApps = [].concat(apps).concat([currentApp]);
    return allApps;
  }
  
  function getAllPlugins() {
    return grunt.config('localplugins');
  }
  
  function getAppForCfg(appCfg, targetCfg, allApps, allPlugins) {
    var app = {manifest: null, plugins: []},
      manifest = _.clone(_.find(allApps, function (a) {
        return a.contextPath === appCfg.contextPath;
      }));

    if (manifest) {
      manifest = cleanAppManifest(manifest, appCfg, targetCfg);
      grunt.log.ok('Packed application: ' + appCfg.contextPath);
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
  
  function cleanAppManifest(manifest, appCfg, targetCfg) {
    if (targetCfg && targetCfg.manifests && targetCfg.manifests.apps) {
      manifest = _.merge(manifest, targetCfg.manifests.apps);
    }
    if (appCfg.branch) {
      manifest.resourcesUrl = manifest.resourcesUrl.replace(/raw\/[^\/]+/, 'raw/' + appCfg.branch);
    }
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
  
  grunt.registerTask('c8yDeployUI:packManifests', [
    'readManifests',
    'c8yDeployUI:loadTargetConfig',
    'c8yDeployUI:prepareManifestsPack',
    'c8yDeployUI:writeManifestsPack'
  ]);
  
  grunt.registerTask('c8yDeployUI:loadTargetConfig', function () {
    var config = getConfig(),
      path = getTargetCfgPath();

    if (grunt.file.exists(path)) {
      config.targetCfg = grunt.file.readJSON(path);
      grunt.log.ok('Loaded target config from ' + path + '.');
    } else {
      grunt.fail.fatal('Cannot find target config in ' + path + '!');
    }
    
    setConfig(config);
  });
  
  grunt.registerTask('c8yDeployUI:prepareManifestsPack', function () {
    var config = getConfig(),
      allApps = getAllApps(),
      allPlugins = getAllPlugins(),
      manifestsPack = {apps: []};
      
    _.each(config.targetCfg.applications, function (appCfg) {
      var app = getAppForCfg(appCfg, config.targetCfg, allApps, allPlugins);
      manifestsPack.apps.push(app);
    });

    config.manifestsPack = manifestsPack;
    setConfig(config);
  });
  
  grunt.registerTask('c8yDeployUI:writeManifestsPack', function () {
    var config = getConfig(),
      path = getManifestsPackWritePath(config.targetCfg);
    
    grunt.file.write(path, JSON.stringify(config.manifestsPack));
    grunt.log.ok('Manifests pack saved to ' + path + '.');
  });

  grunt.registerTask('deploy:registerManifests', [
    'deploy:readManifestsPack',
    'deploy:registerManifestsPack'
  ]);
  
  grunt.registerTask('deploy:readManifestsPack', function () {
    var config = grunt.config('deploy') || {},
      path = grunt.option('manifests') || 'manifests.json';

    if (grunt.file.exists(path)) {
      config.manifests = grunt.file.readJSON(path);
      grunt.log.ok('Loaded manifests from ' + path + '.');
    } else {
      grunt.fail.fatal('Could not find manifests in ' + path + '!');
    }
    
    grunt.config('deploy', config);
  });
  
  grunt.registerTask('deploy:registerManifestsPack', '', function () {
    grunt.task.requires('deploy:readManifestsPack');
    grunt.config.requires('deploy');
    var config = grunt.config('deploy');
      
    _.each(config.manifests.apps, function (app, appIndex) {
      grunt.task.run('deploy:registerAppManifestFromPack:' + appIndex + ':noImports');
      _.each(app.plugins, function (plugin, pluginIndex) {
        grunt.task.run('deploy:registerPluginManifestFromPack:' + appIndex + ':' + pluginIndex);
      });
      grunt.task.run('deploy:registerAppManifestFromPack:' + appIndex + ':withImports');
    });
  });
  
  grunt.registerTask('deploy:registerAppManifestFromPack', '', function (appIndex, option) {
    grunt.task.requires('deploy:readManifestsPack');
    grunt.config.requires('deploy');
    var config = grunt.config('deploy'),
      app = _.clone(config.manifests.apps[appIndex].manifest);
      
    if (option === 'noImports') {
      app.imports = [];
    }
    
    grunt.config.set('c8yAppRegister', {app: app});
    grunt.task.run('c8yAppRegister:' + app.contextPath + (option ? ':' + option : ''));
  });
  
  grunt.registerTask('deploy:registerPluginManifestFromPack', '', function (appIndex, pluginIndex) {
    grunt.task.requires('deploy:readManifestsPack');
    grunt.config.requires('deploy');
    var config = grunt.config('deploy'),
      app = _.clone(config.manifests.apps[appIndex].manifest),
      plugin = _.clone(config.manifests.apps[appIndex].plugins[pluginIndex]);
    
    plugin.directoryName = plugin.contextPath;
    grunt.config.set('c8yPluginRegister', {app: app, plugin: plugin});
    grunt.task.run('c8yPluginRegister:' + app.contextPath + ':' + plugin.contextPath);
  });
};
