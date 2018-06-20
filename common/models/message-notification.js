'use strict';

module.exports = function (Messagenotification) {

    //     /**
    //      * get Count Of Unread message
    //      * @param {Function(Error, number)} callback
    //      */

    //     Messagenotification.prototype.myCountUnread = function (callback) {
    //         var result;

    //         Messagenotification.find({ where: { to: "5b02d2d908ca0e2b6809acb7" } }, function (err, messageNotification) {
    //             if (err)
    //                 callback(err, null);

    //             callback(null, messageNotification.length);

    //         })
    //         // TODO
    //     };


    var sendNewNotification = function (data) {
        var headers = {
            "Content-Type": "application/json; charset=utf-8",
            "Authorization": "Basic YWE2MTJjOWItYzY4MC00ZWRjLThlZTQtYTNmOGI5MjY2Y2Zm"
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

    Messagenotification.afterRemote('create', function (context, messageNotification, next) {
        // messageNotification.from(function (err, fromUser) {
        Messagenotification.app.models.User.findById(messageNotification.to, function (err, toUser) {

            if (toUser.isActive == false)
                Messagenotification.app.models.User.findById(messageNotification.from, function (err, fromUser) {
                    var message = {
                        "app_id": "e8a91e90-a766-4f1b-a47e-e3b3f569dbef",
                        "included_segments ": ["Active Users", "Inactive Users"],
                        "contents": { "en": "new message from " + fromUser.username }
                        , "filters": [
                            { "field": "tag", "key": "user_id", "relation": "=", "value": messageNotification.to }
                        ]
                    }
                    sendNewNotification(message);
                })
            next();
        })
    });

    /**
     * unread Message count
     * @param {string} userId
     * @param {Function(Error, number)} callback
     */

    Messagenotification.unreadMessage = function (userId, callback) {
        Messagenotification.find({ where: { to: userId, expiredDate: { gt: new Date() } } }, function (err, messageNotification) {
            if (err)
                callback(err, null);
            if (messageNotification == null)
                callback(null, 0);

            else
                callback(null, messageNotification.length);

        })
    };


    /**
 * delete my unread notification
 * @param {string} userId
 * @param {Function(Error)} callback
 */

    Messagenotification.deleteMyNot = function (userId, callback) {
        // TODO
        Messagenotification.destroyAll({ to: userId }, function (err, obj) {

            callback(null);
        });

    };
};
