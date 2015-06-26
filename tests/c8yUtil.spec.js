'use strict';

var Q = require('q'),
  _ = require('lodash'),
  sinon = require('sinon'),
  proxyquire = require('proxyquire'),
  chai = require('chai');

describe('c8yUtil', function () {
  var grunt, c8yCredentials, c8yUtil;

  beforeEach(function () {
    grunt = {
      registerTask: sinon.stub(),
      log: {
        ok: sinon.stub(),
        debug: sinon.stub()
      }
    };
    c8yCredentials = function () {
      return {
        get: sinon.stub()
      };
    };
    c8yUtil = proxyquire('../lib/c8yUtil', {
      './c8yCredentials': c8yCredentials
    })(grunt);
  });

  it('should register a task', function () {
    var name = 'someTask';
    c8yUtil.registerAsync(name, function () {});
    var stub = grunt.registerTask;
    chai.expect(stub.calledOnce).to.be.true;
    chai.expect(stub.getCall(0).args[0]).to.equal(name);
  });

  describe('when task is run', function () {
    var callback, task;

    beforeEach(function () {
      callback = sinon.stub();
      c8yUtil.registerAsync('someTask', callback);
      var call = grunt.registerTask.getCall(0);
      task = call.args[1];
    });

    it('should call the provided callback', function () {
      var deferred = Q.defer();
      var done = function () {
        deferred.resolve();
      };
      var thisValue = {
        async: function () {
          return done;
        }
      };
      task = _.bind(task, thisValue);
      task();
      return deferred.promise.then(function () {
        chai.expect(callback.callCount).to.equal(1);
      });
    });
  });
});
