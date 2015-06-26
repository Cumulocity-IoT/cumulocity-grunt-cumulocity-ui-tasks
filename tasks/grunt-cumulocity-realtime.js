'use strict';

module.exports = function (grunt) {

  var _ = require('lodash'),
    Q = require('q'),
    c8yUtil = require('../lib/c8yUtil')(grunt),
    c8yCreate = require('../lib/c8yCreate')(grunt),
    c8yRequest = require('../lib/c8yRequest')(grunt);

  var DEFAULT_MIN = 0,
    DEFAULT_MAX = 100;


  c8yUtil.registerAsync('realtime:measurements', createMeasurements);

  function createMeasurements(credentials, deviceId, fragment, series, min, max) {
    var deferred = Q.defer();
    c8yRequest.setCredentials(credentials);
    min = Number(min) || DEFAULT_MIN;
    max = Number(max) || DEFAULT_MAX;

    function createMeasurement() {
      setTimeout(function () {
        var value = _.random(min, max);
        c8yCreate.measurement(deviceId, value, fragment, series).then(createMeasurement);
      }, 2000);
    }

    createMeasurement();
    return deferred.promise;
  }
};
