'use strict';

module.exports = function (Activechat) {
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

  Date.prototype.addHours = function (h) {
    this.setTime(this.getTime() + (h * 60 * 1000));
    return this;
  }

  Activechat.afterRemote('create', function (context, result, next) {
    Activechat.app.Users
    Activechat.app.models.User.findById(result.firstUser, function (err, firstUser) {
      if (err) {
        return next(err);
      }
      var message1 = {
        "app_id": "e8a91e90-a766-4f1b-a47e-e3b3f569dbef",
        "included_segments ": ["Active Users", "Inactive Users"],
        "send_after": new Date().addHours(2),
        "contents": {
          "ar": "متبقي ساعى لنتهاء محادثتك مع " + firstUser.username,
          "en": "متبقي ساعى لنتهاء محادثتك مع " + firstUser.username
        },
        "data": {
          "chatId": result.chatId
        },
        "filters": [{
          "field": "tag",
          "key": "user_id",
          "relation": "=",
          "value": result.secondUser
        }],
        "headings": {
          "en": "Vibo"
        }
      }
      sendNewNotification(message1);
      Activechat.app.models.User.findById(result.secondUser, function (err, secondUser) {
        if (err) {
          return next(err);
        }
        var message2 = {
          "app_id": "e8a91e90-a766-4f1b-a47e-e3b3f569dbef",
          "included_segments ": ["Active Users", "Inactive Users"],
          "send_after": new Date().addHours(2),
          "contents": {
            "ar": "متبقي ساعى لنتهاء محادثتك مع " + secondUser.username,
            "en": "متبقي ساعى لنتهاء محادثتك مع " + secondUser.username
          },
          "data": {
            "chatId": result.chatId
          },
          "filters": [{
            "field": "tag",
            "key": "user_id",
            "relation": "=",
            "value": result.firstUser
          }],
          "headings": {
            "en": "Vibo"
          }
        }
        sendNewNotification(message2);
        next();
      })
    })
  });
};
