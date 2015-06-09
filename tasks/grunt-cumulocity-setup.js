module.exports = function (grunt) {
  'use strict';

  var Q = require('q'),
    _ = require('lodash'),
    c8yRequest = require('../lib/c8yRequest')(grunt),
    c8yCredentials = require('../lib/c8yCredentials')(grunt);

  grunt.asyncTask = function (task, callback) {
    grunt.registerTask(task, function () {
      var that = this;
      var done = this.async();
      var args = arguments;
      c8yCredentials.get().then(function (credentials) {
        c8yRequest.setCredentials(credentials);
        return callback.apply(that, args);
      }).then(function () {
        done();
      }).fail(_.partial(done, false));
    });
  };

  grunt.asyncTask('setup:bulk', bulk);
  grunt.asyncTask('setup:device', createDevice);
  grunt.asyncTask('setup:group', createGroup);
  grunt.asyncTask('setup:childDevice', createChildDevice);

  function bulk(startIdx) {
    return createGroups(startIdx)
      .then(createDevices)
      .then(createChildDevices)
      .then(function () {
        grunt.log.ok('Created 5 groups, 10 devices and 20 child devices.');
      });
  }

  function createGroup(name) {
    var body = {
      c8y_IsDeviceGroup: {},
      type: 'c8y_DeviceGroup'
    };
    return createManagedObject(name, body);
  }

  function createDevice(name, groupId) {
    var fragments = {c8y_IsDevice: {}};
    var promise = createManagedObject(name, fragments);
    if (groupId) {
      promise = promise
        .then(_.partial(assignChildAsset, groupId));
    }
    return promise;
  }

  function createChildDevice(name, deviceId) {
    return createManagedObject(name).then(function (newId) {
      return assignChildDevice(deviceId, newId);
    });
  }

  function createDevices(groupIds) {
    return createSerial(10, function (idx) {
      // Assign to first 2 groups, leave the rest empty.
      return createDevice('device' + idx, groupIds[Math.trunc(idx / 3)]);
    });
  }

  function createChildDevices(deviceIds) {
    return createSerial(20, function (idx) {
      // Assign to first 4 devices, leave the rest empty.
      return createChildDevice('childDevice' + idx, deviceIds[Math.trunc(idx / 5)]);
    });
  }

  function createGroups(startIdx) {
    startIdx = Number(startIdx) || 0;
    createSerial(5, function (idx) {
      return createGroup('group' + (startIdx + idx));
    });
  }

  function createSerial(length, callback) {
    var ids = [];
    return _.map(_.range(length), function (idx) {
      return function () {
        return callback(idx).then(function (newId) {
          ids.push(newId);
        });
      };
    })
    .reduce(Q.when, Q.when()).then(function () {
      return ids;
    });
  }

  function assignChildDevice(parentId, childId) {
    return assign(parentId, childId, 'childDevices');
  }

  function assignChildAsset(parentId, childId) {
    return assign(parentId, childId, 'childAssets');
  }

  function assign(parentId, childId, suffix) {
    var body = {
      managedObject: {id: childId}
    };
    var contentType = 'application/vnd.com.nsn.cumulocity.managedObjectReference+json';
    return c8yRequest.post(
      'inventory/managedObjects/' + parentId + '/' + suffix,
      body,
      contentType
    ).then(function () {
      grunt.log.ok('Assigned mo<' + childId + '> to mo<' + parentId + '>');
      return childId;
    });
  }

  function createManagedObject(name, fragments) {
    var body = {
      name: name,
    };
    if (fragments) {
      _.assign(body, fragments);
    }
    var contentType = 'application/vnd.com.nsn.cumulocity.managedObject+json';
    return c8yRequest.post(
      'inventory/managedObjects',
      body,
      contentType
    ).then(function (res) {
      grunt.log.ok('Created managed object ' + res.name + ' with id: ' + res.id);
      return res.id;
    });
  }
};
