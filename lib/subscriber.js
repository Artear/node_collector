var logger = require('../helper/logger');
var helper = require('../helper/helper');
var redis = require('redis');

function Subscriber(redis_host, redis_port, app_name, app_version, onDataFn) {
    if (typeof(onDataFn) != 'function') {
        throw new Error('onDataFn must be a Function!')
    }
    this.onDataFn = onDataFn;
    this.redisOptions = {host: redis_host, port: redis_port};
    this.redisAppKey = helper.generate_app_key(app_name, app_version);
}

Subscriber.prototype.startListening = function () {
    var _this = this;
    var redisSubClient = redis.createClient(this.redisOptions); //we need a unique connection for SubscribeClient on Redis
    var redisClient = redis.createClient(this.redisOptions);

    //Get all existing app data and send it
    redisClient.scan('0', 'MATCH', _this.redisAppKey + '*', function (err, result) {
        if (err) {
            //TODO handle error
            //TODO handle reconnect
        } else {
            var data_arr = result[1];

            for (var x = 0; x < data_arr.length; x++) {

                redisClient.get(data_arr[x], function (err, reply) {
                    if (err) {
                        //TODO handle error
                        //TODO handle reconnect
                    } else {
                        _this.onDataFn(getPayload(reply));
                    }
                });

            }
        }
    });

    //Subscribe to new data
    redisSubClient.on('message', function (channel, message) {
        _this.onDataFn(getPayload(message));
    });
    redisSubClient.subscribe(this.redisAppKey);
};

module.exports = Subscriber;


var getPayload = function (unparsedJson) {
    return JSON.parse(unparsedJson).payload;
};