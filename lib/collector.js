var logger = require('../helper/logger');
var helper = require('../helper/helper');
var Message = require('./message');
var moment = require('moment');
var redis = require('redis');

/**
 *
 * @param redis_client {redis} Redis Client, created with redis.createClient();
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

    this.redis_client = redis_client;
    this.intervalRef = null;
    this.interval = interval;
    this.onCollectFn = onCollectFn;
    this.redisAppKey = helper.generate_app_key(app_name, app_version);
}

Collector.prototype.startCollecting = function () {
    var _this = this;

    var internalOnCollect = function () {
        _this.onCollectFn(
            function (key, value, ttl_millis, callback) {
                var message = new Message(value);
                var composed_key = _this.redisAppKey + "_" + key;

                var json_value = JSON.stringify(message);
                _this.redis_client.set(composed_key, json_value, callback);

                if (ttl_millis === undefined || ttl_millis === null) {
                    ttl_millis = _this.interval * 10;
                }

                var expireTime = moment().add(ttl_millis, 'milliseconds').unix();

                _this.redis_client.expireat(composed_key, expireTime);
                _this.redis_client.publish(_this.redisAppKey, json_value);
            }
        );
    };

    this.redis_client.on("ready", function () {

        //call onCollect immediately
        var immediate = setImmediate(function () {
            internalOnCollect();
            clearImmediate(immediate);
        });

        _this.intervalRef = setInterval(internalOnCollect, _this.interval);
    });
};

Collector.prototype.stopCollecting = function () {
    if (this.intervalRef != null) {
        clearInterval(this.intervalRef)
    }
};

Collector.prototype.getValue = function (key, onValueFn) {
    var composed_key = this.redisAppKey + "_" + key;

    this.redis_client.get(composed_key, function (err, value) {
        onValueFn(err, JSON.parse(value).payload);
    });
};

module.exports = Collector;



