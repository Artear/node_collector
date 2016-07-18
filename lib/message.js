var Helpers = require('../helper/helper');

function Message(payload) {
    this.createdSeconds = Helpers.getTimestampSeconds();
    this.payload = payload;
}

module.exports = Message;