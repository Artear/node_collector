var assert = require('chai').assert;
var mockery = require('mockery');
var fakeredis = require('fakeredis');
var Collector = require('../lib/collector');
var Subscriber = require('../lib/subscriber');


var fake_redis_ip = '127.0.0.1';
var fake_redis_port = 6379;
var test_app_name = 'test_mam';
var test_app_version = 1;


describe('Testing Collector', function () {
    before(function () {
        mockery.enable();
        mockery.registerMock('redis', fakeredis);
    });

    it('Should collect 5 times', function (done) {
        var call_count = 0;

        var collector = new Collector(
            fake_redis_ip,
            fake_redis_port,
            test_app_name,
            test_app_version,
            50,
            function (saveFn) {
                call_count++;

                if (call_count == 5) {
                    done();
                }
            });

        collector.startCollecting();
    });

    it('Should collect 1 time, and then stop collection', function (done) {
        var call_count = 0;

        var collector = new Collector(
            fake_redis_ip,
            fake_redis_port,
            test_app_name,
            test_app_version,
            50,
            function (saveFn) {
                call_count++;
                collector.stopCollecting();

                var timeout = setTimeout(function () {
                    if (call_count > 1) {
                        throw new Error("Should not be called more than 1 time. Was called " + call_count + " times.");
                    } else {
                        done();
                    }

                    clearTimeout(timeout);
                }, 100);
            });

        collector.startCollecting();
    });

    it('Should send data to Subscriptors', function (done) {
        var test_key = "key";
        var test_data = "Un Cohete a la Luna";

        var collector = new Collector(
            fake_redis_ip,
            fake_redis_port,
            test_app_name,
            test_app_version,
            50,
            function (saveFn) {
                saveFn(test_key, test_data);
            }
        );

        var subscriber = new Subscriber(
            fake_redis_ip,
            fake_redis_port,
            test_app_name,
            test_app_version,
            function (data) {
                assert.equal(test_data, data);
                done();
            });

        subscriber.startListening();
        collector.startCollecting();
    });

    after(function () {
        mockery.disable();
    });
});
