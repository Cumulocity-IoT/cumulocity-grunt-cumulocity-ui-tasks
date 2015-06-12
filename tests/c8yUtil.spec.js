'use strict';

var sinon = require('sinon'),
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
      callback = function () {};
      c8yUtil.registerAsync('someTask', callback);
      task = grunt.registerTask.getCall(0).args[1];
    });
  });
});
