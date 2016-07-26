# Node Collector

master [![CircleCI](https://circleci.com/gh/Artear/node_collector/tree/master.svg?style=svg)](https://circleci.com/gh/Artear/node_collector/tree/master)

Node Collector is a node module built to collect data from any source, and distribute it to different subscribers.

It's intended to scale across different servers, so you could for example spawn 1 Collectors, and 5 Subscribers in 6 different servers, and as long as they all have the same app_name/app_version, and are connected to the same redis, they will all be synchronized.

If you run 2 or more Collectors in the same app_name/app_version, they will automatically handle a master/slave logic.

When a Subscriber is started, it will automatically receive all previously sent data.   

It uses redis to pub/sub operations and storage.

##Usage
        var collector = new Collector(
            redis_client,
            test_app_name,
            test_app_version,
            500,
            function (saveFn) {
                saveFn(test_key, test_data);
            }
        );

        var subscriber = new Subscriber(
            redis_client,
            redis_client_sub,
            test_app_name,
            test_app_version,
            function (data) {
                  console.log(data);
                }
            });

        subscriber.startListening();
        collector.startCollecting();
        
        

For more use cases, see the [test file](test/tests.js)
