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
      if (user.pushketToken == null) {
        return next(errors.account.userCanNotRinging())
      }
      let deviceToken = user.pushketToken
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
      if (startAt)
        await callLog.updateAttribute("startAt", startAt)
      if (endAt) {
        var duration = (endAt.getTime() - callLog.startAt.getTime()) / 1000;
        await callLog.updateAttribute("duration", duration)
        await callLog.updateAttribute("endAt", endAt)
      }
      if (status)
        await callLog.updateAttribute("status", status)

      var owner = callLog.owner();
      if (owner.pocketCoins < minCost && isReview == false) {
        return callback(errors.product.youDonotHaveCoins())
      }
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

};
