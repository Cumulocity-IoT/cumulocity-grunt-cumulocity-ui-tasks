var _ = require('lodash'),
  sinon = require('sinon'),
  proxyquire = require('proxyquire'),
  chai = require('chai');

describe('c8yCredentials', function () {
  var grunt, inquirer, c8yCredentials;
  var credentials = {
    tenant: 'tenant',
    user: 'user',
    password: 'password'
  };

  beforeEach(function () {
    grunt = {
      config: sinon.stub().returns(''),
      log: {
        ok: sinon.stub(),
        debug: sinon.stub()
      },
      file: {
        exists: sinon.stub().returns(false),
        write: sinon.stub()
      }
    };
    inquirer = {
      prompt: sinon.stub()
    };
    c8yCredentials = proxyquire('../lib/c8yCredentials', {
      'inquirer': inquirer
    })(grunt);
  });

  describe('when process has auth info', function () {
    beforeEach(function () {
      process.env.C8Y_TENANT = credentials.tenant;
      process.env.C8Y_USER = credentials.user;
      process.env.C8Y_PASS = credentials.password;
    });

    it('should not prompt', function () {
      return c8yCredentials.get().then(function () {
        chai.expect(inquirer.prompt.called).to.be.false;
      });
    });

    it('should return credentials', function () {
      return c8yCredentials.get().then(function (_credentials) {
        chai.expect(_credentials).to.deep.equal(credentials);
      });
    });
  });

  describe('when .cumulocity has auth info', function () {
    beforeEach(function () {
      grunt.file = {
        exists: sinon.stub().returns(true),
        readJSON: sinon.stub().returns(_.omit(credentials, 'password'))
      };
      inquirer.prompt.callsArgWith(1, _.pick(credentials, 'password'));
    });

    it('should prompt only for password', function () {
      return c8yCredentials.get().then(function () {
        chai.expect(inquirer.prompt.calledOnce).to.be.true;
        chai.expect(inquirer.prompt.getCall(0).args[0][0].name)
          .to.equal('password');
      });
    });

    it('should return credentials', function () {
      return c8yCredentials.get().then(function (_credentials) {
        chai.expect(_credentials).to.deep.equal(credentials);
      });
    });
  });

  describe('when no auth info is preconfigured', function () {
    var stub;
    beforeEach(function () {
      stub = inquirer.prompt;
      stub.onCall(0).callsArgWith(1, _.omit(credentials, 'password'));
      stub.onCall(1).callsArgWith(1, _.pick(credentials, 'password'));
    });
    it('should prompt for all auth info', function () {

      return c8yCredentials.get().then(function () {
        var messages = [];
        _.forEach(_.range(stub.callCount), function (idx) {
          messages = _.union(messages, stub.getCall(idx).args[0]);
        });
        chai.expect(messages).to.have.length(3);
        chai.expect(_.any(messages, {name: 'tenant'})).to.be.true;
        chai.expect(_.any(messages, {name: 'user'})).to.be.true;
        chai.expect(_.any(messages, {name: 'password'})).to.be.true;
      });
    });

    it('should return credentials', function () {
      return c8yCredentials.get().then(function (_credentials) {
        chai.expect(_credentials).to.deep.equal(credentials);
      });
    });
  });

  afterEach(function () {
    delete process.env.C8Y_TENANT;
    delete process.env.C8Y_USER;
    delete process.env.C8Y_PASS;
  });
});
