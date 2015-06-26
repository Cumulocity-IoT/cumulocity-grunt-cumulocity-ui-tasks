module.exports = function (grunt) {
  'use strict';

  var Q = require('q'),
    _ = require('lodash'),
    c8yRequest = require('../lib/c8yRequest')(grunt),
    c8yUtil = require('../lib/c8yUtil')(grunt),
    c8yCreate = require('../lib/c8yCreate')(grunt);

    registerTask('setup:bulk', bulk);
    registerTask('setup:device', c8yCreate.device);
    registerTask('setup:group', c8yCreate.group);
    registerTask('setup:childDevice', c8yCreate.childDevice);
    registerTask('setup:measurement', c8yCreate.measurement);

  var BULK_COUNTS = {
    childDevice: 20,
    device: 10,
    group: 5
  };

  function bulk(startIdx) {
    return createGroups(startIdx)
      .then(createDevices)
      .then(createChildDevices)
      .then(function () {
        grunt.log.ok('Created 5 groups, 10 devices and 20 child devices.');
      });
  }

  function createDevices(groupIds) {
    return createSerial(BULK_COUNTS.device, function (idx) {
      // Assign to first 2 groups, leave the rest empty.
      return c8yCreate.device('device' + idx, groupIds[trunc(idx / 3)]);
    });
  }

  function createChildDevices(deviceIds) {
    return createSerial(BULK_COUNTS.childDevice, function (idx) {
      // Assign to first 4 devices, leave the rest empty.
      return c8yCreate.childDevice('childDevice' + idx, deviceIds[trunc(idx / 5)]);
    });
  }

  function createGroups(startIdx) {
    startIdx = Number(startIdx) || 0;
    return createSerial(BULK_COUNTS.group, function (idx) {
      return c8yCreate.group('group' + (startIdx + idx));
    });
  }

  function createSerial(length, callback) {
    var ids = [];
    return _.chain(_.range(length)).map(function (idx) {
      return function () {
        return callback(idx).then(function (newId) {
          ids.push(newId);
        });
      };
    })
    .reduce(Q.when, Q())
    .value().then(function () {
      return ids;
    });
  }

  function registerTask (task, callback) {
    c8yUtil.registerAsync(task, function (credentials) {
      var args = _.toArray(arguments);
      args.shift();
      c8yRequest.setCredentials(credentials);

      return callback.apply(this, args);
    });
  }

  function trunc(x) {
    return Math.trunc ? Math.trunc(x) : ~~x;
  }
};
