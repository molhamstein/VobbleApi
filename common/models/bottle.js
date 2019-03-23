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


module.exports = function (Bottle) {

  var urlFileRoot = config.domain + config.restApiRoot + "/uploadFiles";

  var urlFileRootexcel = urlFileRoot + '/excelFiles/download/';


  Bottle.validatesInclusionOf('status', {
    in: ['deactive', 'active']
  });

  /**
   *
   * @param {string} id
   * @param {Function(Error)} callback
   */

  Bottle.deactiveBottle = function (id, callback) {
    // TODO
    Bottle.findById(id, function (err, bottle) {
      if (err) {
        console.log(err);
        next();
      }
      bottle.status = "deactive";
      bottle.save();
      callback(null);
    });
    callback(null);
  };

  // Set owner Id
  Bottle.beforeRemote('create', function (context, result, next) {
    // check user is active 
    if (context.res.locals.user.status !== 'active') {
      return next(errors.account.notActive());
    }

    if (context.req.body.ownerId == null)
      context.req.body.ownerId = context.req.accessToken.userId;
    let weight = 0
    Bottle.app.models.User.findById(context.req.body.ownerId, function (err, user) {
      if (err) {
        console.log(err);
        next();
      }
      if (user.bottlesCount == 0 && user.extraBottlesCount == 0) {
        return next(errors.bottle.noAvailableBottleToday());
      }
      Bottle.app.models.shore.findById(context.req.body.shoreId, function (err, shore) {
        if (err) {
          return next(err);
        }
        shore.bottleCount++;
        shore.save();
        weight += Date.parse(new Date()) * 3;
        weight += Date.parse(user.createdAt) * 4;
        context.req.body.weight = weight;
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
    const user = context.res.locals.user;
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
        console.log("ssss")
        console.log(oneTopic)
        oneTopic.bottleCount++;
        oneTopic.save();
        next()
      })
    }
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

  function getFilter(filter, callback) {
    var shoreId = ""
    var gt = ""
    var ls = ""
    var gender = ""
    var username = ""
    var ISOCode = ""

    var index
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
    Bottle.find(
      filter,
      function (err, bottles) {
        if (err)
          callback(err, null);
        var result = [];
        if (bottles) {
          bottles.forEach(function (element) {
            element.owner(function (err, owner) {
              if (((gender == "" || owner.gender == gender) && (username == "" || owner.username.includes(username)) && (ISOCode == "" || owner.ISOCode == ISOCode))) {
                result.push(element);
              }
            })
          }, this);
        }
        callback(null, result);
      })
  }

  // get bottle to view
  Bottle.getFilterBottle = function (filter, callback) {
    var offset = filter['offset'];
    var limit = filter['limit'];
    console.log(offset)
    console.log(limit)
    if (offset == null)
      offset = 0;
    if (limit == null)
      limit = 10;

    getFilter(filter, function (err, data) {
      if (err)
        callback(err, null);
      var newData = data.slice(offset, offset + limit);
      callback(err, newData);
    })

  }

  /**
   *
   * @param {Function(Error, object)} callback
   */

  Bottle.countFilter = function (filter, callback) {

    getFilter(filter, function (err, data) {
      if (err)
        callback(err, null);
      callback(err, {
        "count": data.length
      });
    })

  };

  Bottle.getOneBottle = function (gender, ISOCode, shoreId, req, callback) {
    var result;
    var filter = {};
    if (gender) {
      filter.gender = gender;
    }

    if (ISOCode) {
      filter.ISOCode = ISOCode;
    }

    if (shoreId) {
      filter.shoreId = shoreId;
    }
    var seenBottle = [];
    var blockList = [];
    Bottle.app.models.user.findById(req.accessToken.userId, function (err, oneUser) {
      if (err) {
        return next(err);
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
            order: 'createdAt DESC'
          }
          if (oneUser.foundBottlesCount < 5) {
            filter = {
              where: {
                status: 'active'
              },
              order: 'totalWeight DESC'
            }
          }
          Bottle.find(filter, function (err, bottles) {
            if (err) {
              callback(err, null);
            }
            var ranking = bottles;

            // process bottle sort
            ranking = sortBottle(bottles, req.accessToken.userId, seenBottle, blockList, filter)
            if (ranking[0]) {
              var bottleUserseenObject = {
                "userId": req.accessToken.userId,
                "bottleId": ranking[0].id
              }
              Bottle.app.models.bottleUserseen.create(bottleUserseenObject)
                .then()
                .catch(err => console.log(err));

              oneUser.foundBottlesCount++;
              oneUser.save();
              ranking[0].bottleViewCount++;
              ranking[0].save();
              callback(null, ranking[0]);

            } else {
              callback(errors.bottle.noNewBottle(), null);
            }

          })
        });
      })
    })

  };

  Bottle.getOneBottleTest = function (gender, ISOCode, shoreId, req, callback) {
    var result;
    var filter = {};
    if (gender) {
      filter.gender = gender;
    }

    if (ISOCode) {
      filter.ISOCode = ISOCode;
    }

    if (shoreId) {
      filter.shoreId = shoreId;
    }
    var seenBottle = [];
    // get bottle seen 
    Bottle.app.models.bottleUserseen.find({
      where: {
        userId: req.accessToken.userId
      }
    }, function (err, bottles) {
      seenBottle = bottles;
    })

    var blockList = [];
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
    })

    // get all bottle
    Bottle.find({
      where: {
        status: 'active'
      },
      order: 'createdAt DESC'
    }, function (err, bottles) {
      if (err) {
        callback(err, null);
      }
      var ranking = bottles;
      ranking = sortBottle(bottles, req.accessToken.userId, seenBottle, blockList, filter)
      if (ranking[0]) {
        var bottleUserseenObject = {
          "userId": req.accessToken.userId,
          "bottleId": ranking[0].id
        }
        Bottle.app.models.bottleUserseen.create(bottleUserseenObject)
          .then()
          .catch(err => console.log(err));

        Bottle.app.models.user.findById(req.accessToken.userId, function (err, oneUser) {
          if (err) {
            return next(err);
          }
          oneUser.foundBottlesCount++;
          oneUser.save();
          callback(null, ranking);

        })

      } else {
        callback(errors.bottle.noNewBottle(), null);
      }
    });
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
  cron.scheduleJob('0 */2 * * *', function () {
    console.log(new Date(), 'Every 4 hours');
    Bottle.updateAll({
      totalWeight: '-99999999999999999999999'
    }, function (err, info) {

      var maxHourse = 7 * 24;

      var replyCountAvr = 0;
      var paidAvr = 0;
      Bottle.find({
        order: 'createdAt DESC',
        limit: 250,
        include: {
          relation: 'owner',
        }
      }, function (err, data) {
        for (let index = 0; index < data.length; index++) {
          const element = data[index];
          // hoursAvr += diffHourse(element.createdAt);
          // dayAvr += diffdays(element.createdAt);
          replyCountAvr += element.repliesUserCount;
          paidAvr += JSON.parse(JSON.stringify(element.owner())).totalPaid;

          if (index == data.length - 1) {
            replyCountAvr = replyCountAvr / data.length;
            paidAvr = paidAvr / data.length;
            var repliesCountWieght = 200 / replyCountAvr;
            var paidWieght = 75 / paidAvr;
            for (let secIndex = 0; secIndex < data.length; secIndex++) {
              const element = data[secIndex];
              // var tempProject = {
              //   "createdAt": element.createdAt,
              //   "numDay": diffdays(element.createdAt),
              //   "numHours": diffHourse(element.createdAt),
              //   "repliesUserCount": element.repliesUserCount,
              //   "totalPaid": JSON.parse(JSON.stringify(element.owner())).totalPaid,
              //   "scoor1": ((maxHourse - diffHourse(element.createdAt)) * 10),
              //   "scoor2": element.repliesUserCount * repliesCountWieght,
              //   "scoor3": JSON.parse(JSON.stringify(element.owner())).totalPaid * paidWieght,
              //   "scoor": (JSON.parse(JSON.stringify(element.owner())).totalPaid * paidWieght) + ((maxHourse - diffHourse(element.createdAt)) * 10) + (element.repliesUserCount * repliesCountWieght)
              // }
              element.totalWeight = (JSON.parse(JSON.stringify(element.owner())).totalPaid * paidWieght) + ((maxHourse - diffHourse(element.createdAt)) * 10) + (element.repliesUserCount * repliesCountWieght);
              element.save();
            }

          }
        }
      })
    })
  });
  Bottle.recommendationTest = function (callback) {
    Bottle.updateAll({
      totalWeight: '-99999999999999999999999'
    }, function (err, info) {

      var maxHourse = 7 * 24;

      var replyCountAvr = 0;
      var paidAvr = 0;
      Bottle.find({
        order: 'createdAt DESC',
        limit: 250,
        include: {
          relation: 'owner',
        }
      }, function (err, data) {
        if (err) {
          return callback(err)
        }
        for (let index = 0; index < data.length; index++) {
          const element = data[index];
          // hoursAvr += diffHourse(element.createdAt);
          // dayAvr += diffdays(element.createdAt);
          replyCountAvr += element.repliesUserCount;
          paidAvr += JSON.parse(JSON.stringify(element.owner())).totalPaid;

          if (index == data.length - 1) {
            replyCountAvr = replyCountAvr / data.length;
            paidAvr = paidAvr / data.length;
            var repliesCountWieght = 200 / replyCountAvr;
            var paidWieght = 75 / paidAvr;
            for (let secIndex = 0; secIndex < data.length; secIndex++) {
              const element = data[secIndex];
              var tempProject = {
                "createdAt": element.createdAt,
                "numDay": diffdays(element.createdAt),
                "numHours": diffHourse(element.createdAt),
                "repliesUserCount": element.repliesUserCount,
                "totalPaid": JSON.parse(JSON.stringify(element.owner())).totalPaid,
                "scoor1": ((maxHourse - diffHourse(element.createdAt)) * 10),
                "scoor2": element.repliesUserCount * repliesCountWieght,
                "scoor3": JSON.parse(JSON.stringify(element.owner())).totalPaid * paidWieght,
                "scoor": (JSON.parse(JSON.stringify(element.owner())).totalPaid * paidWieght) + ((maxHourse - diffHourse(element.createdAt)) * 10) + (element.repliesUserCount * repliesCountWieght)
              }
              element.totalWeight = (JSON.parse(JSON.stringify(element.owner())).totalPaid * paidWieght) + ((maxHourse - diffHourse(element.createdAt)) * 10) + (element.repliesUserCount * repliesCountWieght);
              element.save();
              if (secIndex == data.length - 1) {
                callback(err, 0);
              }
            }

          }
        }
      })
    })
  }

  function tempCompare(a, b) {
    if (a.scoor > b.scoor)
      return -1;
    if (a.scoor < b.scoor)
      return 1;
    return 0;
  }

  function sortBottle(ranking, userId, seenBottle, blockList, filter) {
    var index = ranking.length - 1;
    var newRanking = [];
    var blocking = false;
    while (index >= 0) {
      var element = ranking[index];
      if (element.owner() == null) {
        console.log("element.id");
        console.log(element.id);
      }
      element.owner(function (err, owner) {
        element.shore(function (err, shore) {
          var numberOfSeenThisBottle = findInSeenUser(seenBottle, userId, element.id);
          if (owner == undefined) {
            console.log("element.id");
            console.log(element.id);
          }
          var isBlocked = true
          if (owner != null)
            isBlocked = isInBlockList(blockList, owner.id)
          if (owner && (element.status == "deactive" || owner.status == "deactive" || isBlocked || (new String(userId).valueOf() === new String(owner.id).valueOf()) || (filter.gender && filter.gender != owner.gender) || (filter.ISOCode && filter.ISOCode != owner.ISOCode) || (filter.shoreId && (new String(filter.shoreId).valueOf() != new String(shore.id).valueOf())))) {
            ranking.splice(index, 1);
          } else if (numberOfSeenThisBottle > 0) {
            ranking[index].numberRepeted = numberOfSeenThisBottle;
            newRanking.unshift(ranking[index]);
            ranking.splice(index, 1);
          }
          index -= 1;
        });
      });
    }
    newRanking.sort(compare);
    ranking = ranking.concat(newRanking);
    return ranking;
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
          resultData.forEach(function (element) {
            // console.log("//////////////////////////")
            dates = convertDates(Array.from(datesBetween(new Date(From), new Date(To))));
            for (var prop in dates) {
              if (element[prop] == null)
                dates[prop] = 0;
              else
                dates[prop] = element[prop]
            }
            mainData.push(dates);
            // }
          }, this);
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
            console.log('File saved at:', data.fullPath);
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
          repliesUserCount: element['repliesUserCount'],
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
        console.log('File saved at:', data.fullPath);
        callback(null, {
          'path': urlFileRootexcel + config['fileName']
        });

      });
    });


    // {
    //   "where": {
    //     "and": [{
    //       "owner.gender": "male"
    //     }, {
    //       "shoreId": "5b2a6dae4341292648004b2b"
    //     }, {
    //       "owner.ISOCode": "CC"
    //     }, {
    //       "createdAt": {
    //         "gt": "2014-10-20T00:00:00.000Z"
    //       }
    //     }, {
    //       "createdAt": {
    //         "lt": "2018-10-20T00:00:00.000Z"
    //       }
    //     }]
    //   }
    // }

    // "shoreId": "5b2a6dae4341292648004b2b"
    //     }, {




  };


};
