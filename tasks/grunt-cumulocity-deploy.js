var _ = require('lodash');

module.exports = function (grunt) {
  'use strict';
  
  grunt.registerTask('deploy:packManifests', [
    'readManifests',
    'deploy:readEnvironmentConfig',
    'deploy:processManifests',
    'deploy:writeManifestsPack'
  ]);
  
  grunt.registerTask('deploy:readEnvironmentConfig', function () {
    var config = grunt.config('deploy') || {},
      path = './deploy/configs/' + (grunt.option('environment') || 'cumulocity') + '.json';

    if (grunt.file.exists(path)) {
      config.env = grunt.file.readJSON(path);
      grunt.log.ok('Loaded config from ' + path + '.');
    } else {
      grunt.fail.fatal('Could not find config in ' + path + '!');
    }
    
    grunt.config('deploy', config);
  });
  
  grunt.registerTask('deploy:processManifests', function () {
    grunt.task.requires('readManifests');
    grunt.config.requires('deploy');
    var config = grunt.config('deploy'),
      currentApp = grunt.config('currentlocalapp'),
      apps = grunt.config('localapps'),
      allApps = [].concat(apps).concat([currentApp]),
      allPlugins = grunt.config('localplugins');
      
    config.manifests = {apps: []};
      
    _.each(config.env.applications, function (app) {
      var appManifest = _.clone(_.find(allApps, function (a) {
        return a.contextPath === app.contextPath;
      }));
      if (appManifest) {
        if (config.env && config.env.manifests && config.env.manifests.apps) {
          appManifest = _.merge(appManifest, config.env.manifests.apps);
        }
        if (app.branch) {
          appManifest.resourcesUrl = appManifest.resourcesUrl.replace(/raw\/[^\/]+/, 'raw/' + app.branch);
        }
        _.each(appManifest, function (val,  key) {
          if (key.match('^__')) {
            delete appManifest[key];
          }
        });
        var appObj = {manifest: appManifest, plugins: []};
        grunt.log.ok('Packed application: ' + app.contextPath);
        _.each(allPlugins, function (plg) {
          if (plg.__rootContextPath.match('^' + app.contextPath + '/')) {
            var pluginManifest = _.clone(plg);
            if (config.env && config.env.manifests && config.env.manifests.plugins) {
              pluginManifest = _.merge(pluginManifest, config.env.manifests.plugins);
            }
            _.each(pluginManifest, function (val,  key) {
              if (key.match('^__')) {
                delete pluginManifest[key];
              }
            });
            appObj.plugins.push(pluginManifest);
            grunt.log.ok('Packed plugin: ' + app.contextPath + '/' + pluginManifest.contextPath);
          }
        });
        config.manifests.apps.push(appObj);
      }
    });

    grunt.config('deploy', config);
  });
  
  grunt.registerTask('deploy:writeManifestsPack', function () {
    grunt.config.requires('deploy');
    var config = grunt.config('deploy'),
      path = './deploy/manifests/' + config.env.name + '_' + config.env.version + '.json';
    
    grunt.file.write(path, JSON.stringify(config.manifests));
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
