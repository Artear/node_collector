var logger = require('../helper/logger');
var helper = require('../helper/helper');
var redis = require('redis');
/**
 *
 * @param redis_client {RedisClient} Redis Client, created with redis.createClient();
 * @param redis_client_sub {RedisClient} A Second Redis Client, created with redis.createClient(), used for messaging;
 * @param app_name
 * @param app_version
 * @param onDataFn
 * @constructor
 */
function Subscriber(redis_client, redis_client_sub, app_name, app_version, onDataFn) {
    if (typeof(onDataFn) != 'function') {
        throw new Error('onDataFn must be a Function!')
    }
    this.redis_client = redis_client;
    this.redis_client_sub = redis_client_sub;
    this.onDataFn = onDataFn;
    this.redisAppKey = helper.generate_app_key(app_name, app_version);
}

Subscriber.prototype.startListening = function () {
    var _this = this;

    //Get all existing app data and send it
    this.getAllValues(_this.onDataFn);

    //Subscribe to new data
    this.redis_client_sub.on('message', function (channel, message) {
        _this.onDataFn(null, getPayload(message));
    });

    this.redis_client_sub.subscribe(this.redisAppKey);
};

Subscriber.prototype.getValue = function (key, onDataFn) {
    var composed_key = this.redisAppKey + "_data_" + key;

    this.redis_client.get(
        composed_key,
        function (err, value) {
            onDataFn(err, getPayload(value));
        });
};

Subscriber.prototype.getAllValues = function (onDataFn) {
    var _this = this;

    this.redis_client.scan(
        '0',
        'MATCH',
        this.redisAppKey + '_data_' + '*',
        function (err, result) {
            if (err) {
                throw err;
                //TODO handle error
                //TODO handle reconnect
            } else {
                var data_arr = result[1];

                logger.messageWithTitle("Data Arr", data_arr);

                for (var x = 0; x < data_arr.length; x++) {
                    _this.redis_client.get(
                        data_arr[x],
                        function (err, value) {
                            onDataFn(err, getPayload(value))
                        });
                }
            }
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