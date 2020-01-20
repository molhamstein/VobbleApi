'use strict';
const errors = require('../../server/errors');
var https = require('https');
module.exports = function (Calllog) {
  //   var appleAccount = require("../../server/boot/appleAccountKey.json");
  const minCost = 50
  Calllog.beforeRemote('create', function (context, result, next) {
    if (context.res.locals.user.status != 'active') {
      return next(errors.account.notActive());
    }

    var isReview = context.req.body.isReview;
    delete context.req.body.isReview
    if (context.res.locals.user.pocketCoins < minCost && isReview == false) {
      return next(errors.product.youDonotHaveCoins())
    }
    var apn = require('node-apn-http2');
    if (context.req.body.ownerId == null)
      context.req.body.ownerId = context.req.accessToken.userId;

    Calllog.app.models.User.findById(context.req.body.relatedUserId, function (err, user) {
      if (err)
        return next(err)
      if (user.pushkitToken == null) {
        return next(errors.account.userCanNotRinging())
      }
      let deviceToken = user.pushkitToken
      var options = {
        token: {
          key: "server/boot/AuthKey_SC8495N9AY.p8",
          keyId: "SC8495N9AY",
          teamId: "U2DR46FA6M"
        },
        production: false,
        hideExperimentalHttp2Warning: true // the http2 module in node is experimental and will log 
      };

      var apnProvider = new apn.Provider(options);

      var note = new apn.Notification();
      note.expiry = Math.floor(Date.now() / 1000) + 30; // Expires 1 hour from now.
      note.badge = 3;
      note.sound = "ping.aiff";
      note.alert = "\uD83D\uDCE7 \u2709 You have a new message";
      note.payload = {
        'conversationId': context.req.body.conversationId,
        'owner': context.res.locals.user
      };
      note.topic = "com.yallavideo.Vibo.voip";

      apnProvider.send(note, deviceToken).then((result) => {
        apnProvider.shutdown()
      });
      next()
    })
  });
  Calllog.updateCallLog = async function (id, startAt, endAt, isFinish = false, status, isReview, callback) {
    try {
      var callLog = await Calllog.findById(id)
      if (callLog == null)
        throw (errors.callLog.callLogNotFound());
      var updateObject = {}
      if (startAt)
        updateObject["startAt"] = startAt
      if (endAt) {
        var duration = (endAt.getTime() - callLog.startAt.getTime()) / 1000;
        updateObject["duration"] = duration
        updateObject[cost] = minCost * Math.ceil(duration / 60)
        updateObject["endAt"] = endAt
      }
      if (status)
        updateObject["status"] = status

      var owner = callLog.owner();
      if (owner.pocketCoins < minCost && isReview == false) {
        return callback(errors.product.youDonotHaveCoins())
      }
      await callLog.updateAttributes(updateObject)
      if (isFinish == false && isReview == false) {
        var newPocketCoins = owner.pocketCoins - minCost
        var newTotalCallPaidCoins = owner.totalCallPaidCoins + minCost
        var newTotalPaidCoins = owner.totalPaidCoins + minCost
        await owner.updateAttributes({
          "totalPaidCoins": newTotalPaidCoins,
          "pocketCoins": newPocketCoins,
          "totalCallPaidCoins": newTotalCallPaidCoins,
        })
      }
      callback(null, callLog)
    } catch (error) {
      callback(error)
    }
  }


  function getFilter(filter, callback) {
    var collection = db.collection('callLog');
    var callLogs = collection.aggregate([{
        $match: filter
      }, {
        $lookup: {
          from: "user",
          localField: "ownerId",
          foreignField: "_id",
          as: "owner"
        }
      },
      {
        $lookup: {
          from: "user",
          localField: "relatedUserId",
          foreignField: "_id",
          as: "relatedUser"
        }
      },
      {
        $project: {
          _id: 0
        }
      }
    ]);
    cursor.get(function (err, data) {
      if (err) return callback(err);
      return callback(null, data);
    })
  }



  Calllog.getFilterCallLog = function (filter, callback) {
    var offset = filter['offset'];
    var limit = filter['limit'];
    if (offset == null)
      offset = 0;
    if (limit == null)
      limit = 10;
    // //console.log(filter.where.and)
    delete filter['offset']
    delete filter['limit']

    getFilter(filter, function (err, data) {
      if (err)
        callback(err, null);
      var newData = data.slice(offset, offset + limit);
      //console.log("newData")
      //console.log(newData)
      callback(err, newData);
    })

  }

  Calllog.countFilterCallLog = function (filter, callback) {
    getFilter(filter, function (err, data) {
      if (err)
        callback(err, null);
      callback(err, {
        "count": data.length
      });
    })
  };

};
