'use strict';
const errors = require('../../server/errors');

module.exports = function (Useractivate) {

  Useractivate.beforeRemote('create', function (context, result, next) {
    // check user is active 
    console.log(context.req.body);
    var deviceId = null;
    Useractivate.app.models.Device.cheackDevice(context.req.body.deviceName, function (err, device) {
      if (err) {
        // console.log("err");
        console.log(err);
        return next(err)
      }
      if (device != null) {
        deviceId = device.id;
        delete context.req.body.deviceName
      }

      if (context.req.body.ownerId == null)
        context.req.body.ownerId = context.req.accessToken.userId;
      Useractivate.app.models.User.findById(context.req.body.ownerId, function (err, user) {
        if (err) {
          return next(err);
        }
        if (user.status != 'active') {
          return next(errors.account.notActive());
        }

        var start = new Date();
        start.setHours(0, 0, 0, 0);

        var end = new Date();
        end.setHours(23, 59, 59, 999);
        Useractivate.find({
            where: {
              and: [{
                  ownerId: context.req.body.ownerId
                },
                {
                  createdAt: {
                    gt: start
                  }
                },
                {
                  createdAt: {
                    lt: end
                  }
                }
              ]
            }
          },
          function (err, bottles) {
            if (err)
              return next(err);
            if (bottles[0]) {
              console.log("error");
              return next(errors.account.youLoginToday());
            } else {
              console.log("continue");
              console.log("continue");
              user.deviceId = deviceId
              user.save();
              next();
            }
          });
      })
    })
  })

  Useractivate.afterRemote('create', function (context, item, next) {
    Useractivate.app.models.User.findById(context.req.body.ownerId, function (err, user) {
      if (err) {
        return next(err);
      }
      user.lastLogin = new Date();
      user.save();
      next();

    });
  })

  /**
   *
   * @param {Function(Error, object)} callback
   */

  Useractivate.newLogin = function (req, callback) {
    var object;
    var ownerId = req.accessToken.userId
    var data = {
      "ownerId": ownerId
    }
    var start = new Date();
    start.setHours(0, 0, 0, 0);

    var end = new Date();
    end.setHours(23, 59, 59, 999);
    Useractivate.find({
        where: {
          and: [{
              ownerId: ownerId
            },
            {
              createdAt: {
                gt: start
              }
            },
            {
              createdAt: {
                lt: end
              }
            }
          ]
        }
      },
      function (err, bottles) {
        if (err)
          return callback(err);
        if (bottles[0]) {
          console.log("error");
          return callback(null, {});
        } else {
          console.log("continue");
          Useractivate.create(data, function (err, data) {
            if (err)
              return callback(err, null);
            console.log("created");
            return callback(err, {});
          })
        }
      })
  };
};
