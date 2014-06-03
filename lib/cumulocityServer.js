var request = require('request'),
  _ = require('lodash'),
  Q = require('q');

var tenant,
  user,
  pass;

function init(_tenant, _user, _password) {
  tenant = _tenant;
  user = _user;
  pass = _password;
}

function buildUrl(path) {
  var tenant = 'dev-c';
  return [
    'http://',
    tenant,
    '.cumulocity.com/',
    path
  ].join('');
}

function getUsername() {
  return tenant + '/' + user;
}


function genericRequest(path, _method, data, type) {
  var defer = Q.defer(),
    url = buildUrl(path),
    method = _method || 'GET',
    headers = type && {
      'Content-Type': type,
      Accept: type
    };

  request({
    url : url,
    method: method,
    body: data ? JSON.stringify(data) : undefined,
    json: true,
    headers: headers,
    auth: {
      user: getUsername(),
      pass: pass,
      sendImmediatly: true
    }
  }, function (err, res, body) {

    if (err) {
      return defer.reject(err);
    }

    if (res.statusCode >= 400) {
      return defer.reject({
        statusCode: res.statusCode,
        body: body
      });
    }

    if (!body && res.headers.location) {
      var id = location.match(/\d+$/)[0];
      body._id = id;
    }

    defer.resolve(body);
  });

  return defer.promise;
}

function saveApplication(_app) {
  var path = ['application/applications', _app._id  ? '/' + _app._id : ''].join(''),
    method = _app._id ? 'PUT' : 'POST',
    manifest = {
      imports: _app.imports,
      exports: _app.exports
    },
    type = 'application/vnd.com.nsn.cumulocity.application+json',
    app = _.clone(_app);

  if (app._id) {
    app.id = app._id;
    delete app._id;
  }
  delete app.imports;
  delete app.exports;
  if (app.id) {
    delete app.type;
  }
  app.manifest = manifest;

  return genericRequest(path, method, app, type).then(function (newApp) {
    var outapp = _.merge(_app, newApp || {});

    if (!outapp._id && outapp.id) {
      outapp._id = outapp.id;
    }

    delete outapp.id;
    delete outapp.manifest;
    delete outapp.owner;
    delete outapp.self;

    return outapp;
  }, null);
}

function savePlugin(_plugin) {
  var path = [
      'application/applications/',
      _plugin._app_id,
      '/exports',
      _plugin._id ? '/' + _plugin._id : ''
    ].join(''),
    method = _plugin._id ? 'PUT' : 'POST',
    manifest = _.clone(_plugin),
    // type = 'application/vnd.com.nsn.cumulocity.plugin+json',
    type =  _plugin._id ? 'application/vnd.com.nsn.cumulocity.plugin+json':
      'application/vnd.com.nsn.cumulocity.pluginCollection+json',
    plugin = {
      manifest: manifest,
      directoryName: manifest.directoryName
    };

  if (manifest._id) {
    plugin.id = manifest._id;
    delete manifest._id;
  }

  manifest.js = !!manifest.js;
  manifest.css = !!manifest.css || !!manifest.less;
  delete manifest.less;

  return genericRequest(path, method, plugin, type);
}

module.exports = {
  init: init,
  saveApplication: saveApplication,
  savePlugin: savePlugin
};

