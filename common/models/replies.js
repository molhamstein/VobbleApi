'use strict';
const errors = require('../../server/errors');

module.exports = function (Replies) {

  Replies.beforeRemote('create', function (context, item, next) {
    // var storeTypeEnum=["playStore","iTunes"];
    // var storeType = context.req.body.storeType;
    // if(storeTypeEnum.findIndex(storeType)==-1){
    //     return next(errors.global.notActive());
    // }
    Replies.app.models.user.findById(context.req.body.userId, function (err, oneUser) {
      if (err) {
        return next(err);
      }
      // if (oneUser.replaysCount == 0 && oneUser.extraReplaysCount == 0) {
      //   return next(errors.bottle.noAvailableBottleToday());
      // }
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
          ownerUser.repliesReceivedCount++;
          ownerUser.save();
          next();
        })
      })
    })
  });

};
