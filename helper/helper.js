
module.exports = {
    getTimestampSeconds: function () {
        return Math.floor(new Date() / 1000);
    },

    generate_app_key: function (app_name, app_version) {
        return app_name + "_" + app_version;
    }
};