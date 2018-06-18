'use strict';

module.exports = function (Notification) {
    var sendNewNotification = function (data) {
        var headers = {
            "Content-Type": "application/json; charset=utf-8",
            "Authorization": "Basic OGExY2MwMzctOWY5MC00ZGI2LTgyNTktNGUwMTljOGQ3ZDVj"
        };

        var options = {
            host: "onesignal.com",
            port: 443,
            path: "/api/v1/notifications",
            method: "POST",
            headers: headers
        };

        var https = require('https');
        var req = https.request(options, function (res) {
            res.on('data', function (data) {
                console.log("Response:");
                console.log(JSON.parse(data));
            });
        });

        req.on('error', function (e) {
            console.log("ERROR:");
            console.log(e);
        });

        req.write(JSON.stringify(data));
        req.end();
    };


    /**
     * send notification by onesignal
     * @param {object} data
     * @param {Function(Error, object)} callback
     */


// {"content" : {"en": "English Message"},
// "userId":"5b001ca3f683ce7622a21c52"}


    Notification.sendNotification = function (data, callback) {
        var result = [];
        var message = {
            "app_id": "3754a01e-b355-4248-a906-e04549e6ab32",
            "included_segments ": ["Active Users", "Inactive Users"],
            "contents": data.content
            , "filters": [
                { "field": "tag", "key": "user_id", "relation": "=", "value": data.userId }
            ]
        }
        sendNewNotification(message);
        var notification = { 'ownerId': data.userId, 'type': "Custom-Notification", 'body': { 'message': data.content } }
        Notification.create(
            notification,
            function(err, newUser) {
                if (err)
                    callback(err, null);
                callback(null, result);            
        })
        // TODO
    };

};
