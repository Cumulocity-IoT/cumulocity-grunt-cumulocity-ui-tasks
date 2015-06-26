'use strict';

var _ = require('lodash'),
  sinon = require('sinon'),
  proxyquire = require('proxyquire'),
  chai = require('chai'),
  Q = require('q');


describe('c8yCreate', function () {
  var grunt, c8yRequest, c8yCreate;

  beforeEach(function () {
    grunt = {
      config: sinon.stub().returns(''),
      log: {
        ok: sinon.stub()
      }
    };
    c8yRequest = {};
    c8yCreate = proxyquire('../lib/c8yCreate', {
      './c8yRequest': sinon.stub().returns(c8yRequest)
    })(grunt);
  });

  describe('when creating managed objects', function () {
    describe('when name is not provided', function () {
      it('should reject', function () {
        return c8yCreate.managedObject().then(Q.reject).catch(function (err) {
          chai.expect(err).to.equal('name must be provided');
        });
      });
    });
    describe('when name is provided', function () {
      var mo = {id: 0};
      beforeEach(function () {
        c8yRequest.post = sinon.stub().returns(Q(mo));
      });
      it('should make a post request', function () {
        return c8yCreate.managedObject('test').then(function () {
          chai.expect(c8yRequest.post.calledOnce).to.be.true;
        });
      });
      it('should have name in request body', function () {
        var name = 'test';
        return c8yCreate.managedObject('test').then(function () {
          chai.expect(c8yRequest.post.getCall(0).args[1])
            .to.have.property('name', name);
        });
      });
      it('should return managed object id', function () {
        return c8yCreate.managedObject('test').then(function (id) {
          chai.expect(id).to.equal(mo.id);
        });
      });

      describe('when fragment is provided', function () {
        it('should append it to the request body', function () {
          return c8yCreate.managedObject('test', {someProp: 'someProp'}).then(function () {
            chai.expect(c8yRequest.post.getCall(0).args[1])
              .to.have.property('someProp', 'someProp');
          });
        });
      });
    });
  });

  describe('when creating groups', function () {
    var mo = {id: 'moId'};
    beforeEach(function () {
      c8yRequest.post = sinon.stub().returns(Q(mo));
    });

    describe('when name is not provided', function () {
      it('should reject', function () {
        return c8yCreate.group().then(Q.reject).catch(function (err) {
          chai.expect(err).to.equal('name must be provided');
        });
      });
    });

    it('should make a post request', function () {
      c8yRequest.post = sinon.stub().returns(Q(mo));
      return c8yCreate.group('test').then(function () {
        chai.expect(c8yRequest.post.calledOnce).to.be.true;
      });
    });

    it('should have group fragment in request body', function () {
      return c8yCreate.group('test').then(function () {
        var body = c8yRequest.post.getCall(0).args[1];
        chai.expect(body).to.have.property('c8y_IsDeviceGroup');
        chai.expect(body).to.have.property('type')
          .that.is.equal('c8y_DeviceGroup');
      });
    });

    it('should have name in request body', function () {
      var name = 'test';
      return c8yCreate.group(name).then(function () {
        chai.expect(c8yRequest.post.getCall(0).args[1])
          .to.have.property('name', name);
      });
    });

    it('should return id', function () {
      return c8yCreate.group('test').then(function (id) {
        chai.expect(id).to.equal(mo.id);
      });
    });
  });

  describe('when creating devices', function () {
    var mo = {id: 'moId'};
    beforeEach(function () {
      c8yRequest.post = sinon.stub().returns(Q(mo));
    });

    describe('when name is not provided', function () {
      it('should reject', function () {
        return c8yCreate.device().then(Q.reject).catch(function (err) {
          chai.expect(err).to.equal('name must be provided');
        });
      });
    });

    it('should make a post request', function () {
      c8yRequest.post = sinon.stub().returns(Q(mo));
      return c8yCreate.device('test').then(function () {
        chai.expect(c8yRequest.post.calledOnce).to.be.true;
      });
    });

    it('should have device fragment in request body', function () {
      return c8yCreate.device('test').then(function () {
        chai.expect(c8yRequest.post.getCall(0).args[1])
          .to.have.property('c8y_IsDevice');
      });
    });

    it('should have name in request body', function () {
      var name = 'test';
      return c8yCreate.device(name).then(function () {
        chai.expect(c8yRequest.post.getCall(0).args[1])
          .to.have.property('name', name);
      });
    });

    it('should return id', function () {
      return c8yCreate.device('test').then(function (id) {
        chai.expect(id).to.equal(mo.id);
      });
    });

    describe('when group id is provided', function () {
      var groupId;
      beforeEach(function () {
        groupId = 'groupId';
      });

      it('should make another request to assign to the group', function () {
        return c8yCreate.device('test', groupId).then(function () {
          chai.expect(c8yRequest.post.calledTwice).to.be.true;
        });
      });

      it('should have device id in request body', function () {
        return c8yCreate.device('test', groupId).then(function () {
          chai.expect(c8yRequest.post.getCall(1).args[1])
            .to.have.property('managedObject').that.deep.equals({id: mo.id});
        });
      });

      it('should make request to the correct path', function () {
        return c8yCreate.device('test', groupId).then(function () {
          chai.expect(c8yRequest.post.getCall(1).args[0])
            .to.equal(
              'inventory/managedObjects/' + groupId + '/childAssets'
            );
        });
      });

      it('should return id', function () {
        return c8yCreate.device('test').then(function (id) {
          chai.expect(id).to.equal(mo.id);
        });
      });
    });
  });

  describe('when creating child devices', function () {
    var mo = {id: 'moId'};
    var deviceId = 'aDeviceId';
    beforeEach(function () {
      c8yRequest.post = sinon.stub().returns(Q(mo));
    });

    describe('when name is not provided', function () {
      it('should reject', function () {
        return c8yCreate.childDevice(undefined, deviceId)
          .then(Q.reject).catch(function (err) {
            chai.expect(err).to.equal('name must be provided');
          });
      });
    });

    describe('when device id is not provided', function () {
      it('should reject', function () {
        return c8yCreate.childDevice('test')
          .then(Q.reject).catch(function (err) {
            chai.expect(err).to.equal('device id must be provided');
          });
      });
    });

    it('should make two post request', function () {
      c8yRequest.post = sinon.stub().returns(Q(mo));
      return c8yCreate.childDevice('test', deviceId).then(function () {
        chai.expect(c8yRequest.post.calledTwice).to.be.true;
      });
    });

    it('should not have device fragment in request body', function () {
      return c8yCreate.childDevice('test', deviceId).then(function () {
        chai.expect(c8yRequest.post.getCall(0).args[1])
          .to.not.have.property('c8y_IsDevice');
      });
    });

    it('should have name in request body', function () {
      var name = 'test';
      return c8yCreate.childDevice(name, deviceId).then(function () {
        chai.expect(c8yRequest.post.getCall(0).args[1])
          .to.have.property('name', name);
      });
    });

    it('should return id', function () {
      return c8yCreate.childDevice('test', deviceId).then(function (id) {
        chai.expect(id).to.equal(mo.id);
      });
    });

    it('should have device id in assign request', function () {
      return c8yCreate.childDevice('test', deviceId).then(function () {
        chai.expect(c8yRequest.post.getCall(1).args[1])
          .to.have.property('managedObject').that.is.deep.equal({id: mo.id});
      });
    });

    it('should make assign request to correct path', function () {
      return c8yCreate.childDevice('test', deviceId).then(function () {
        chai.expect(c8yRequest.post.getCall(1).args[0])
          .to.equal('inventory/managedObjects/' + deviceId + '/childDevices');
      });
    });
  });

  describe('when creating measurements', function () {
    var mo = {id: 'moId'},
      deviceId = 'aDeviceId',
      value = 22,
      fragment = 'aFragment',
      series = 'aSeries';

    beforeEach(function () {
      c8yRequest.post = sinon.stub().returns(Q(mo));
    });

    describe('when device id is not provided', function () {
      it('should reject', function () {
        return c8yCreate.measurement(undefined, value)
          .then(Q.reject).catch(function (err) {
            chai.expect(err).to.equal('device id must be provided');
          });
      });
    });

    describe('when value is not a valid number', function () {
      function testNumber(num) {
        return c8yCreate.measurement(deviceId, num)
          .then(Q.reject).catch(function (err) {
            chai.expect(err).to.equal('value must be a number');
          });
      }
      describe('when it is undefined', function () {
        it('should reject', _.partial(testNumber, undefined));
      });

      describe('when it is a string not convertible to a number', function () {
        it('should reject', _.partial(testNumber, 'notANumber'));
      });

      describe('when it is an empty string', function () {
        it('should reject', _.partial(testNumber, ' '));
      });

      describe('when it is not finite', function () {
        it('should reject', _.partial(testNumber, NaN));
      });

      describe('when it is not a string nor a number', function () {
        it('should reject', _.partial(testNumber, {}));
      });
    });

    describe('when value is a valid number', function () {
      function testNumber(num) {
        return c8yCreate.measurement(deviceId, num);
      }
      describe('when it is a positive number', function () {
        it('should not reject', _.partial(testNumber, value));
      });

      describe('when it is a string convertible to number', function () {
        it('should not reject', _.partial(testNumber, '5'));
      });

      describe('when it is zero', function () {
        it('should not reject', _.partial(testNumber, 0));
      });

      describe('when it is a negative number', function () {
        it('should not reject', _.partial(testNumber, -5));
      });
    });

    it('should make a post request', function () {
      c8yCreate.measurement(deviceId, value).then(function () {
        chai.expect(c8yRequest.post.calledOnce).to.be.true;
      });
    });

    it('should have time in request body', function () {
      c8yCreate.measurement(deviceId, value).then(function () {
        chai.expect(c8yRequest.post.getCall(0).args[1])
        .to.have.property('time');
      });
    });

    it('should have device id in request body', function () {
      c8yCreate.measurement(deviceId, value).then(function () {
        chai.expect(c8yRequest.post.getCall(0).args[1])
        .to.have.property('source').that.is.deep.equal({ id: deviceId });
      });
    });

    it('should have device type in request body', function () {
      c8yCreate.measurement(deviceId, value).then(function () {
        chai.expect(c8yRequest.post.getCall(0).args[1])
        .to.have.property('type').that.is.equal('c8y_TemperatureMeasurement');
      });
    });

    it('should have default fragment/series for temperature in request body', function () {
      c8yCreate.measurement(deviceId, value).then(function () {
        chai.expect(c8yRequest.post.getCall(0).args[1])
        .to.have.property('c8y_TemperatureMeasurement')
        .that.is.deep.equal({ T: { value: value, unit: 'C' }});
      });
    });

    it('should return measurement id', function () {
      c8yCreate.measurement(deviceId, value).then(function (id) {
        chai.expect(id).to.equal(mo.id);
      });
    });

    describe('when fragment/series are provided', function () {
      it('should have them in request body', function () {
        c8yCreate.measurement(deviceId, value, fragment, series)
          .then(function () {
            var body = c8yRequest.post.getCall(0).args[1];
            chai.expect(body).to.have.property(fragment);
            chai.expect(body)
              .to.have.deep.property(fragment + '.' + series)
              .that.is.deep.equal({ value: value, unit: 'C' });
            chai.expect(body)
              .to.have.property('type').that.is.equal(fragment);
          });
      });
    });
  });
});
