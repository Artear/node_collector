var logger = require('../helper/logger');
var helper = require('../helper/helper');
var redis = require('redis');

/**
 *
 * @param redis_client {RedisClient} Redis Client, created with redis.createClient();
 * @param app_name
 * @param app_version
 * @constructor
 */
function Subscriber(redis_client, app_name, app_version) {
    this.redis_client = redis_client;
    this.redisAppKey = helper.generate_app_key(app_name, app_version);
}

Subscriber.prototype.getValue = function (key, onDataFn) {
    var composed_key = this.redisAppKey + "_data_" + key;

    this.redis_client.get(
        composed_key,
        function (err, value) {
            onDataFn(err, getPayload(value));
        });
};

module.exports = Subscriber;


var getPayload = function (unparsedJson) {
    if (!!unparsedJson) {
        return JSON.parse(unparsedJson).payload;
    } else {
        return null;
    }
};