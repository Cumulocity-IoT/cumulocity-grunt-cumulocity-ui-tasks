var Q = require('q'),
  inquirer = require('inquirer');

module.exports = function (grunt) {

  function getCredentials() {
    var defer = Q.defer(),
      userConfig = getUserConfig();

    if (userConfig.tenant && userConfig.user) {
      getPassword().then(function (pass) {
        userConfig.password = pass;
        defer.resolve(userConfig);
      });
    } else {
      inquirer.prompt([
        {message: 'What is your cumulocity tenant?', name: 'tenant'},
        {message: 'What is your username?', name: 'user'}
      ], function (answers) {
        grunt.file.write('.cumulocity', JSON.stringify(answers, null, 2));
        getPassword().then(function (pass) {
          answers.password = pass;
          grunt.log.debug('CREDENTIALS: ' + answers.tenant + '/' + answers.user);
          defer.resolve(answers);
        });
      });
    }

    return defer.promise;
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

  return {
    get: getCredentials,
  };
};
