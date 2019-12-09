'use strict';

module.exports = function (Notification) {
  var serviceAccount = require("../../server/boot/serviceAccountKey.json");

  var sendNewNotification = function (data) {
    var headers = {
      "Content-Type": "application/json; charset=utf-8",
      "Authorization": serviceAccount.AuthorizationOneSignel

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
        //console.log("Response:");
        //console.log(JSON.parse(data));
      });
    });

    req.on('error', function (e) {
      //console.log("ERROR:");
      //console.log(e);
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
      "app_id": "e8a91e90-a766-4f1b-a47e-e3b3f569dbef",
      "included_segments ": ["Active Users", "Inactive Users"],
      "contents": data.content,
      "data": data.data,
      "filters": [{
        "field": "tag",
        "key": "user_id",
        "relation": "=",
        "value": data.userId
      }],
      "headings": {
        "en": "Vibo"
      }
    }
    sendNewNotification(message);
    var notification = {
      'ownerId': data.userId,
      'type': "Custom-Notification",
      'body': {
        'message': data.content
      }
    }
    Notification.create(
      notification,
      function (err, newUser) {
        if (err)
          callback(err, null);
        callback(null, result);
      })
    // TODO
  };

};
