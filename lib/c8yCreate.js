module.exports = function (grunt) {
  var Q = require('q'),
    _ = require('lodash'),
    moment = require('moment'),
    c8yRequest = require('./c8yRequest')(grunt);

  var DEFAULT_FRAGMENT = 'c8y_TemperatureMeasurement',
    DEFAULT_SERIES = 'T',
    DEFAULT_UNIT = 'C';

  function createManagedObject(name, fragments) {
    if (!name) {
      return Q.reject('name must be provided');
    }

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

  function createMeasurement(deviceId, value, fragment, series) {
    value = _.isString(value) && _.isEmpty(value.trim()) ? NaN : Number(value);
    if (!deviceId) {
      return Q.reject('device id must be provided');
    }
    if (!_.isFinite(value)) {
      return Q.reject('value must be a number');
    }
    if (!fragment) {
      fragment = DEFAULT_FRAGMENT;
    }
    if(!series) {
      series = DEFAULT_SERIES;
    }
    var body = {
      time: moment().format(),
      source: {
        id: deviceId
      },
      type: fragment
    };

    body[fragment] = {};
    body[fragment][series] = {
      value: value,
      unit: DEFAULT_UNIT
    };

    var contentType = 'application/vnd.com.nsn.cumulocity.measurement+json';

    return c8yRequest.post(
      'measurement/measurements',
      body,
      contentType
    ).then(function (res) {
      grunt.log.ok('Created measurement for device<' + deviceId + '> with value: ' + value);
      return res.id;
    });
  }

  function createGroup(name) {
    var body = {
      c8y_IsDeviceGroup: {},
      type: 'c8y_DeviceGroup'
    };
    return createManagedObject(name, body);
  }

  function createDevice(name, groupId, fragments) {

    fragments = _.merge(fragments || {}, {c8y_IsDevice: {}});
    var promise = createManagedObject(name, fragments);
    if (groupId) {
      promise = promise
        .then(_.partial(assignChildAsset, groupId));
    }
    return promise;
  }

  function createChildDevice(name, deviceId) {
    if (!deviceId) {
      return Q.reject('device id must be provided');
    }
    return createManagedObject(name).then(function (newId) {
      return assignChildDevice(deviceId, newId);
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

  return {
    managedObject: createManagedObject,
    measurement: createMeasurement,
    group: createGroup,
    device: createDevice,
    childDevice: createChildDevice
  };
};
