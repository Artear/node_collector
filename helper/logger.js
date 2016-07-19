var mute = false;

module.exports = {
    mute: function (mute_value) {
        if (typeof mute_value === 'undefined') {
            mute_value = true;
        }
        mute = Boolean(mute_value);
    },
    messageWithTitle: function (title, message) {
        logMessage(title, JSON.stringify(message));
    },
    message: function () {

        var message = '';

        for (var i = 0; i < arguments.length; i++) {
            message += JSON.stringify(arguments[i]);
        }

        logMessage('Message', message);
    }
};

var getBeatuyfullTime = function () {
    return new Date()
        .toISOString()
        .replace(/T/, ' ').// replace T with a space
        replace(/\..+/, '');
};

var logMessage = function (title, message) {
    if (!mute) {
        console.log("************ " + title + " ************");
        console.log(message);
        console.log(getBeatuyfullTime());
        console.log("*********************************");
    }
};