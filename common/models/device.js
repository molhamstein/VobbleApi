'use strict';
const errors = require('../../server/errors');

module.exports = function (Device) {
  Device.validatesInclusionOf('status', {
    in: ['active', 'blocked']
  });

  Device.cheackDevice = function (name, cb) {
    if (name == null)
      return cb(null, null)

    Device.findOne({
        "where": {
          "name": name
        }
      },
      function (err, data) {
        if (err)
          return cb(err)
        //console.log("dataaaaaaaaaaaaaa")
        //console.log(data)
        if (data == null) {
          Device.create({
            "name": name
          }, function (err, newDevice) {
            if (err)
              return cb(err)
            return cb(null, newDevice)
          })
        }
        if (data != null) {
          if (data.status == "active") {
            return cb(null, data)
          } else {
            return cb(errors.account.deviceNotAvailable(), null)
          }
        }
      })
  }
};
