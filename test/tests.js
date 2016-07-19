const test_app_name = 'test_mam';
const test_app_version = 1;

var assert = require('chai').assert;
var fakeredis = require('fakeredis');
var Collector = require('../lib/collector');
var Subscriber = require('../lib/subscriber');
var logger = require('../helper/logger');

describe('Testing Collector', function () {

    logger.mute();
    var redis_client = null;
    var redis_client_sub = null;

    beforeEach(function () {
        var redis_name = "random_" + Math.random() * 9999999;
        redis_client = fakeredis.createClient(redis_name, {fast: true});
        redis_client_sub = fakeredis.createClient(redis_name, {fast: true});
    });

    it('Should collect 5 times', function (done) {
        var call_count = 0;

        var collector = new Collector(
            redis_client,
            test_app_name,
            test_app_version,
            5,
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
            redis_client,
            test_app_name,
            test_app_version,
            5,
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
                }, 10);
            });

        collector.startCollecting();
    });

    it('Should send data to Subscriptors', function (done) {
        var test_key = "key";
        var test_data = "Un Cohete a la Luna";

        var collector = new Collector(
            redis_client,
            test_app_name,
            test_app_version,
            50,
            function (saveFn) {
                saveFn(test_key, test_data);
            }
        );

        var call_count = 0;

        var subscriber = new Subscriber(
            redis_client,
            redis_client_sub,
            test_app_name,
            test_app_version,
            function (data) {
                if (call_count == 0) {//only execute 1 time
                    call_count++;
                    assert.equal(test_data, data);
                    collector.stopCollecting();

                    done();
                }
            });

        subscriber.startListening();
        collector.startCollecting();
    });

    it('Collector Should get saved value', function (done) {
        var test_key = "key";
        var test_data = "Un Cohete a la Luna";

        var collector = new Collector(
            redis_client,
            test_app_name,
            test_app_version,
            100,
            function (saveFn) {
                collector.stopCollecting();

                saveFn(test_key, test_data, 50000, function (err, reply) {
                    if (err) {
                        throw err;
                    }

                    collector.getValue(test_key, function (err, value) {
                        if (err) {
                            throw err;
                        }

                        assert.equal(test_data, value);
                        done();
                    });
                });
            }
        );

        collector.startCollecting();
    });

    it('Subscriber Should get saved value', function (done) {
            var test_key = "key";
            var test_data = "Un Cohete a la Luna";

            var collector = new Collector(
                redis_client,
                test_app_name,
                test_app_version,
                50,
                function (saveFn) {
                    saveFn(test_key, test_data, 5000);
                    collector.stopCollecting();
                }
            );

            var subscriber = new Subscriber(
                redis_client,
                redis_client_sub,
                test_app_name,
                test_app_version,
                function (data) {
                    subscriber.getValue(test_key, function (err, value) {
                        if (err) {
                            throw err;
                        }

                        assert.equal(test_data, value);
                        done();
                    });
                });

            subscriber.startListening();
            collector.startCollecting();
        }
    );

    it('Collector 3 should become master', function (done) {

        var collector1_is_active = true;

        var collector1 = new Collector(
            redis_client,
            test_app_name,
            test_app_version,
            50,
            function (saveFn) {
                logger.messageWithTitle(collector1.name, "onCollect()");
            }
        );

        var collector2 = new Collector(
            redis_client,
            test_app_name,
            test_app_version,
            50,
            function (saveFn) {
                if (collector1_is_active) {
                    throw new Error(collector1.name + " is still active!");
                } else {
                    done();
                }
            }
        );

        logger.messageWithTitle(collector1.name, "Starting");

        /** Override these parameters for testing proposes */
        collector1.keep_alive_millis = 200;
        collector2.keep_alive_millis = 200;
        /** ********************************* **/

        collector1.startCollecting();

        var interval = setInterval(function () {
            clearInterval(interval);
            collector2.startCollecting();
        }, 200);

        var interval2 = setInterval(function () {
            clearInterval(interval2);
            logger.messageWithTitle(collector1.name, "=====> Stopping");
            collector1_is_active = false;
            collector1.stopCollecting();
        }, 500);
    });

});
