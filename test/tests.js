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
    var collector = null;
    var collector2 = null;
    var subscriber = null;

    beforeEach(function () {
        var redis_name = "random_" + Math.random() * 9999999;
        redis_client = fakeredis.createClient(redis_name, {fast: true});
        redis_client_sub = fakeredis.createClient(redis_name, {fast: true});
    });

    afterEach(function () {
        if (collector != null) {
            collector.stopCollecting();
            collector = null;
        }
        if (collector2 != null) {
            collector2.stopCollecting();
            collector2 = null;
        }
    });

    it('Should collect 5 times', function (done) {
        var call_count = 0;

        collector = new Collector(
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

        collector = new Collector(
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

        collector = new Collector(
            redis_client,
            test_app_name,
            test_app_version,
            50,
            function (saveFn) {
                saveFn(test_key, test_data);
            }
        );

        var call_count = 0;

        subscriber = new Subscriber(
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

        collector = new Collector(
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

            collector = new Collector(
                redis_client,
                test_app_name,
                test_app_version,
                50,
                function (saveFn) {
                    saveFn(test_key, test_data, 5000);
                    collector.stopCollecting();
                }
            );

            subscriber = new Subscriber(
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

    it('Collector 2 should become master', function (done) {

        var collector1_is_active = true;

        collector = new Collector(
            redis_client,
            test_app_name,
            test_app_version,
            50,
            function (saveFn) {
                logger.messageWithTitle(collector.name, "onCollect()");
            }
        );

        collector2 = new Collector(
            redis_client,
            test_app_name,
            test_app_version,
            50,
            function (saveFn) {
                if (collector1_is_active) {
                    throw new Error(collector.name + " is still active!");
                } else {
                    done();
                }
            }
        );

        logger.messageWithTitle(collector.name, "Starting");

        /** Override these parameters for testing proposes */
        collector.keep_alive_millis = 200;
        collector2.keep_alive_millis = 200;
        /** ********************************* **/

        collector.startCollecting();

        var interval = setInterval(function () {
            clearInterval(interval);
            collector2.startCollecting();
        }, 200);

        var interval2 = setInterval(function () {
            clearInterval(interval2);
            logger.messageWithTitle(collector.name, "=====> Stopping");
            collector1_is_active = false;
            collector.stopCollecting();
        }, 500);
    });

    it('Subscriptor Should recover previously saved data', function (done) {
        var test_key = "key";
        var test_data = "Un Cohete a la Luna";

        collector = new Collector(
            redis_client,
            test_app_name,
            test_app_version,
            100,
            function (saveFn) {
                collector.stopCollecting();
                saveFn(test_key, test_data, 2000);
            });

        /** Override these parameters for testing proposes */
        collector.keep_alive_millis = 100;
        /** ********************************* **/

        subscriber = new Subscriber(
            redis_client,
            redis_client_sub,
            test_app_name,
            test_app_version,
            function (data) {
                assert.equal(test_data, data);
                done();
            });

        collector.startCollecting();

        var interval = setInterval(function () {
            clearInterval(interval);
            subscriber.startListening();
        }, 200);
    });

    it('Collector Should respect ttl', function (done) {
        var test_key_short_ttl = "short_key";
        var test_key_long_ttl = "long_key";
        var test_data = "Un Cohete a la Luna";

        collector = new Collector(
            redis_client,
            test_app_name,
            test_app_version,
            50,
            function (saveFn) {
                collector.stopCollecting();
                saveFn(test_key_long_ttl, test_data, 2000);
                saveFn(test_key_short_ttl, test_data);
            });

        collector.default_ttl_millis = 1;
        collector.startCollecting();

        var interval = setInterval(function () {
            clearInterval(interval);
            collector.getValue(test_key_long_ttl,
                function (err, value) {
                    assert.equal(test_data, value);

                    collector.getValue(test_key_short_ttl,
                        function (err, no_value) {
                            assert.equal(null, no_value);
                            done();
                        });
                })
        }, 200);
    });

    it('Collector Should get null value safely', function (done) {
        var test_nonexisting_key = "nonexisting_key";

        collector = new Collector(
            redis_client,
            test_app_name,
            test_app_version,
            50,
            function (saveFn) {
            });

        collector.getValue(test_nonexisting_key,
            function (err, value) {
                assert.equal(null, value);
                done();
            })
    });

    it('Subscriber Should get null value safely', function (done) {
        var test_nonexisting_key = "nonexisting_key";

        subscriber = new Subscriber(
            redis_client,
            redis_client_sub,
            test_app_name,
            test_app_version,
            function (data) {
            });

        subscriber.getValue(test_nonexisting_key,
            function (err, value) {
                assert.equal(null, value);
                done();
            })
    });

});
