'use strict';

module.exports = function (Bottleusercomplete) {

  Bottleusercomplete.beforeRemote('create', function (context, result, next) {
    if (context.req.body.userId == null)
      context.req.body.userId = context.req.accessToken.userId;
    next()
  });

  Bottleusercomplete.afterRemote('create', function (context, result, next) {
    var bottleId = context.req.body.bottleId
    Bottleusercomplete.app.models.bottle.findById(bottleId, function (err, oneBottle) {
      if (err)
        return next(err)

      oneBottle.bottleCompleteCount++;
      oneBottle.save();
      next()
    })
  })

};
