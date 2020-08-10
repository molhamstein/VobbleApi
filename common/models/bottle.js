'use strict';
const errors = require('../../server/errors');
const mongoXlsx = require('mongo-xlsx');
const configPath = process.env.NODE_ENV === undefined ?
  '../../server/config.json' :
  `../../server/config.${process.env.NODE_ENV}.json`;
const config = require(configPath);
const datesBetween = require('dates-between');
var cron = require('node-schedule');
var rule = new cron.RecurrenceRule();
var async = require("async");
var ObjectId = require('mongodb').ObjectID;
var fs = require("fs");


module.exports = function (Bottle) {

  var urlFileRoot = config.domain + config.restApiRoot + "/uploadFiles";

  var urlFileRootexcel = urlFileRoot + '/excelFiles/download/';


  Bottle.validatesInclusionOf('status', {
    in: ['deactive', 'active', 'pending']
  });

  /**
   *
   * @param {string} id
   * @param {Function(Error)} callback
   */

  Bottle.deactiveBottle = function (id, deleteFile = false, callback) {
    // TODO
    Bottle.findById(id, function (err, bottle) {
      if (err) {
        //console.log(err);
        callback();
      }
      bottle.status = "deactive";
      bottle.save();
      // if (deleteFile == true) {
      //   var filePath = config.filePath;
      //   var fileName = ""
      //   if (bottle.bottleType = "video")
      //     fileName = filePath + "videos" + bottle.file.slice(bottle.file.lastIndexOf("/"))
      //   else
      //     fileName = filePath + "audios" + bottle.file.slice(bottle.file.lastIndexOf("/"))
      //   fs.unlinkSync(fileName)
      // }
      callback(null);
    });
  };

  // Set owner Id
  Bottle.beforeRemote('create', function (context, result, next) {
    // check user is active 
    if (context.req.body.ownerId == null)
      context.req.body.ownerId = context.req.accessToken.userId;
    Bottle.app.models.User.findById(context.req.body.ownerId, function (err, user) {
      if (err) {
        //console.log(err);
        next(err);
      }

      if (user.status != 'active') {
        return next(errors.account.notActive());
      }


      let weight = 0
      let totalWeight = 0
      if (user.bottlesCount == 0 && user.extraBottlesCount == 0) {
        return next(errors.bottle.noAvailableBottleToday());
      }
      Bottle.app.models.shore.findById(context.req.body.shoreId, function (err, shore) {
        if (err) {
          return next(err);
        }

        shore.bottleCount++;
        shore.save();
        weight = parseInt(Date.parse(new Date())) / (1000 * 60 * 60)
        totalWeight = weight
        context.req.body.weight = weight;
        context.req.body.totalWeight = totalWeight;
        next();
      })

    })


  });




  // increment bottlesCount for user
  // Bottle.afterRemote('create', function (context, result, next) {
  //     const user = context.res.locals.user;
  //     user.totlalBottlesThrown++;
  //     if (user.extraBottlesCount > 0)
  //         user.bottlesCount--;
  //     else
  //         user.bottlesCountToday--;
  //     user.save();
  //     next();
  // });


  // increment bottlesCount for user
  Bottle.afterRemote('create', function (context, result, next) {
    // const user = context.res.locals.user;
    Bottle.app.models.User.findById(context.req.body.ownerId, function (err, user) {
      if (err) {
        //console.log(err);
        next(err);
      }
      console.log(user)
      user.totalBottlesThrown++;
      if (user.extraBottlesCount > 0)
        user.extraBottlesCount--;
      else
        user.bottlesCount--;
      user.save();
      if (context.req.body.topicId == null)
        next();
      else {
        Bottle.app.models.topics.findById(context.req.body.topicId, function (err, oneTopic) {
          if (err)
            return next(err)
          //console.log("ssss")
          //console.log(oneTopic)
          oneTopic.bottleCount++;
          oneTopic.save();
          next()
        })
      }
    });
  });


  //  include: [
  //   {
  //     relation: 'owner', // include the owner object
  //     scope: { // further filter the owner object
  //       fields: ['username', 'email'], // only show two fields
  //       include: { // include orders for the owner
  //         relation: 'orders', 
  //         where: {orderId: 5} // only select order with id 5
  //       }
  //     }
  //   },
  //   {
  //     relation: 'thanks', // include the thank object
  //     scope: { // further filter the owner object
  //       fields: ['username']
  //     }
  //   }
  // ]

  function getFilter(filter, limit, offset, callback) {
    var skip;
    var limitObject;
    if (offset) {
      skip = {
        $skip: offset
      }
    }
    if (limit) {
      var tempOffset = offset ? offset : 0;
      limitObject = {
        $limit: limit + tempOffset
      }
    }

    var where = {}
    if (filter['where']['and'] != null) {
      where['$and'] = []
      filter['where']['and'].forEach(element => {
        if (element['owner.username'] == null) {
          where['$and'].push(element)
        } else {
          var value = element['owner.username']
          where['$and'].push({
            "owner.username": {
              $regex: value,
              $options: 'i'
            }
          })
        }

      });
    }
    var aggregate = [{
      $lookup: {
        from: "user",
        let: {
          ownerId: {
            $convert: {
              input: "$ownerId",
              to: "objectId"
            }
          }
        },
        pipeline: [{
          $match: {
            $expr: {
              $eq: ["$_id", "$$ownerId"]
            }
          }
        },
        {
          $project: {
            stackBottleUser: 0
          }
        }

        ],
        as: "owner"
      }
    },
    {
      $unwind: "$owner"
    },
    {
      $lookup: {
        from: "shore",
        localField: "shoreId",
        foreignField: "_id",
        as: "shore"
      }
    },
    {
      $unwind: "$shore"
    }
    ]
    if (where["$and"].length != 0)
      aggregate.push({
        $match: where
      })
    aggregate.push({
      $project: {
        _id: 0,
        id: '$_id',
        file: 1,
        status: 1,
        createdAt: 1,
        thumbnail: 1,
        ownerId: 1,
        viewStatus: 1,
        totalWeight: 1,
        repliesUserCount: 1,
        bottleViewCount: 1,
        bottleCompleteCount: 1,
        bottleType: 1,
        shore: 1,
        shoreId: 1,
        owner: 1
      }
    }, {
      $sort: {
        createdAt: -1
      }
    })
    if (limit) {
      aggregate.push(limitObject)
    }
    if (offset) {
      aggregate.push(skip)
    }
    Bottle.getDataSource().connector.connect(function (err, db) {
      var collection = db.collection('bottle');
      var bottles = collection.aggregate(aggregate);
      bottles.get(function (err, data) {
        if (err) return callback(err);
        return callback(null, data);
      })
    })
  }

  // get bottle to view
  Bottle.getFilterBottle = function (filter, callback) {
    var offset = filter['offset'];
    var limit = filter['limit'];
    //console.log(offset)
    //console.log(limit)
    if (offset == null)
      offset = 0;
    if (limit == null)
      limit = 10;
    delete filter['offset']
    delete filter['limit']
    // console.log(limit)
    getFilter(filter, limit, offset, function (err, data) {
      if (err)
        callback(err, null);
      callback(err, data);
    })

  }

  /**
   *
   * @param {Function(Error, object)} callback
   */

  Bottle.countFilter = function (filter, callback) {

    getFilter(filter, null, null, function (err, data) {
      if (err)
        callback(err, null);
      callback(err, {
        "count": data.length
      });
    })

  };

  Bottle.getBottleById = function (id, req, callback) {
    var userId = req.accessToken.userId;
    Bottle.app.models.user.findById(userId, function (err, oneUser) {
      if (err) {
        return callback(err);
      }
      if (oneUser.status !== 'active') {
        return callback(errors.account.notActive());
      }
      Bottle.findById(id, function (err, bottle) {
        if (err) {
          return callback(err);
        }
        if (bottle == null) {
          return callback(errors.bottle.bottleNotFount())
        }
        var bottleUserseenObject = {
          "userId": userId,
          "bottleId": id
        }
        Bottle.app.models.bottleUserseen.create(bottleUserseenObject)
          .then()
          .catch(err => console.log(err));

        addOwnerBootle(oneUser, bottle.ownerId)
        // oneUser.save();
        bottle.bottleViewCount++;
        bottle.save();
        return callback(null, bottle);

      })
    })
  }

  Bottle.getBottle = function (gender, ISOCode, shoreId, bottleType, offsets = 0, limit = 5, seen = [], complete = [], req, callback) {
    var now = new Date().getTime();
    var userId = req.accessToken.userId;
    var filter = {
      "status": "active",
      "createdAt": {
        "$gt": new Date("2019-06-01T13:39:44.419Z")
      }
    }
    filter['owner.status'] = "active"
    filter['viewStatus'] = "active"

    if (shoreId) {
      filter['shoreId'] = ObjectId(shoreId)
    }

    if (bottleType) {
      filter['bottleType'] = bottleType
    }


    if (gender) {
      filter['owner.gender'] = gender
    }

    if (ISOCode) {
      filter['owner.ISOCode'] = ISOCode
    }
    var start = (new Date().getTime() - now) / 1000
    Bottle.app.models.bottleUserComplete.seenAndComplete(seen, complete, req, function () {
      var afterSeen = (new Date().getTime() - now) / 1000

      Bottle.app.models.user.findById(userId, function (err, oneUser) {
        var getUser = (new Date().getTime() - now) / 1000

        if (err) {
          return callback(err);
        }
        if (oneUser.status !== 'active') {
          return callback(errors.account.notActive());
        }

        if (offsets == 0) {

          createStack(userId, filter, now, function (dataTime) {
            var createStack = (new Date().getTime() - now) / 1000
            getFromStack(userId, offsets, limit, function (err, data) {
              var getFromStack = (new Date().getTime() - now) / 1000
              if (data[0] != null) {
                data[0]['start'] = start
                data[0]['afterSeen'] = afterSeen
                data[0]['getUser'] = getUser
                data[0]["dataTime"] = dataTime
                data[0]['createStack'] = createStack
                data[0]['getFromStack'] = getFromStack
              }
              return callback(null, data);
            })
          })
        } else
          getFromStack(userId, offsets, limit, function (err, data) {
            var getFromStack = (new Date().getTime() - now) / 1000
            if (data[0] != null) {
              data[0]['start'] = start
              data[0]['afterSeen'] = afterSeen
              data[0]['getUser'] = getUser
              data[0]['getFromStack'] = getFromStack
            }
            return callback(null, data);
          })
      })
    })
  }


  function createStack(userId, filter, now, callback) {
    var blockList = []
    Bottle.app.models.user.findById(userId, function (err, oneUser) {


      Bottle.app.models.block.find({
        where: {
          or: [{
            "ownerId": ObjectId(userId)
          },
          {
            "userId": ObjectId(userId)
          },
          ]
        }
      }, function (err, blocksList) {
        blockList = blocksList.map(function (block) {
          if (new String(userId).valueOf() === new String(block.ownerId).valueOf())
            return ObjectId(block.userId);
          else
            return ObjectId(block.ownerId);
        });

        blockList.push(ObjectId(userId))
        var getBlock = (new Date().getTime() - now) / 1000

        filter['ownerId'] = {
          $nin: blockList
        }


        // Bottle.app.models.bottleUserseen.find({
        //   where: {
        //     userId: userId,
        //     "createdAt": {
        //       "gt": new Date("2019-06-01T13:39:44.419Z")
        //     }
        //   }
        // }, function (err, bottles) {
        // seenBottle = getFrequency(bottles, filter)

        Bottle.getFrequency(userId, filter, function (err, seenBottle) {


          var getSeen = (new Date().getTime() - now) / 1000
          var maleLimit = 0
          var femaleLimit = 0
          var newUser = false;
          // console.log("seenBottle")
          // console.log(seenBottle.length)
          // console.log(filter)

          if (oneUser.gender == "male") {


            if (new Date().getTime() - oneUser.createdAt.getTime() < 24 * 60 * 60 * 1000) {
              maleLimit = 300
              femaleLimit = 700
              newUser = true;
            } else {
              maleLimit = 700
              femaleLimit = 300

            }
          } else {
            if (new Date().getTime() - oneUser.createdAt.getTime() < 24 * 60 * 60 * 1000) {
              maleLimit = 700
              femaleLimit = 300
              newUser = true;
            } else {
              maleLimit = 300
              femaleLimit = 700
            }
          }
          var maleFilter = Object.assign({}, filter)
          var femaleFilter = Object.assign({}, filter)
          if (filter['owner.gender'] == null) {
            maleFilter['owner.gender'] = "male"
            femaleFilter['owner.gender'] = "female"
          } else {
            maleLimit = 1000
            femaleLimit = 1000
          }

          // console.log("maleLimit")
          // console.log(maleFilter)
          // console.log("femaleLimit")
          // console.log(femaleFilter)

          Bottle.getDataSource().connector.connect(function (err, db) {
            var collection = db.collection('bottle');
            var maleAggregation = collection.aggregate([{
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
              $match: maleFilter
            },
            {
              $sort: {
                totalWeight: -1
              }
            },
            {
              $limit: maleLimit
            }
            ])
            var femaleAggregation = collection.aggregate([{
              $lookup: {
                from: "user",
                localField: "ownerId",
                foreignField: "_id",
                as: "owner"
              }
            },
            {
              $unwind: "$owner"
            }, {
              $match: femaleFilter
            },
            {
              $sort: {
                totalWeight: -1
              }
            },
            {
              $limit: femaleLimit
            }
            ])
            femaleAggregation.get(function (err, femaleData) {
              if (err) return callback(err);

              maleAggregation.get(function (err, maleData) {
                if (err) return callback(err);
                var arrayBottle = []
                var data = []
                // console.log("maleData")
                // console.log(maleData.length)
                // console.log("femaleData")
                // console.log(femaleData.length)

                if (maleLimit != 1000) {
                  data = margeData(maleData, femaleData, maleLimit / 100, femaleLimit / 100) // maleData.concat(femaleData)
                } else {
                  if (filter['owner.gender'] == "male")
                    data = maleData
                  else
                    data = femaleData
                }
                if (data.length == 0) {
                  oneUser.updateAttributes({
                    "stackBottleUser": arrayBottle
                  }, function (err, data) {
                    return callback()
                  })
                } else {
                  for (var i = data.length - 1; i >= 0; i--) {
                    var element = data[i]
                    // if (seenBottle.indexOf(element._id.toString()) != -1) {
                    //   data.splice(i, 1);
                    // } else {
                    //   arrayBottle.unshift(element._id)
                    // }
                    if (seenBottle.indexOf(element._id.toString()) == -1) {
                      arrayBottle.unshift(element._id)
                    }
                    if (i == 0) {
                      arrayBottle = arrayBottle.concat(seenBottle)
                      var getDataTime = (new Date().getTime() - now) / 1000
                      oneUser.updateAttribute(
                        "stackBottleUser", arrayBottle,
                        function (err, data) {
                          if (err) console.log(err)
                          var updateUserTime = (new Date().getTime() - now) / 1000

                          return callback({
                            "updateUserTime": updateUserTime,
                            "getDataTime": getDataTime,
                            "getSeen": getSeen,
                            "newUser": newUser,
                            "getBlock": getBlock,
                          })
                        })
                    }
                  }
                }
              })
            })
          })

          // Bottle.getDataSource().connector.connect(function (err, db) {

          //   var collection = db.collection('bottle');
          //   var cursor = collection.aggregate([{
          //       $match: filter
          //     },
          //     {
          //       $sort: {
          //         totalWeight: -1
          //       }
          //     },
          //     {
          //       $limit: 900
          //     }
          //   ])
          //   cursor.get(function (err, data) {
          //     // console.log(data)
          //     if (err) return callback(err);
          //     var arrayBottle = []
          //     console.log("data.length")
          //     console.log(data.length)
          //     if (data.length == 0) {
          //       oneUser.updateAttributes({
          //         "stackBottleUser": arrayBottle
          //       }, function (err, data) {
          //         return callback()
          //       })
          //     } else {
          //       for (var i = data.length - 1; i >= 0; i--) {
          //         var element = data[i]
          //         // if (seenBottle.indexOf(element._id.toString()) != -1) {
          //         //   data.splice(i, 1);
          //         // } else {
          //         //   arrayBottle.unshift(element._id)
          //         // }
          //         if (seenBottle.indexOf(element._id.toString()) == -1) {
          //           arrayBottle.unshift(element._id)
          //         }
          //         //console.log(arrayBottle)
          //         if (i == 0) {
          //           arrayBottle = arrayBottle.concat(seenBottle)
          //           var getDataTime = (new Date().getTime() - now) / 1000
          //           // console.log(arrayBottle)
          //           oneUser.updateAttribute(
          //             "stackBottleUser", arrayBottle,
          //             function (err, data) {
          //               if (err) console.log(err)
          //               console.log(data)
          //               var updateUserTime = (new Date().getTime() - now) / 1000

          //               return callback({
          //                 "updateUserTime": updateUserTime,
          //                 "getDataTime": getDataTime,
          //                 "getSeen": getSeen,
          //                 "getBlock": getBlock,
          //               })
          //             })
          //         }
          //       }
          //     }
          //   })
          // })
        })
      })
    })
  }

  function shuffle(array) {
    var currentIndex = array.length,
      temporaryValue, randomIndex;

    // While there remain elements to shuffle...
    while (0 !== currentIndex) {

      // Pick a remaining element...
      randomIndex = Math.floor(Math.random() * currentIndex);
      currentIndex -= 1;

      // And swap it with the current element.
      temporaryValue = array[currentIndex];
      array[currentIndex] = array[randomIndex];
      array[randomIndex] = temporaryValue;
    }

    return array;
  }

  function margeData(maleData, femaleData, maleLimit, femaleLimit) {
    let data = []
    let index = 0
    while (maleData[index * maleLimit] != null && femaleData[index * femaleLimit] != null) {
      let maleTempData = maleData.slice(index * maleLimit, (index * maleLimit) + maleLimit)
      let femaleTempData = femaleData.slice(index * femaleLimit, (index * femaleLimit) + femaleLimit)
      let tempData = maleTempData.concat(femaleTempData);
      tempData = shuffle(tempData)
      data = data.concat(tempData);
      index++
    }

    if (maleData[index * maleLimit] != null) {
      let maleTempData = maleData.slice(index * maleLimit, maleData.length)
      data = data.concat(maleTempData);
    }
    if (femaleData[index * femaleLimit] != null) {
      let femaleTempData = femaleData.slice(index * femaleLimit, femaleData.length)
      data = data.concat(femaleTempData);
    }
    return data;

  }

  function getFromStack(userId, offsets, limit, callback) {
    Bottle.app.models.user.findById(userId, function (err, user) {
      if (err)
        return callback(err, null)
      Bottle.getDataSource().connector.connect(function (err, db) {

        var collection = db.collection('user');
        var cursor = collection.aggregate([{
          $match: {
            _id: ObjectId(userId)
          }
        }])
        cursor.get(function (err, users) {
          if (err) return callback(err);
          var stack = users[0].stackBottleUser
          // console.log("stack")
          // console.log(stack)
          var length = stack.length;
          var newOffset = offsets % length
          //console.log(newOffset);
          var bottleIds = stack.slice(newOffset, newOffset + limit);
          // callback(null, bottleIds)
          Bottle.find({
            "where": {
              id: {
                inq: bottleIds
              }
            }
          }, function (err, data) {
            if (err)
              return callback(err, null)
            var newData = [];
            for (let index = 0; index < bottleIds.length; index++) {
              const element = bottleIds[index];
              let bottle = data.find(x => new String(x['id']).valueOf() === new String(element).valueOf());
              //console.log(bottle)
              newData.push(bottle)
            }
            //console.log("newOffset");
            //console.log(newOffset);
            return callback(null, newData)
          })
        })
      })
    })

  }


  // function getFrequency(array, filter) {
  //   var freq = {};
  //   for (var i = 0; i < array.length; i++) {
  //     var element = array[i];
  //     if (freq[element.bottleId]) {
  //       freq[element.bottleId]++;
  //     } else {
  //       // //console.log("element.bottles.owner.gender")
  //       var bottle = element.bottles()
  //       if (bottle && bottle.status == 'active') {
  //         var owner = bottle.owner();
  //         // //console.log("filter.shoreId.toString() == bottle.shoreId.toString()")
  //         // //console.log(filter.shoreId.toString() + "//" + bottle.shoreId.toString())
  //         if (owner && owner.status == 'active' && (filter['owner.gender'] == null || filter['owner.gender'] == owner.gender) && (filter['owner.ISOCode'] == null || filter['owner.ISOCode'] == owner.ISOCode) && (filter.bottleType == null || bottle.bottleType == filter.bottleType) && (filter.shoreId == null || new String(filter.shoreId).valueOf() === new String(bottle.shoreId).valueOf()))
  //           freq[element.bottleId] = 1;

  //       }
  //     }
  //   }
  //   var sortFreq = Object.keys(freq).sort(function (a, b) {
  //     return freq[a] - freq[b]
  //   })
  //   return sortFreq;
  // };

  Bottle.getFrequency = function (userId, mainfilter = {}, callback) {
    var filter = Object.assign({}, mainfilter);

    filter["owner.status"] = "active"
    filter["bottle.viewStatus"] = "active"
    filter["userId"] = ObjectId(userId)
    if (filter.createdAt) {
      delete filter.createdAt
    }
    if (filter.status) {
      delete filter.status
    }
    if (filter.ownerId) {
      delete filter.ownerId
    }

    if (filter.createdAt) {
      delete filter.createdAt
    }
    if (filter.bottleType != null) {
      filter["bottle.bottleType"] = filter.bottleType
      delete filter.bottleType
    }
    if (filter.shoreId != null) {
      filter["bottle.shoreId"] = ObjectId(filter.shoreId)
      delete filter.shoreId
    }
    if (filter.viewStatus != null) {
      filter["bottle.viewStatus"] = filter.viewStatus
      delete filter.viewStatus
    }

    // console.log("filter")
    // console.log(filter)
    Bottle.getDataSource().connector.connect(function (err, db) {

      var collection = db.collection('bottleUserseen');
      var seen = collection.aggregate([{
        $lookup: {
          from: "user",
          localField: "userId",
          foreignField: "_id",
          as: "owner"
        }
      },
      {
        $unwind: "$owner"
      },
      {
        $lookup: {
          from: "bottle",
          localField: "bottleId",
          foreignField: "_id",
          as: "bottle"
        }
      },
      {
        $unwind: "$bottle"
      },
      {
        $match: filter
      },
      {
        $group: {
          _id: '$bottleId',
          count: {
            $sum: 1
          }
        }
      }
      ])
      seen.get(function (err, seens) {
        var data = [];
        // console.log("seens")
        // console.log(seens.length)

        seens.forEach(element => {
          data[element._id] = element.count
        });
        var sortFreq = Object.keys(data).sort(function (a, b) {
          return data[a] - data[b]
        })

        callback(err, sortFreq)
      })
    })
  }

  Bottle.makeBottleViewStatus = function (bottles, callback) {
    if (bottles[0] == null)
      return callback(null, {})
    Bottle.findById(bottles[0], function (err, bottle) {
      if (err)
        return callback(err)
      if (bottle == null)
        return callback(null, {})
      let ownerId = bottle.ownerId
      Bottle.updateAll({
        "ownerId": ownerId
      }, {
        "viewStatus": "deactive"
      }, function (err, data) {
        if (err)
          return callback(err)
        Bottle.updateAll({
          "id": {
            "inq": bottles
          }
        }, {
          "viewStatus": "active"
        }, function (err, data) {
          if (err)
            return callback(err)
          return callback(null, {})
        })
      })
    })
  }
  Bottle.getOneBottle = function (gender, ISOCode, shoreId, req, callback) {
    var result;
    var secFilter = {};
    if (gender) {
      secFilter.gender = gender;
    }

    if (ISOCode) {
      secFilter.ISOCode = ISOCode;
    }

    var seenBottle = [];
    var blockList = [];
    Bottle.app.models.user.findById(req.accessToken.userId, function (err, oneUser) {
      if (err) {
        return callback(err);
      }
      if (oneUser.status !== 'active') {
        return callback(errors.account.notActive());
      }
      // get bottle seen 
      Bottle.app.models.bottleUserseen.find({
        where: {
          userId: req.accessToken.userId
        }
      }, function (err, bottles) {
        seenBottle = bottles;

        // get id user block list 
        Bottle.app.models.block.find({
          where: {
            or: [{
              "ownerId": req.accessToken.userId
            },
            {
              "userId": req.accessToken.userId
            },
            ]
          }
        }, function (err, blocksList) {
          blockList = blocksList.map(function (block) {
            if (new String(req.accessToken.userId).valueOf() === new String(block.ownerId).valueOf())
              return block.userId;
            else
              return block.ownerId;

          });
          var filter = {
            where: {
              status: 'active'
            },
            order: 'totalWeight DESC'

          }
          if (shoreId) {
            filter.where.shoreId = shoreId;
          }

          Bottle.find(filter, function (err, bottles) {
            if (err) {
              callback(err, null);
            }
            var ranking = bottles;

            // process bottle sort
            ranking = sortBottle(bottles, req.accessToken.userId, seenBottle, blockList, secFilter, function (data) {


              if (data[0]) {
                for (let index = 0; index < data.length; index++) {
                  const element = data[index];
                  if (cheackLogBootleOwner(oneUser, data[index].ownerId)) {
                    //console.log("log is fine")
                    var bottleUserseenObject = {
                      "userId": req.accessToken.userId,
                      "bottleId": data[index].id
                    }
                    Bottle.app.models.bottleUserseen.create(bottleUserseenObject)
                      .then()
                      .catch(err => console.log(err));

                    addOwnerBootle(oneUser, data[index].ownerId)
                    // oneUser.save();
                    data[index].bottleViewCount++;
                    data[index].save();
                    return callback(null, data[index]);
                  } else {
                    //console.log("log is not fine")
                    if (index + 1 == data.length) {
                      //console.log("log is good")
                      var bottleUserseenObject = {
                        "userId": req.accessToken.userId,
                        "bottleId": data[0].id
                      }
                      Bottle.app.models.bottleUserseen.create(bottleUserseenObject)
                        .then()
                        .catch(err => console.log(err));

                      addOwnerBootle(oneUser, data[0].ownerId)
                      // oneUser.save();
                      data[0].bottleViewCount++;
                      data[0].save();
                      return callback(null, data[0]);
                    }
                  }
                }
              } else {
                callback(errors.bottle.noNewBottle(), null);
              }
            })
          })
        });
      })
    })

  };


  function addOwnerBootle(oneUser, ownerId) {
    oneUser.foundBottlesCount++;
    if (oneUser.logBootleOwner.length < 3)
      oneUser.logBootleOwner.push(ownerId)
    else {
      oneUser.logBootleOwner.shift()
      oneUser.logBootleOwner.push(ownerId)
    }
    oneUser.updateAttributes({
      "logBootleOwner": oneUser.logBootleOwner.toString(),
      "foundBottlesCount": oneUser.foundBottlesCount
    })
  }

  function cheackLogBootleOwner(oneUser, ownerId) {
    var countRepeted = 0;
    for (let index = 0; index < oneUser.logBootleOwner.length; index++) {
      const element = oneUser.logBootleOwner[index];
      if (element == ownerId.toString())
        countRepeted++;
      if (index + 1 == oneUser.logBootleOwner.length) {
        if (countRepeted < 2)
          return true;
        else
          return false
      }

    }
  }
  // Bottle.getOneBottle = function (gender, ISOCode, shoreId, req, callback) {
  //   var result;
  //   var filter = {};
  //   if (gender) {
  //     filter.gender = gender;
  //   }

  //   if (ISOCode) {
  //     filter.ISOCode = ISOCode;
  //   }

  //   if (shoreId) {
  //     filter.shoreId = shoreId;
  //   }
  //   var seenBottle = [];
  //   var blockList = [];
  //   Bottle.app.models.user.findById(req.accessToken.userId, function (err, oneUser) {
  //     if (err) {
  //       return next(err);
  //     }

  //     // get bottle seen 
  //     Bottle.app.models.bottleUserseen.find({
  //       where: {
  //         userId: req.accessToken.userId
  //       }
  //     }, function (err, bottles) {
  //       seenBottle = bottles;

  //       // get id user block list 
  //       Bottle.app.models.block.find({
  //         where: {
  //           or: [{
  //               "ownerId": req.accessToken.userId
  //             },
  //             {
  //               "userId": req.accessToken.userId
  //             },
  //           ]
  //         }
  //       }, function (err, blocksList) {
  //         blockList = blocksList.map(function (block) {
  //           if (new String(req.accessToken.userId).valueOf() === new String(block.ownerId).valueOf())
  //             return block.userId;
  //           else
  //             return block.ownerId;

  //         });
  //         var filter = {
  //           where: {
  //             status: 'active'
  //           },
  //           order: 'createdAt DESC'
  //         }
  //         if (oneUser.foundBottlesCount < 5) {
  //           filter = {
  //             where: {
  //               status: 'active'
  //             },
  //             order: 'totalWeight DESC'
  //           }
  //         }
  //         Bottle.find(filter, function (err, bottles) {
  //           if (err) {
  //             callback(err, null);
  //           }
  //           var ranking = bottles;

  //           // process bottle sort
  //           ranking = sortBottle(bottles, req.accessToken.userId, seenBottle, blockList, filter)
  //           if (ranking[0]) {
  //             var bottleUserseenObject = {
  //               "userId": req.accessToken.userId,
  //               "bottleId": ranking[0].id
  //             }
  //             Bottle.app.models.bottleUserseen.create(bottleUserseenObject)
  //               .then()
  //               .catch(err => //console.log(err));

  //             oneUser.foundBottlesCount++;
  //             oneUser.save();
  //             ranking[0].bottleViewCount++;
  //             ranking[0].save();
  //             callback(null, ranking[0]);

  //           } else {
  //             callback(errors.bottle.noNewBottle(), null);
  //           }

  //         })
  //       });
  //     })
  //   })

  // };

  Bottle.getOneBottleTest = function (gender, ISOCode, shoreId, userId, req, callback) {
    var result;
    var secFilter = {};
    var mainUserId = req.accessToken.userId
    if (userId != undefined)
      mainUserId = userId
    if (gender) {
      secFilter.gender = gender;
    }

    if (ISOCode) {
      secFilter.ISOCode = ISOCode;
    }

    var seenBottle = [];
    var blockList = [];
    Bottle.app.models.user.findById(mainUserId, function (err, oneUser) {
      if (err) {
        return next(err);
      }

      // get bottle seen 
      Bottle.app.models.bottleUserseen.find({
        "where": {
          "userId": oneUser['id']
        }
      }, function (err, bottles) {
        seenBottle = bottles;
        //console.log("err");
        //console.log(err);
        //console.log("seenBottle")
        //console.log(bottles)
        //console.log("oneUser['id']")
        //console.log(oneUser['id'])
        // return (null, [])
        // get id user block list 
        Bottle.app.models.block.find({
          where: {
            or: [{
              "ownerId": oneUser['id']
            },
            {
              "userId": oneUser['id']
            },
            ]
          }
        }, function (err, blocksList) {
          blockList = blocksList.map(function (block) {
            if (new String(oneUser['id']).valueOf() === new String(block.ownerId).valueOf())
              return block.userId;
            else
              return block.ownerId;

          });
          var filter = {
            where: {
              status: 'active'
            },
            order: 'totalWeight DESC'

          }
          if (shoreId) {
            filter.where.shoreId = shoreId;
          }

          Bottle.find(filter, function (err, bottles) {
            if (err) {
              callback(err, null);
            }
            var ranking = bottles;

            // process bottle sort
            ranking = sortBottle(bottles, oneUser['id'], seenBottle, blockList, secFilter, function (data) {


              if (ranking[0]) {
                var bottleUserseenObject = {
                  "userId": oneUser['id'],
                  "bottleId": ranking[0].id
                }
                Bottle.app.models.bottleUserseen.create(bottleUserseenObject)
                  .then()
                  .catch(err => console.log(err));

                oneUser.foundBottlesCount++;
                oneUser.save();
                ranking[0].bottleViewCount++;
                ranking[0].save();
                callback(null, ranking);

              } else {
                callback(errors.bottle.noNewBottle(), null);
              }
            })
          })
        });
      })
    })
  };

  function diffHourse(date) {
    var date1 = new Date()
    var date2 = new Date(date);
    var timeDiff = Math.abs(date2.getTime() - date1.getTime());
    var diffHour = timeDiff / (1000 * 3600);
    return diffHour;
  }

  function diffdays(date) {
    var date1 = new Date()
    var date2 = new Date(date);
    var timeDiff = Math.abs(date2.getTime() - date1.getTime());
    var diffHour = timeDiff / (1000 * 3600 * 24);
    return diffHour;
  }


  rule.minute = 2;
  // cron.scheduleJob('*/5 * * * *', function () {
  //   Bottle.updateAll({
  //     totalWeight: '-99999999999999999999999'
  //   }, function (err, info) {

  //     var maxHourse = 7 * 24;

  //     var replyCountAvr = 0;
  //     var paidAvr = 0;
  //     Bottle.find({
  //       order: 'createdAt DESC',
  //       limit: 2000,
  //       where: {
  //         "status": "active",
  //         "createdAt": {
  //           "gt": "2019-06-01T13:39:44.419Z"
  //         }
  //       },
  //       include: {
  //         relation: 'owner',
  //       }
  //     }, function (err, data) {
  //       for (let index = 0; index < data.length; index++) {
  //         const element = data[index];
  //         replyCountAvr += element.repliesUserCount;
  //         paidAvr += JSON.parse(JSON.stringify(element.owner())).totalPaid;

  //         if (index == data.length - 1) {
  //           replyCountAvr = replyCountAvr / data.length;
  //           paidAvr = paidAvr / data.length;
  //           var repliesCountWieght = 200 / replyCountAvr;
  //           var paidWieght = 60 / paidAvr;

  //           async.forEachOf(data, function (element, index, callback) {
  //             var gender = element.owner().gender;
  //             var totalPaid = element.owner().totalPaid;
  //             var username = element.owner().username;
  //             // var tempProject = {
  //             //   "paidWieght": paidWieght,
  //             //   "repliesCountWieght": repliesCountWieght,
  //             //   "replyCountAvr": replyCountAvr,
  //             //   "paidAvr": paidAvr,
  //             //   "createdAt": element.createdAt,
  //             //   "numDay": diffdays(element.createdAt),
  //             //   "numHours": diffHourse(element.createdAt),
  //             //   "repliesUserCount": element.repliesUserCount,
  //             //   "totalPaid": totalPaid,
  //             //   "gender": gender,
  //             //   "username": username,
  //             //   "time score": ((maxHourse - diffHourse(element.createdAt)) * 10),
  //             //   "reply score": element.repliesUserCount * repliesCountWieght,
  //             //   "totalPaid score": totalPaid * paidWieght,
  //             //   "score": (totalPaid * paidWieght) + ((maxHourse - diffHourse(element.createdAt)) * 10) + (element.repliesUserCount * repliesCountWieght)
  //             // }
  //             element.totalWeight = (totalPaid * paidWieght) + ((maxHourse - diffHourse(element.createdAt)) * 10) + (element.repliesUserCount * repliesCountWieght);
  //             if (gender == "female") {
  //               // tempProject['score'] = tempProject['score'] * 0.6
  //               element.totalWeight = element.totalWeight * 0.6
  //             }
  //             // result.push(tempProject);
  //             element.save(callback);
  //           }, function () {
  //             //console.log("Finish loop")
  //             // result.sort(tempCompare);
  //             // return mainCallback(null, result);
  //           })
  //         }
  //       }
  //     })
  //   })
  // });
  // Bottle.recommendationTest = function (mainCallback) {
  //   var result = []
  //   Bottle.updateAll({
  //     totalWeight: '-99999999999999999999999'
  //   }, function (err, info) {

  //     var maxHourse = 7 * 24;

  //     var replyCountAvr = 0;
  //     var paidAvr = 0;
  //     Bottle.find({
  //       order: 'createdAt DESC',
  //       limit: 2000,
  //       where: {
  //         "status": "active"
  //       },
  //       include: {
  //         relation: 'owner',
  //       }
  //     }, function (err, data) {
  //       for (let index = 0; index < data.length; index++) {
  //         const element = data[index];
  //         replyCountAvr += element.repliesUserCount;
  //         paidAvr += JSON.parse(JSON.stringify(element.owner())).totalPaid;

  //         if (index == data.length - 1) {
  //           replyCountAvr = replyCountAvr / data.length;
  //           paidAvr = paidAvr / data.length;
  //           var repliesCountWieght = 200 / replyCountAvr;
  //           var paidWieght = 60 / paidAvr;

  //           async.forEachOf(data, function (element, index, callback) {
  //             var gender = element.owner().gender;
  //             var totalPaid = element.owner().totalPaid;
  //             var username = element.owner().username;
  //             var tempProject = {
  //               "paidWieght": paidWieght,
  //               "repliesCountWieght": repliesCountWieght,
  //               "replyCountAvr": replyCountAvr,
  //               "paidAvr": paidAvr,
  //               "createdAt": element.createdAt,
  //               "numDay": diffdays(element.createdAt),
  //               "numHours": diffHourse(element.createdAt),
  //               "repliesUserCount": element.repliesUserCount,
  //               "totalPaid": totalPaid,
  //               "gender": gender,
  //               "username": username,
  //               "time score": ((maxHourse - diffHourse(element.createdAt)) * 10),
  //               "reply score": element.repliesUserCount * repliesCountWieght,
  //               "totalPaid score": totalPaid * paidWieght,
  //               "score": (totalPaid * paidWieght) + ((maxHourse - diffHourse(element.createdAt)) * 10) + (element.repliesUserCount * repliesCountWieght)
  //             }

  //             tempProject.score = (totalPaid * paidWieght) + ((maxHourse - diffHourse(element.createdAt)) * 10) + (element.repliesUserCount * repliesCountWieght);
  //             element.totalWeight = (totalPaid * paidWieght) + ((maxHourse - diffHourse(element.createdAt)) * 10) + (element.repliesUserCount * repliesCountWieght);
  //             if (gender == "female") {
  //               tempProject['score'] = tempProject['score'] * 0.6
  //               element.totalWeight = element.totalWeight * 0.6
  //             }
  //             result.push(tempProject);
  //             element.save(callback);
  //           }, function () {
  //             //console.log("Finish loop")
  //             result.sort(tempCompare);
  //             return mainCallback(null, result);
  //           })
  //         }
  //       }
  //     })
  //   })
  // }

  function tempCompare(a, b) {
    if (a.score > b.score)
      return -1;
    if (a.score < b.score)
      return 1;
    return 0;
  }

  function sortBottle(ranking, userId, seenBottle, blockList, filter, mainCallback) {
    var length = ranking.length - 1;
    const tempRanking = Object.assign({}, ranking);
    var newRanking = [];
    var numofDeleted = 0
    var blocking = false;
    async.forEachOf(tempRanking, function (element, index, callback) {
      element.owner(function (err, owner) {
        element.shore(function (err, shore) {
          var numberOfSeenThisBottle = findInSeenUser(seenBottle, userId, element.id);
          if (owner == undefined) { }
          var isBlocked = true
          if (owner != null)
            isBlocked = isInBlockList(blockList, owner.id)
          if (owner == null || element.status == "deactive" || owner.status == "deactive" || isBlocked || (new String(userId).valueOf() === new String(owner.id).valueOf()) || (filter.gender && filter.gender != owner.gender) || (filter.ISOCode && filter.ISOCode != owner.ISOCode)) {
            ranking.splice(index - numofDeleted, 1);
            numofDeleted++
          } else if (numberOfSeenThisBottle > 0) {
            ranking[index - numofDeleted].numberRepeted = numberOfSeenThisBottle;
            //console.log("numberOfSeenThisBottle");
            //console.log(ranking[index - numofDeleted].numberRepeted);
            //console.log(ranking[index - numofDeleted].id);
            newRanking.unshift(ranking[index - numofDeleted]);
            ranking.splice(index - numofDeleted, 1);
            numofDeleted++
          }
          callback();
        });
      });

    }, function () {
      //console.log("Finish loop")
      newRanking.sort(compare);
      var res = ranking.concat(newRanking);
      //console.log("newRanking")
      //console.log(newRanking.length)
      //console.log("ranking")
      //console.log(ranking.length)
      //console.log("res")
      //console.log(res.length)
      mainCallback(res);
    });
    // while (index >= 0) {
    //   var element = ranking[index];
    //   if (element.owner() == null) {
    //     //console.log("element.id");
    //     //console.log(element.id);
    //   }
    //  element.owner(function (err, owner) {
    //     element.shore(function (err, shore) {
    //       var numberOfSeenThisBottle = findInSeenUser(seenBottle, userId, element.id);
    //       if (owner == undefined) {
    //         //console.log("element.id");
    //         //console.log(element.id);
    //       }
    //       var isBlocked = true
    //       if (owner != null)
    //         isBlocked = isInBlockList(blockList, owner.id)
    //       if (owner==null || element.status == "deactive" || owner.status == "deactive" || isBlocked || (new String(userId).valueOf() === new String(owner.id).valueOf()) || (filter.gender && filter.gender != owner.gender) || (filter.ISOCode && filter.ISOCode != owner.ISOCode)) {
    //         ranking.splice(index, 1);
    //       } else if (numberOfSeenThisBottle > 0) {
    //         ranking[index].numberRepeted = numberOfSeenThisBottle;
    //         newRanking.unshift(ranking[index]);
    //         ranking.splice(index, 1);
    //       }
    //     });
    //   });
    //   index -= 1;
    // }
    // newRanking.sort(compare);
    // ranking = ranking.concat(newRanking);
    // return ranking;
  }

  function isInBlockList(blockList, userId) {
    var result = false;
    blockList.forEach(function (element) {
      if ((new String(userId).valueOf() === new String(element).valueOf())) {
        result = true;
        return;
      }
    }, this);
    return result;
  }


  // function for sort bottle depend of weight
  function compare(a, b) {
    if (a.numberRepeted < b.numberRepeted)
      return -1;
    if (a.numberRepeted > b.numberRepeted)
      return 1;
    return 0;
  }

  function getData() {

  }

  function findInSeenUser(array, keyA, keyB) {
    var found = 0;
    array.forEach(function (element) {

      if (new String(element.userId).valueOf() === new String(keyA).valueOf() && new String(element.bottleId).valueOf() === new String(keyB).valueOf()) {
        found++;
      }
    }, this);
    return found;
  }


  /**
   * report as time
   * @param {date} from
   * @param {date} to
   * @param {Function(Error, object)} callback
   */

  function getFirstReport(filter, country, callback) {
    if (country) {
      filter['ISOCode'] = country
    }
    Bottle.getDataSource().connector.connect(function (err, db) {

      var collection = db.collection('user');
      var cursor = collection.aggregate([{
        $match: filter
      },
      {
        $group: {
          _id: {
            month: {
              $month: "$createdAt"
            },
            day: {
              $dayOfMonth: "$createdAt"
            },
            year: {
              $year: "$createdAt"
            }
          },
          total: {
            $sum: 1
          }
        }
      },
      {
        $sort: {
          "_id.year": 1,
          "_id.month": 1,
          "_id.day": 1,
        }
      },
      {
        $project: {
          _id: 0,
          date: "$_id",
          count: "$total",
        }
      }
      ]);
      cursor.get(function (err, data) {
        if (err) return callback(err);
        return callback(null, data);
      })
    });
  }


  function getSecondReport(filter, country, callback) {
    if (country) {
      filter['owner.ISOCode'] = country
    }
    Bottle.getDataSource().connector.connect(function (err, db) {

      var collection = db.collection('bottle');
      var cursor = collection.aggregate([{
        $lookup: {
          from: "user",
          localField: "ownerId",
          foreignField: "_id",
          as: "owner"
        }
      },
      {
        $match: filter
      },
      {
        $group: {
          _id: {
            month: {
              $month: "$createdAt"
            },
            day: {
              $dayOfMonth: "$createdAt"
            },
            year: {
              $year: "$createdAt"
            }
          },
          total: {
            $sum: 1
          }
        }
      },
      {
        $sort: {
          "_id.year": 1,
          "_id.month": 1,
          "_id.day": 1,
        }
      },
      {
        $project: {
          _id: 0,
          date: "$_id",
          count: "$total",
        }
      }
      ]);
      cursor.get(function (err, data) {
        if (err) return callback(err);
        return callback(null, data);
      })
    });
  }




  function getThierdReport(filter, country, callback) {
    if (country) {
      filter['ISOCode'] = country
    }
    Bottle.getDataSource().connector.connect(function (err, db) {

      var collection = db.collection('userActivate');
      var cursor = collection.aggregate([{
        $lookup: {
          from: "user",
          localField: "ownerId",
          foreignField: "_id",
          as: "owner"
        }
      }, {
        $match: filter
      },
      {
        $group: {
          _id: {
            month: {
              $month: "$createdAt"
            },
            day: {
              $dayOfMonth: "$createdAt"
            },
            year: {
              $year: "$createdAt"
            }
          },
          total: {
            $sum: 1
          },
        }
      },
      {
        $sort: {
          "_id.year": 1,
          "_id.month": 1,
          "_id.day": 1,
        }
      },
      {
        $project: {
          _id: 0,
          date: "$_id",
          count: "$total",
        }
      }
      ]);
      cursor.get(function (err, data) {
        if (err) return callback(err);
        return callback(null, data);
      })
    });
  }


  Bottle.timeStateReport = function (from, to, country, callback) {
    var filter = {}
    if (from) {
      filter['createdAt'] = {
        '$gt': new Date(from)
      }
    }
    if (to) {
      if (filter['createdAt'] == null)
        filter['createdAt'] = {}
      filter['createdAt']['$lt'] = new Date(to)
    }


    var resultData = []
    getFirstReport(filter, country, function (err, firstData) {
      resultData[0] = firstData;
      getSecondReport(filter, country, function (err, secondetData) {
        resultData[1] = secondetData;
        getThierdReport(filter, country, function (err, thierdData) {
          resultData[2] = thierdData;
          callback(null, resultData)
        })
      })

    });
  };

  Bottle.timeStateExport = function (from, to, country, callback) {
    var filter = {}
    if (from) {
      filter['createdAt'] = {
        '$gt': new Date(from)
      }
    }
    if (to) {
      if (filter['createdAt'] == null)
        filter['createdAt'] = {}
      filter['createdAt']['$lt'] = new Date(to)
    }

    var mainData = []
    var resultData = []
    getFirstReport(filter, country, function (err, firstData) {
      resultData[0] = convertAgrrig(firstData);
      getSecondReport(filter, country, function (err, secondetData) {
        resultData[1] = convertAgrrig(secondetData);
        getThierdReport(filter, country, function (err, thierdData) {
          resultData[2] = convertAgrrig(thierdData);
          var From = startDate(firstData[0], secondetData[0], thierdData[0])
          var To = endDate(firstData[firstData.length - 1], secondetData[secondetData.length - 1], thierdData[thierdData.length - 1])
          var dates = convertDates(Array.from(datesBetween(new Date(From), new Date(To))));
          // resultData.forEach(function (element) {
          //   dates = convertDates(Array.from(datesBetween(new Date(From), new Date(To))));
          //   for (var prop in dates) {
          //     if (element[prop] == null)
          //       dates[prop] = 0;
          //     else
          //       dates[prop] = element[prop]
          //   }
          //   mainData.push(dates);
          //   //console.log(mainData)
          //   // }
          // }, this);
          for (var prop in dates) {
            var object = {
              "date": "",
              "user": 0,
              "bootle": 0,
              "user active": 0
            }
            if (resultData[0][prop] != null || resultData[1][prop] != null || resultData[2][prop] != null) {
              object['date'] = prop;
              if (resultData[0][prop] != null)
                object['user'] = resultData[0][prop];
              if (resultData[1][prop] != null)
                object['bootle'] = resultData[1][prop];
              if (resultData[2][prop] != null)
                object['user active'] = resultData[2][prop];
              mainData.push(object);
            }
          }
          var config = {
            path: 'uploadFiles/excelFiles',
            save: true,
            fileName: 'timeState' + Date.now() + '.xlsx'
          };
          var model = mongoXlsx.buildDynamicModel(mainData);


          /* Generate Excel */
          mongoXlsx.mongoData2Xlsx(mainData, model, config, function (err, data) {
            if (err)
              callback(err, null);
            //console.log('File saved at:', data.fullPath);
            callback(null, {
              'path': urlFileRootexcel + config['fileName']
            });

          });
        })
      })

    });
  };

  function convertDates(Data) {
    var array = [];
    Data.forEach(function (element, index) {
      array[element.getFullYear() + "-" + (element.getMonth() + 1) + "-" + element.getDate()] = 0;
    }, this);
    return array;
  }


  function convertAgrrig(Data) {
    var array = [];
    Data.forEach(function (element) {
      array[element.date['year'] + "-" + element.date['month'] + "-" + element.date['day']] = element.count;
    }, this);
    return array;
  }

  function startDate(first, seconde, thierd) {
    var arrayStart = [];
    if (first != null) {
      arrayStart.push(first.date['year'] + "-" + first.date['month'] + "-" + first.date['day']);
    }
    if (seconde != null) {
      arrayStart.push(seconde.date['year'] + "-" + seconde.date['month'] + "-" + seconde.date['day']);
    }
    if (thierd != null) {
      arrayStart.push(thierd.date['year'] + "-" + thierd.date['month'] + "-" + thierd.date['day']);
    }
    var orderedDates = arrayStart.sort(function (a, b) {
      return Date.parse(a) > Date.parse(b);
    });
    return orderedDates[0];
  }

  function endDate(first, seconde, thierd) {
    var arrayEnd = [];
    if (first != null) {
      arrayEnd.push(first.date['year'] + "-" + first.date['month'] + "-" + first.date['day']);
    }
    if (seconde != null) {
      arrayEnd.push(seconde.date['year'] + "-" + seconde.date['month'] + "-" + seconde.date['day']);
    }
    if (thierd != null) {
      arrayEnd.push(thierd.date['year'] + "-" + thierd.date['month'] + "-" + thierd.date['day']);
    }
    var orderedDates = arrayEnd.sort(function (a, b) {
      return Date.parse(a) < Date.parse(b);
    });
    return orderedDates[0];
  }



  Bottle.export = function (filter, callback) {
    var shoreId = "";
    var gt = ""
    var ls = ""
    var gender = ""
    var ISOCode = ""
    var index
    var username = "";
    if (filter != null)
      index = filter['where']['and'].length - 1;
    else
      index = -1
    while (index >= 0) {
      if (filter['where']['and'][index]['owner.gender'] != null) {
        gender = filter['where']['and'][index]['owner.gender'];
        filter['where']['and'].splice(index, 1)
      } else if (filter['where']['and'][index]['owner.ISOCode'] != null) {
        ISOCode = filter['where']['and'][index]['owner.ISOCode'];
        filter['where']['and'].splice(index, 1)
      } else if (filter['where']['and'][index]['owner.username'] != null) {
        username = filter['where']['and'][index]['owner.username'];
        filter['where']['and'].splice(index, 1)
      }



      index -= 1;
    }

    if (filter == null || filter['where']['and'][0] == null)
      filter = {}

    var config = {
      path: 'uploadFiles/excelFiles',
      save: true,
      fileName: 'bottle' + Date.now() + '.xlsx'
    };
    var data = [];
    Bottle.find(filter, function (err, bottles) {
      bottles.forEach(function (element) {

        var object = {};
        var ownerObject
        var secObject = {}
        var shoreObject;
        element.owner(function (err, owner) {
          var countryNaem
          owner.country(function (err, country) {
            countryNaem = country.name
          })
          if (((gender == "" || owner.gender == gender) && (ISOCode == "" || owner.ISOCode == ISOCode)) && (username == "" || owner.username.include(username))) {
            if (owner['lastLogin'] != null)
              ownerObject = {
                country: countryNaem,
                image: owner['image'],
                totalBottlesThrown: owner['totalBottlesThrown'],
                repliesBottlesCount: owner['repliesBottlesCount'],
                repliesReceivedCount: owner['repliesReceivedCount'],
                foundBottlesCount: owner['foundBottlesCount'],
                extraBottlesCount: owner['extraBottlesCount'],
                bottlesCount: owner['bottlesCount'],
                registrationCompleted: owner['registrationCompleted'],
                gender: owner['gender'],
                nextRefill: owner['nextRefill'].toString(),
                ownerCreatedAt: owner['createdAt'].toString(),
                lastLogin: owner['lastLogin'].toString(),
                email: owner['email'],
                status: owner['status'],
                typeLogIn: owner['typeLogIn'],
                username: owner['username']
              }
            else
              ownerObject = {
                country: countryNaem,
                image: owner['image'],
                totalBottlesThrown: owner['totalBottlesThrown'],
                repliesBottlesCount: owner['repliesBottlesCount'],
                repliesReceivedCount: owner['repliesReceivedCount'],
                foundBottlesCount: owner['foundBottlesCount'],
                extraBottlesCount: owner['extraBottlesCount'],
                bottlesCount: owner['bottlesCount'],
                registrationCompleted: owner['registrationCompleted'],
                gender: owner['gender'],
                nextRefill: owner['nextRefill'].toString(),
                ownerCreatedAt: owner['createdAt'].toString(),
                email: owner['email'],
                status: owner['status'],
                typeLogIn: owner['typeLogIn'],
                username: owner['username']
              }
          }
        })

        element.shore(function (err, shore) {
          shoreObject = {
            name_ar: shore['name_ar'],
            name_en: shore['name_en'],
            cover: shore['cover'],
            icon: shore['icon']
          }
        })
        var objectBottle = {
          file: element['file'],
          status: element['status'],
          thumbnail: element['thumbnail'],
          CreatedAt: element['createdAt'].toString(),
          viewUserCount: element['bottleViewCount'],
          repliesUserCount: element['repliesUserCount'],
          completedUserCount: element['bottleCompleteCount']
        }

        if (ownerObject != null) {
          object = Object.assign({}, objectBottle, shoreObject);
          secObject = Object.assign({}, object, ownerObject);
          data.push(secObject);
        }
      }, this);
      /* Generate automatic model for processing (A static model should be used) */
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


  Bottle.typeStateReport = function (from, to, callback) {

    var filter = {};
    if (from) {
      filter['createdAt'] = {
        '$gt': new Date(from)
      }
    }
    if (to) {
      if (filter['createdAt'] == null)
        filter['createdAt'] = {}
      filter['createdAt']['$lt'] = new Date(to)
    }
    Bottle.getDataSource().connector.connect(function (err, db) {

      var collection = db.collection('bottle');
      var cursor = collection.aggregate([{
        $match: filter
      },
      {
        $project: {
          audio: {
            $cond: [{
              $eq: ["$bottleType", "audio"]
            }, 1, 0]
          },
          video: {
            $cond: [{
              $eq: ["$bottleType", "video"]
            }, 1, 0]
          },
        }
      },
      {
        $group: {
          _id: null,
          audio: {
            $sum: "$audio"
          },
          video: {
            $sum: "$video"
          },
          total: {
            $sum: 1
          },
        }
      },
      ]);
      cursor.get(function (err, data) {
        //console.log(data);
        if (err) return callback(err);
        var audioPercent = 0
        var videoPercent = 0
        if (data[0] != null && data[0]['audio'] != 0 && data[0]['total'] != 0)
          audioPercent = data[0]['audio'] * 100 / data[0]['total']
        if (data[0] != null && data[0]['video'] != 0 && data[0]['total'] != 0)
          videoPercent = data[0]['video'] * 100 / data[0]['total']
        var result = {
          "audio": audioPercent,
          "video": videoPercent
        }
        return callback(null, result);
      })
    });
  };

};
