'use strict';
const errors = require('../../server/errors');
var cron = require('node-schedule');
var serviceAccount = require("../../server/boot/serviceAccountKey.json");

module.exports = function (Replies) {

  Replies.beforeRemote('create', function (context, item, next) {
    // var storeTypeEnum=["playStore","iTunes"];
    // var storeType = context.req.body.storeType;
    // if(storeTypeEnum.findIndex(storeType)==-1){
    //     return next(errors.global.notActive());
    // }
    context.req.body.userId = context.req.accessToken.userId;

    Replies.app.models.user.findById(context.req.body.userId, function (err, oneUser) {
      if (err) {
        return next(err);
      }
      if (oneUser.replysCount == 0 && (new Date(oneUser.unlimitedReplysOpenDate).getTime() < new Date().getTime() || oneUser.unlimitedReplysOpenDate == null)) {
        return next(errors.bottle.noAvailableReplyToday());
      }
      oneUser.repliesBottlesCount++;
      oneUser.save();
      Replies.app.models.bottle.findById(context.req.body.bottleId, function (err, oneBottle) {
        if (err) {
          return next(err);
        }
        oneBottle.repliesUserCount++;
        oneBottle.save();
        Replies.app.models.user.findById(oneBottle.ownerId, function (err, ownerUser) {
          if (err) {
            return next(err);
          }
          var repliesReceivedCount = ownerUser.repliesReceivedCount + 1;
          ownerUser.updateAttributes({
            "repliesReceivedCount": repliesReceivedCount
          }, function () {
            next();
          })
        })
      })
    })
  });

  function addHours(date, h) {
    date.setTime(date.getTime() + (h * 60 * 60 * 1000));
    return date;
  }
  Replies.afterRemote('create', function (context, result, next) {
    Replies.app.models.user.findById(context.req.body.userId, function (err, oneUser) {
      if (oneUser.extraReplysCount > 0)
        oneUser.extraReplysCount--;
      else {
        oneUser.replysCount--;
        if (oneUser.replysCount == 0) {
          oneUser.dateRechargeReplies = addHours(new Date(), 12)
        }
      }
      oneUser.save();
      next();
    })
  });

  cron.scheduleJob('0 5 * * * *', function () {
    var dataNotification = []
    Replies.app.models.User.find({
      where: {
        "and": [{
            "replysCount": 0,
          },
          {
            "dateRechargeReplies": {
              "lt": new Date()
            }
          }
        ]

      }
    }, function (err, data) {
      dataNotification = data;
      var tomorrow = addHours(new Date(), 24)
      console.log("Ruuuuuuuuuuuuuuuuuuuuun")
      console.log(data.length)

      Replies.app.models.User.updateAll({
        "dateRechargeReplies": {
          "lt": new Date()
        }
      }, {
        'dateRechargeReplies': tomorrow,
        'replysCount': 9,
      }, function (err, res) {
        if (err) {
          //console.log(err);
        } else {
          //console.log('done');
          for (let index = 0; index < dataNotification.length; index++) {
            const element = dataNotification[index];
            var message = {
              "app_id": "e8a91e90-a766-4f1b-a47e-e3b3f569dbef",
              "included_segments ": ["Active Users", "Inactive Users"],
              "contents": {
                "ar": "صار فيك تعلق عالفيديوهات يلي بتحبها",
                "en": "Now, you can reply to video "
              },
              "filters": [{
                "field": "tag",
                "key": "user_id",
                "relation": "=",
                "value": element.id
              }],
              "headings": {
                "en": "Go back and reply",
                "ar": "رجاع علق عالفيديوهات"
              }
            }
            //console.log(message);
            sendNewNotification(message)
          }
        }
      })

    });
  });


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
        // //console.log(JSON.parse(data));
      });
    });

    req.on('error', function (e) {
      //console.log("ERROR:");
      //console.log(e);
    });

    req.write(JSON.stringify(data));
    req.end();
  };
};
