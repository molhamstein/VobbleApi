'use strict';
const errors = require('../../server/errors');

module.exports = function (Bottle) {
  Bottle.validatesInclusionOf('status', { in: ['deactive', 'active']
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
    next();
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

  // get bottle to view
  Bottle.getFilterBottle = function (filter, callback) {
    var shoreId = "";
    var gt = ""
    var ls = ""
    var gender = ""
    var ISOCode = ""


    // filter['where']['and'].forEach(function (key, element) {
    //   if (key['owner.gender'] != null) {
    //     gender = key['owner.gender'];
    //     filter['where']['and'].splice(element, 1)
    //   } else if (key['owner.ISOCode'] != null) {
    //     ISOCode = key['owner.ISOCode'];
    //     filter['where']['and'].splice(element, 1)
    //   }
    // }, this);

    var index = filter['where']['and'].length - 1;

    while (index >= 0) {
      if (filter['where']['and'][index]['owner.gender'] != null) {
        gender = filter['where']['and'][index]['owner.gender'];
        filter['where']['and'].splice(index, 1)
      } else if (filter['where']['and'][index]['owner.ISOCode'] != null) {
        ISOCode = filter['where']['and'][index]['owner.ISOCode'];
        filter['where']['and'].splice(index, 1)
      }

      index -= 1;
    }

    if (filter['where']['and'][0] == null)
      filter = {}
    Bottle.find(
      filter,
      function (err, bottles) {
        if (err)
          callback(err, null);
        console.log("bottles")
        console.log(bottles)
        var result = [];
        if (bottles) {
          bottles.forEach(function (element) {
            element.owner(function (err, owner) {
              if (((gender != "" && owner.gender != gender) || (ISOCode != "" && owner.ISOCode != ISOCode)) == false) {
                result.push(element);
              }
            })
          }, this);
        }
        callback(null, result);
      })



  }

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
      console.log(blocksList);
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
      order: 'weight DESC'
    }, function (err, bottles) {
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

        Bottle.app.models.user.findById(req.accessToken.userId, function (err, oneUser) {
          if (err) {
            return next(err);
          }
          oneUser.foundBottlesCount++;
          oneUser.save();
          callback(null, ranking[0]);

        })

      } else {
        callback(errors.bottle.noNewBottle(), null);
      }
    });
  };


  function sortBottle(ranking, userId, seenBottle, blockList, filter) {
    console.log("blockList");
    console.log(blockList);
    var index = ranking.length - 1;
    console.log("ranking")
    console.log(ranking)
    var newRanking = [];
    var blocking = false;
    while (index >= 0) {
      var element = ranking[index];
      element.owner(function (err, owner) {
        element.shore(function (err, shore) {
          var numberOfSeenThisBottle = findInSeenUser(seenBottle, userId, element.id);
          var isBlocked = isInBlockList(blockList, owner.id)
          console.log("shoreId Filter")
          console.log(filter.shoreId)
          console.log("shoreId")
          console.log(shore.id)
          if (element.status == "deactive" || owner.status == "deactive" || isBlocked || (new String(userId).valueOf() === new String(owner.id).valueOf()) || (filter.gender && filter.gender != owner.gender) || (filter.ISOCode && filter.ISOCode != owner.ISOCode) || (filter.shoreId && (new String(filter.shoreId).valueOf() != new String(shore.id).valueOf()))) {
            ranking.splice(index, 1);
          } else if (numberOfSeenThisBottle > 0) {
            ranking[index].numberRepeted = numberOfSeenThisBottle;
            newRanking.push(ranking[index]);
            ranking.splice(index, 1);
          }
        });
      });
      index -= 1;
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

  // Bottle.getDataSource().connector.connect(function(err, db) {
  //   var collection = db.collection('bottle');
  //   var cursor = collection.aggregate([
  //     { $match: { ownerId: id } },
  //     { $group: {
  //       _id: ownerId,
  //      total: { $sum: "$weight" }
  //     }}
  //   ]);
  //   cursor.get(function(err, data) {
  //     console.log(data);
  //     if (err) return callback(err);
  //     return callback(err, data);
  //   })
  // });

  // var bookCollection =Bottle.app.dataSources.db.connector.collection('bottle');
  // bookCollection.aggregate({
  //   $group: {
  //     _id: { weight: "$weight"},
  //     total: { $sum: 1 }
  //   }
  // }, function(err, groupByRecords) {
  //   if(err) {
  //     next(err);
  //   } else {
  //     next();
  //   }
  // });


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
    console.log(filter);
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
          $project: {
            _id: 0,
            date: "$_id",
            count: "$total",
          }
        }
      ]);
      cursor.get(function (err, data) {
        console.log(data);
        if (err) return callback(err);
        return callback(null, data);
      })
    });
  }


  function getSecondReport(filter, country, callback) {
    console.log(filter);
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
          $project: {
            _id: 0,
            date: "$_id",
            count: "$total",
          }
        }
      ]);
      cursor.get(function (err, data) {
        console.log(data);
        if (err) return callback(err);
        return callback(null, data);
      })
    });
  }




  function getThierdReport(filter, country, callback) {
    if (country) {
      filter['ISOCode'] = country
    }
    console.log(filter);
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
            }
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
        console.log(data);
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

};
