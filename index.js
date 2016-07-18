var Collector = require("./lib/collector");
var Subscriber = require("./lib/subscriber");

module.exports = function () {
    this.collector = Collector;
    this.subscriber = Subscriber;
};