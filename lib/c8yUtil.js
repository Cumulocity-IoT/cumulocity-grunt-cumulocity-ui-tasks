module.exports = function (grunt) {
  var Q = require('q'),
    _ = require('lodash'),
    c8yCredentials = require('./c8yCredentials')(grunt);

  function register(task, callback, noAuth) {
    grunt.registerTask(task, function () {
      var done = this.async();
      var args = _.toArray(arguments);
      var promise = Q(args);
      if (!noAuth) {
        promise = promise.then(c8yCredentials.get).then(function (credentials) {
          args.unshift(credentials);
          return args;
        });
      }
      promise.then(_.bind(callback.apply, callback, null))
      .then(function () {
        done();
      }, function (err) {
        grunt.log.error(JSON.stringify(err));
        done(false);
      });
    });
  }

  return {
    registerAsync: register
  };
};
