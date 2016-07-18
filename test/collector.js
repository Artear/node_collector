var assert = require('chai').assert;
var mockery = require('mockery');
var fakeredis = require('fakeredis');
var Collector = require('../lib/collector');

describe('Testing Collector', function () {
    before(function () {
        mockery.enable();
        mockery.registerMock('redis', fakeredis);
    });

    it('Should collect 5 times', function (done) {
        var call_count = 0;

        var collector = new Collector(
            '127.0.0.1',
            6379,
            'test_mam',
            1,
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
            '127.0.0.1',
            6379,
            'test_mam',
            1,
            50,
            function (saveFn) {
                call_count++;
                collector.stopCollecting();

                var timeout = setTimeout(function () {
                    if (call_count > 1) {
                        throw new Error("Should not be called more than 1 time. Was called " + call_count + " times.");
                    } else {
                        done();
                        clearTimeout(timeout);
                    }
                }, 100);
            });

        collector.startCollecting();
    });

    after(function () {
        mockery.disable();
    });
});
