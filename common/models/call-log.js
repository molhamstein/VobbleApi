'use strict';
const errors = require('../../server/errors');
var https = require('https');
var ObjectId = require('mongodb').ObjectID;
const mongoXlsx = require('mongo-xlsx');
const configPath = process.env.NODE_ENV === undefined ?
  '../../server/config.json' :
  `../../server/config.${process.env.NODE_ENV}.json`;
const config = require(configPath);

module.exports = function (Calllog) {
  //   var appleAccount = require("../../server/boot/appleAccountKey.json");

  var urlFileRoot = config.domain + config.restApiRoot + "/uploadFiles";

  var urlFileRootexcel = urlFileRoot + '/excelFiles/download/';

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
      if (user.phoneType == "IPHONE") {
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
      } else {
        const data = JSON.stringify({
          "priority": "high",
          "data": {
            "click_action": "FLUTTER_NOTIFICATION_CLICK",
            'conversationId': context.req.body.conversationId,
            'owner': context.res.locals.user
          },
          "to": deviceToken
        })

        const options = {
          hostname: 'fcm.googleapis.com',
          path: '/fcm/send',
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': config.androidCallToken
          }
        }

        const req = https.request(options, res => {
          console.log(`statusCode: ${res.statusCode}`)

          res.on('data', d => {
            process.stdout.write(d)
          })
        })

        req.on('error', error => {
          console.error(error)
        })

        req.write(data)
        req.end()
      }
      next()
    })
  });
  Calllog.updateCallLog = async function (id, startAt, endAt, isFinish = false, status, isReview, callback) {
    try {
      var callLog = await Calllog.findById(id)
      if (callLog == null)
        throw (errors.callLog.callLogNotFound());
      var updateObject = {}
      updateObject["startAt"] = startAt
      updateObject["endAt"] = endAt

      var duration = (endAt.getTime() - startAt.getTime()) / 1000;
      updateObject["duration"] = duration

      updateObject["cost"] = minCost * Math.ceil(duration / 60)

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


  Calllog.getFilter = function (filter, callback) {
    Calllog.getDataSource().connector.connect(function (err, db) {
      if (filter.where == null)
        filter.where = {}

      if (filter.where == null)
        filter.where = {}
      if (filter.where.relatedUserId != null)
        filter.where.relatedUserId = ObjectId(filter.where.relatedUserId)
      if (filter.where.ownerId != null)
        filter.where.ownerId = ObjectId(filter.where.ownerId)
      if (filter.where['owner.agencyId'] != null)
        filter.where["owner.agencyId"] = ObjectId(filter.where["owner.agencyId"])
      if (filter.where['relatedUser.agencyId'] != null)
        filter.where["relatedUser.agencyId"] = ObjectId(filter.where["relatedUser.agencyId"])


      if (filter.where['createdAt'] != null) {
        if (filter.where['createdAt']['gte'] != null) {
          filter.where['createdAt']['$gte'] = new Date(filter.where['createdAt']['gte'])
          delete filter.where['createdAt']['gte']
        }
        if (filter.where['createdAt']['lte'] != null) {
          filter.where['createdAt']['$lte'] = new Date(filter.where['createdAt']['lte'])
          delete filter.where['createdAt']['lte']
        }

      }

      var collection = db.collection('callLog');
      var callLogs = collection.aggregate([{
          $lookup: {
            from: "user",
            localField: "ownerId",
            foreignField: "_id",
            as: "owner"
          }
        },
        {
          $unwind: "$owner"
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
          $unwind: "$relatedUser"
        },
        {
          $match: filter['where']
        },
        {
          $project: {
            _id: 0,
            id: '$_id',
            conversationId: 1,
            status: 1,
            createdAt: 1,
            relatedUserId: 1,
            ownerId: 1,
            startAt: 1,
            endAt: 1,
            duration: 1,
            cost: 1,
            owner: 1,
            relatedUser: 1,
          }
        }
      ]);
      callLogs.get(function (err, data) {
        if (err) return callback(err);
        return callback(null, data);
      })
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

    Calllog.getFilter(filter, function (err, data) {
      if (err)
        callback(err, null);
      var newData = data.slice(offset, offset + limit);
      //console.log("newData")
      //console.log(newData)
      callback(err, newData);
    })

  }

  Calllog.countFilterCallLog = function (where = {}, callback) {
    Calllog.getFilter({
      "where": where
    }, function (err, data) {
      if (err)
        callback(err, null);
      callback(err, {
        "count": data.length
      });
    })
  };


  Calllog.exportFilterCallLog = function (where = {}, callback) {
    var filter = {
      "where": where
    }
    Calllog.getFilter(filter, function (err, callLogs) {
      if (err)
        callback(err, null);
      var config = {
        path: 'uploadFiles/excelFiles',
        save: true,
        fileName: 'callLog' + Date.now() + '.xlsx'
      };
      var object = {}
      var data = [];
      callLogs.forEach(function (element) {
        object = {
          image: element.owner['image'],
          totalBottlesThrown: element.owner['totalBottlesThrown'],
          repliesBottlesCount: element.owner['repliesBottlesCount'],
          repliesReceivedCount: element.owner['repliesReceivedCount'],
          foundBottlesCount: element.owner['foundBottlesCount'],
          extraBottlesCount: element.owner['extraBottlesCount'],
          bottlesCount: element.owner['bottlesCount'],
          registrationCompleted: element.owner['registrationCompleted'],
          gender: element.owner['gender'],
          nextRefill: element.owner['nextRefill'].toString(),
          createdAt: element.owner['createdAt'].toString(),
          lastLogin: element.owner['lastLogin'] ? element.owner['lastLogin'].toString() : "",
          email: element.owner['email'],
          status: element.owner['status'],
          typeLogIn: element.owner['typeLogIn'],
          username: element.owner['username'],
          isHost: element.owner['isHost'],
          duration: element.duration,
          "call status": element.status,
          createdAt: element.createdAt.toString(),
          startAt: element.startAt ? element.startAt.toString() : "",
          endAt: element.endAt ? element.endAt.toString() : "",
          cost: element.cost,
          "image related": element.relatedUser['image'],
          "totalBottlesThrown related": element.relatedUser['totalBottlesThrown'],
          "repliesBottlesCount related": element.relatedUser['repliesBottlesCount'],
          "repliesReceivedCount related": element.relatedUser['repliesReceivedCount'],
          "foundBottlesCount related": element.relatedUser['foundBottlesCount'],
          "extraBottlesCount related": element.relatedUser['extraBottlesCount'],
          "bottlesCount related": element.relatedUser['bottlesCount'],
          "registrationCompleted related": element.relatedUser['registrationCompleted'],
          "gender related": element.relatedUser['gender'],
          "nextRefill related": element.relatedUser['nextRefill'].toString(),
          "createdAt related": element.relatedUser['createdAt'].toString(),
          "lastLogin related": element.relatedUser['lastLogin'] ? element.relatedUser['lastLogin'].toString() : "",
          "email related": element.relatedUser['email'],
          "status related": element.relatedUser['status'],
          "typeLogIn related": element.relatedUser['typeLogIn'],
          "username related": element.relatedUser['username'],
          "isHost related": element.relatedUser['isHost'],
        }
        data.push(object)
      })
      var model = mongoXlsx.buildDynamicModel(data);


      /* Generate Excel */
      mongoXlsx.mongoData2Xlsx(data, model, config, function (err, data) {
        //console.log('File saved at:', data.fullPath);
        callback(null, {
          'path': urlFileRootexcel + config['fileName']
        });

      });
    });

  };



};
