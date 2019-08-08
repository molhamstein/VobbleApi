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

  Bottleusercomplete.seenAndComplete = function (seen, complete, req, callback) {
    if (complete.length == 0 && seen.length == 0) {
      return callback(null, 200)
    }
    var userId = req.accessToken.userId;
    var bottleModel = Bottleusercomplete.app.models.bottle;
    var userModel = Bottleusercomplete.app.models.User;
    var seenBottleModel = Bottleusercomplete.app.models.bottleUserseen;
    var completeBottleModel = Bottleusercomplete;
    userModel.findById(userId, function (err, oneUser) {
      if (err)
        return callback(err, null)
      oneUser.updateAttributes({
        "foundBottlesCount": oneUser.foundBottlesCount + seen.length
      })
      bottleModel.find({
        "where": {
          id: {
            inq: seen
          }
        }
      }, function (err, seenBottle) {
        updateSeenAllSync(0, function () {
          bottleModel.find({
            "where": {
              id: {
                inq: complete
              }
            }
          }, function (err, completeBottle) {
            updateCompleteAllSync(0, completeBottle, function () {
              return callback(null, 200)
            })
          })
        });

        function updateSeenAllSync(index, synccallback) {
          if (index < seenBottle.length) {
            const element = seenBottle[index];
            seenBottleModel.create({
              "bottleId": element.id,
              "userId": userId
            }, function (err, data) {
              element.updateAttribute("bottleViewCount", element.bottleViewCount + 1, function (err, data) {
                console.log("Create And Update Success")
                updateSeenAllSync(index + 1, function () {
                  synccallback()
                });
              })
            })
          } else {
            synccallback()
          }
        }

        function updateCompleteAllSync(index, completeBottle, synccallback) {
          if (index < completeBottle.length) {
            const element = completeBottle[index];
            completeBottleModel.create({
              "bottleId": element.id,
              "userId": userId
            }, function (err, data) {
              element.updateAttribute("bottleCompleteCount", element.bottleCompleteCount + 1, function (err, data) {
                console.log("Create And Update Success")
                updateCompleteAllSync(index + 1, completeBottle, function () {
                  synccallback()
                });
              })
            })
          } else {
            synccallback()
          }
        }






      })
    })
  }
  //     else if (complete.length != 0) {
  //       bottleModel.find({
  //         "where": {
  //           id: {
  //             inq: complete
  //           }
  //         }
  //       }, function (err, completeBottle) {
  //         console.log(completeBottle);
  //         for (let index = 0; index < completeBottle.length; index++) {
  //           const element = completeBottle[index];
  //           element.bottleCompleteCount++;
  //           element.save();
  //           completeBottleModel.create({
  //             "bottleId": element.id,
  //             "userId": userId
  //           })
  //           if (index + 1 == seenBottle.length) {
  //             return callback(null, 200)
  //           }
  //         }
  //       })
  //     } else {
  //       return callback(null, 200)
  //     }

  // }

};
