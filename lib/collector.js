var logger = require('../helper/logger');
var helper = require('../helper/helper');
var Message = require('./message');
var moment = require('moment');
var redis = require('redis');
var superheroes = require('superheroes');

/**
 *
 * @param redis_client {RedisClient} Redis Client, created with redis.createClient();
 * @param app_name {string} App name
 * @param app_version {int} App version
 * @param interval {int} milliseconds interval for querying the Data Provider
 * @param onCollectFn {function} Called on each <i>interval</i>. The first parameter is the save(key, value, ttl, callback) function you must use to persist and send the data to subscribers
 * @constructor
 */
function Collector(redis_client, app_name, app_version, interval, onCollectFn) {
    if (typeof(onCollectFn) != 'function') {
        throw new Error('onCollectFn must be a function!');
    }

    this.name = superheroes.random();
    this.keep_alive_millis = 30000;
    this.redis_client = redis_client;
    this.intervalRef = null;
    this.keepAliveIntervalRef = null;
    this.interval = interval;
    this.default_ttl_millis = interval * 10;
    this.onCollectFn = onCollectFn;
    this.redisAppKey = helper.generate_app_key(app_name, app_version);
}

Collector.prototype.startCollecting = function () {
    var _this = this;

    var internalOnCollect = function () {
        _this.onCollectFn(
            function (key, value, ttl_millis, callback) {
                var message = new Message(value);
                var composed_key = _this.redisAppKey + "_data_" + key;

                var json_value = JSON.stringify(message);
                _this.redis_client.set(composed_key, json_value, callback);

                if (ttl_millis === undefined || ttl_millis === null) {
                    ttl_millis = _this.default_ttl_millis;
                }

                var expireTime = moment().add(ttl_millis, 'milliseconds').unix();

                _this.redis_client.expireat(composed_key, expireTime);
            }
        );
    };

    var internalStartCollecting = function () {
        //call onCollect immediately
        var immediate = setImmediate(function () {
            internalOnCollect();
            clearImmediate(immediate);
        });

        _this.intervalRef = setInterval(internalOnCollect, _this.interval);
    };

    var internalKeepAlive = function () {
        var key_collector_master = _this.redisAppKey + "_collector_master";
        var key_last_updated = _this.redisAppKey + "_last_updated";
        var currentTime = moment();

        _this.redis_client.get(key_collector_master, function (err, value) {

            if (value != _this.name) {
                logger.messageWithTitle(_this.name, value + " is Master, checking last updated...");

                _this.redis_client.get(key_last_updated, function (err, last_updated_str) {

                    var last_update_diff = Math.abs(moment(last_updated_str).diff(currentTime));
                    var tolerance = _this.keep_alive_millis * 2;
                    logger.messageWithTitle(_this.name, "Last update was " + last_update_diff + " ago, tolerance is " + tolerance);

                    if (last_updated_str === null || last_update_diff > tolerance) {
                        logger.messageWithTitle(_this.name, "I'm taking Master rol");
                        _this.redis_client.set(key_collector_master, _this.name);
                        _this.redis_client.set(key_last_updated, currentTime.toISOString());
                        internalStartCollecting();
                    }
                });
            } else {
                logger.messageWithTitle(_this.name, "I'm Master, saving last updated time...");
                _this.redis_client.set(key_last_updated, currentTime.toISOString());
            }
        });
    };

    var keepAliveImmediate = setImmediate(function () {
        internalKeepAlive();
        clearImmediate(keepAliveImmediate);
    });

    this.keepAliveIntervalRef = setInterval(internalKeepAlive, this.keep_alive_millis);
};

Collector.prototype.stopCollecting = function () {
    if (this.intervalRef != null) {
        clearInterval(this.intervalRef);
    }

    if (this.keepAliveIntervalRef != null) {
        clearInterval(this.keepAliveIntervalRef);
    }
};

Collector.prototype.getValue = function (key, onValueFn) {
    var composed_key = this.redisAppKey + "_data_" + key;

    this.redis_client.get(composed_key, function (err, value) {
        if (!!value) {
            onValueFn(err, JSON.parse(value).payload);
        } else {
            onValueFn(err, null);
        }
    });
};

module.exports = Collector;



