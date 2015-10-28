'use strict';

module.exports = function (grunt) {
  var _ = require('lodash'),
    c8yRequest = require('./c8yRequest')(grunt);

  var credentials;

  function init(_credentials) {
    credentials = _credentials;
    c8yRequest.setCredentials(credentials);
  }

  function getManifest(plugin) {
      var manifest = _.clone(plugin);
      _.forEach(manifest, function (val, key) {
        if (key.match(/^__/)) {
          delete manifest[key];
        }
      });
      return manifest;
    }

  function findApplication(_app) {
    var path = 'application/applicationsByOwner/' + credentials.tenant + '?pageSize=1000';
    return c8yRequest.get(path).then(function (data) {
      var apps = data.applications,
        existingApp = _.find(apps, function (a) {
          return a.contextPath === _app.contextPath;
        });
      if (existingApp) {
        _app.id = existingApp.id;
      }
      return _app;
    });
  }

  function findPlugin(_plugin) {
    var path = 'application/plugins?pageSize=1000';

    return c8yRequest.get(path).then(function (data) {
      var plugins = data.plugins,
        existingPlugin = _.find(plugins, function (p) {
          return p.contextPath === _plugin.rootContextPath;
        });

      if (existingPlugin) {
        _plugin.id = existingPlugin.id;
      }

      return _plugin;
    });
  }

  function buildManifest(app) {
    var manifest = {
      imports: app.imports,
      exports: app.exports,
      noAppSwitcher: app.noAppSwitcher,
      tabsHorizontal: app.tabsHorizontal
    };

    return manifest;
  }

  function saveApplication(_app) {
    var path = ['application/applications', _app.id  ? '/' + _app.id : ''].join(''),
      manifest = buildManifest(_app),
      type = 'application/vnd.com.nsn.cumulocity.application+json',
      app = _.clone(_app);

    delete app.imports;
    delete app.exports;
    delete app.noAppSwitcher;
    delete app.tabsHorizontal;

    if (app.id) {
      delete app.type;
    }
    app.manifest = manifest;
    var makeRequest = _app.id ? c8yRequest.put : c8yRequest.post;
    return makeRequest(path, app, type)
      .then(function (newApp) {
        return newApp;
      });
  }

  function savePlugin(_plugin) {
    var path = [
        'application/applications/',
        _plugin.app_id,
        '/plugins',
        _plugin.id ? '/' + _plugin.id : ''
      ].join(''),
      manifest = getManifest(_plugin),
      type =  'application/vnd.com.nsn.cumulocity.plugin+json',
      plugin = {
        manifest: manifest,
        directoryName: manifest.directoryName
      };

    if (manifest.id) {
      plugin.id = manifest.id;
      delete manifest.id;
    }

    manifest.js = !!manifest.js;
    manifest.css = !!manifest.css || !!manifest.less;

    delete manifest.less;
    delete manifest.app_id;
    var makeRequest = _plugin.id ? c8yRequest.put : c8yRequest.post;
    return makeRequest(path, plugin, type);
  }

  function loadAppManifest(contextPath) {
    var path = 'application/applications/' + contextPath + '/manifest';
    return c8yRequest.get(path);
  }

  return {
    init: init,
    findApplication: findApplication,
    findPlugin: findPlugin,
    saveApplication: saveApplication,
    savePlugin: savePlugin,
    loadAppManifest: loadAppManifest
  };
};
