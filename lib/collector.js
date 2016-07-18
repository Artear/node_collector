var logger = require('../helper/logger');
var helper = require('../helper/helper');
var Message = require('./message');
var moment = require('moment');
var redis = require('redis');

/**
 *
 * @param redis_host {string} Redis host
 * @param redis_port {int} Redis port
 * @param app_name {string} App name
 * @param app_version {int} App version
 * @param interval {int} milliseconds interval for querying the Data Provider
 * @param onCollectFn {function} Called on each <i>interval</i>. The first parameter is the save(key, value, ttl) function you must use to persist and send the data to subscribers
 * @constructor
 */
function Collector(redis_host, redis_port, app_name, app_version, interval, onCollectFn) {
    if (typeof(onCollectFn) != 'function') {
        throw new Error('onCollectFn must be a function!');
    }

    this.intervalRef = null;
    this.interval = interval;
    this.onCollectFn = onCollectFn;
    this.redisOptions = {host: redis_host, port: redis_port};
    this.redisAppKey = helper.generate_app_key(app_name, app_version);
    this.redisClient = null;
}

Collector.prototype.startCollecting = function () {
    var _this = this;

    var internalOnCollect = function () {
        _this.onCollectFn(
            function (key, value, ttl_millis) {
                var message = new Message(value);
                var composed_key = _this.redisAppKey + "_" + key;

                var json_value = JSON.stringify(message);
                _this.redisClient.set(composed_key, json_value);

                if (ttl_millis === undefined || ttl_millis === null) {
                    ttl_millis = _this.interval * 10;
                }

                var expireTime = moment().add(ttl_millis, 'milliseconds').unix();

                _this.redisClient.expireat(composed_key, expireTime);
                _this.redisClient.publish(_this.redisAppKey, json_value);
            }
        );
    };

    this.redisClient = redis.createClient(this.redisOptions);
    
    this.redisClient.on("ready", function () {

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

    if (this.redisClient != null) {
        this.redisClient.quit();
    }
};

module.exports = Collector;



