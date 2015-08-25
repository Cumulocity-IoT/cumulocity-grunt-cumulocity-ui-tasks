'use strict';

var Q = require('q'),
  request = require('request');

var credentials;
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
module.exports = function (grunt) {
  return {
    setCredentials: function (_credentials) {
      credentials = _credentials;
    },
    get: function (path, type) {
      return makeRequest(path, 'GET', null, type);
    },
    post: function (path, data, type) {
      return makeRequest(path, 'POST', data, type);
    },
    put: function (path, data, type) {
      return makeRequest(path, 'PUT', data, type);
    },
    delete: function (path, type) {
      return makeRequest(path, 'DELETE', null, type);
    }
  };

  function makeRequest(path, _method, data, type) {
    var defer = Q.defer(),
      url = buildUrl(path),
      method = _method || 'GET',
      headers = type && {
        'Content-Type': type,
        Accept: type
      };
    grunt.log.debug('REQUEST: ' + url);
    grunt.log.debug('         ' + method);
    grunt.log.debug('         ' + type);
    request({
      url : url,
      method: method,
      body: data ? JSON.stringify(data) : undefined,
      headers: headers,
      auth: {
        user: buildUsername(),
        pass: credentials.password,
        sendImmediatly: true
      }
    }, function (err, res, body) {
      if (err) {
        return defer.reject(err);
      }
      try {
        body = JSON.parse(body);
      } catch(e) {

      }

      if (res.statusCode >= 400) {
        return defer.reject({
          statusCode: res.statusCode,
          body: body
        });
      }

      if (!body && res.headers.location) {
        var id = res.headers.location.match(/\d+$/)[0];
        body._id = id;
      }

      defer.resolve(body);
    });

    return defer.promise;
  }

  function buildUsername() {
    var c = credentials;
    var tenant = c.tenant ? c.tenant + '/' : '';
    return tenant + c.user;
  }

  function buildUrl(path) {
    var host = grunt.config('cumulocity.host') || (credentials.tenant + '.cumulocity.com');
    var protocol = grunt.config('cumulocity.protocol') || 'http';
    var port = grunt.config('cumulocity.port');
    return [
      protocol,
      '://',
      host,
      port ? (':' + port) : '',
      '/',
      path
    ].join('');
  }
};
