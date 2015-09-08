module.exports = function(grunt) {
  var c8yRequest = require('../lib/c8yRequest')(grunt);
  var c8yUtil = require('../lib/c8yUtil')(grunt);
  var _ = require('lodash');

  c8yUtil.registerAsync('copyImports', function(credentials, contextPath) {
    c8yRequest.setCredentials(credentials);
    return c8yRequest.get('application/applications?pageSize=1000')
      .then(_.partial(findAppByContextPath, contextPath))
      .then(fixManifest)
      .then(writeToDisk);
  });

  function findAppByContextPath(contextPath, apps) {
    return _.find(apps.applications, function (app) {
      return app.contextPath === contextPath;
    });
  }

  function fixManifest(app) {
    app.name = app.name || app.contextPath;
    app.name += ' i18n';
    app.contextPath += '-i18n';
    app.key += '-i18n';
    app.availability = 'PRIVATE';
    app.resourcesUrl = 'RESOURCES_URL';
    app.resourcesUsername = 'USERNAME';
    app.resourcesPassword = 'PASSWORD';
    delete app.id;
    delete app.owner;
    delete app.self;
    app.imports = app.manifest.imports || [];
    addImport(app, 'i18n');
    addImport(app, 'core-i18n');
    app.noAppSwitcher = !!app.manifest.noAppSwitcher;
    app.tabsHorizontal = !!app.manifest.tabsHorizontal;
    delete app.manifest;
    return app;
  }

  function addImport(app, name) {
    app.imports.push([app.contextPath, '/', name].join(''));
  }

  function writeToDisk(app) {
    if (grunt.file.exists('cumulocity.json')) {
      grunt.file.copy('cumulocity.json', 'cumulocity.json.old');
    }
    grunt.file.write('cumulocity.json', JSON.stringify(app, null, 2));
  }
};
