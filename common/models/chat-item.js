'use strict';
const errors = require('../../server/errors');
const mongoXlsx = require('mongo-xlsx');
const configPath = process.env.NODE_ENV === undefined ?
  '../../server/config.json' :
  `../../server/config.${process.env.NODE_ENV}.json`;
const config = require(configPath);
var ObjectId = require('mongodb').ObjectID;


module.exports = function (ChatItem) {

  var urlFileRoot = config.domain + config.restApiRoot + "/uploadFiles";
  urlFileRoot = "http://localhost:3000" + config.restApiRoot + "/uploadFiles";

  var urlFileRootexcel = urlFileRoot + '/excelFiles/download/';



  ChatItem.beforeRemote('create', function (context, item, next) {
    ChatItem.app.models.User.findById(context.req.accessToken.userId, function (err, user) {
      if (err)
        return next(err, null);
      if (user.status != 'active') {
        return next(errors.account.notActive());
      }
      ChatItem.app.models.chatProduct.findById(context.req.body.chatProductId, function (err, chatProduct) {
        if (err) {
          return next(err);
        }
        if (chatProduct == null) {
          return next(errors.product.productNotFound());
        }
        if (user.pocketCoins - chatProduct.price < 0) {
          return next(errors.product.youDonotHaveCoins());
        }
        chatProduct.productSold++;
        chatProduct.save();
        if (context.req.body.ownerId == null && context.req.accessToken != null)
          context.req.body.ownerId = context.req.accessToken.userId;
        context.req.body.price = chatProduct.price;
        next();
      })
    })
  })

  ChatItem.afterRemote('create', function (context, item, next) {
    ChatItem.app.models.chatProduct.findById(context.req.body.chatProductId, function (err, chatProduct) {
      if (err) {
        return next(err);
      }
      ChatItem.app.models.User.findById(context.req.body.ownerId).then(user => {
        let paid = user.totalPaidCoins + chatProduct.price;
        let pocketCoins = user.pocketCoins - chatProduct.price;
        user.updateAttributes({
          "totalPaidCoins": paid,
          "pocketCoins": pocketCoins
        }, function (err, data) {
          return next()
        })
      }).catch(err => next(err));
    })
  });

  function getFilter(filter, callback) {
    var ISOCode = ""
    var goodId = ""
    var index
    var username = ""
    if (filter != null)
      index = filter['where']['and'].length - 1;
    else
      index = -1

    while (index >= 0) {
      if (filter['where']['and'][index]['owner.ISOCode'] != null) {
        ISOCode = filter['where']['and'][index]['owner.ISOCode'];
        filter['where']['and'].splice(index, 1)
      } else if (filter['where']['and'][index]['product.typeGoodsId'] != null) {
        goodId = filter['where']['and'][index]['product.typeGoodsId'];
        filter['where']['and'].splice(index, 1)
      } else if (filter['where']['and'][index]['owner.username'] != null) {
        username = filter['where']['and'][index]['owner.username'];
        filter['where']['and'].splice(index, 1)
      }


      index -= 1;
    }

    if (filter == null || filter['where']['and'][0] == null)
      filter = {}
    // console.log("filter.where.and");
    // console.log(filter.where.and);
    ChatItem.find(
      filter,
      function (err, items) {
        if (err)
          callback(err, null);
        console.log("items")
        console.log(items.length)
        // console.log(items)
        var result = [];
        if (items && items.length != 0) {
          items.forEach(function (element, index) {
            element.owner(function (err, owner) {
              // element.product(function (err, product) {
              // console.log(goodId);
              if (((ISOCode == "" || owner.ISOCode == ISOCode)) && (username == "" || owner.username.includes(username))) {
                result.push(element);
              }
              if (index + 1 == items.length) {
                console.log("resuuuuuuuult");
                callback(null, result);
              }
              // })
            })
          }, this);
        } else {
          callback(null, [])
        }
      })
  }

  ChatItem.getFilterItem = function (filter, callback) {
    var offset = filter['offset'];
    var limit = filter['limit'];
    if (offset == null)
      offset = 0;
    if (limit == null)
      limit = 10;
    // console.log(filter.where.and)
    delete filter['offset']
    delete filter['limit']

    getFilter(filter, function (err, data) {
      if (err)
        callback(err, null);
      var newData = data.slice(offset, offset + limit);
      console.log("newData")
      console.log(newData)
      callback(err, newData);
    })

  }



  // /**
  //  *
  //  * @param {object} filter filter item
  //  * @param {Function(Error, object)} callback
  //  */

  ChatItem.countFilter = function (filter, callback) {
    getFilter(filter, function (err, data) {
      if (err)
        callback(err, null);
      callback(err, {
        "count": data.length
      });
    })
  };



  // /**
  //  *
  //  * @param {Function(Error, array)} callback
  //  */

  // Item.itemStateReport = function (from, to, callback) {
  //   var result;
  //   var filter = {};
  //   if (from) {
  //     filter['startAt'] = {
  //       '$gt': new Date(from)
  //     }
  //   }
  //   if (to) {
  //     if (filter['startAt'] == null)
  //       filter['startAt'] = {}
  //     filter['startAt']['$lt'] = new Date(to)
  //   }
  //   Item.getDataSource().connector.connect(function (err, db) {

  //     var collection = db.collection('item');
  //     var cursor = collection.aggregate([{
  //         $match: filter
  //       }, {
  //         $lookup: {
  //           from: "user",
  //           localField: "ownerId",
  //           foreignField: "_id",
  //           as: "owner"
  //         }
  //       },
  //       {
  //         $group: {
  //           _id: '$owner.country.name',
  //           count: {
  //             $sum: 1
  //           },
  //           totalRevenue: {
  //             $sum: "$price"
  //           }
  //         }
  //       },
  //       {
  //         $project: {
  //           _id: 0,
  //           country: {
  //             $arrayElemAt: ["$_id", 0]
  //           },
  //           count: 1,
  //           totalRevenue: 1,

  //         }
  //       }
  //     ]);
  //     cursor.get(function (err, data) {
  //       // console.log(data);
  //       if (err) return callback(err);
  //       return callback(null, data);
  //     })
  //   });
  //   // TODO
  //   // callback(null, result);
  // };


  ChatItem.export = function (filter = {}, callback) {

    var temFilter = {
      "where": {}
    }

    var andInFilter = []

    if (filter.relatedUserId != null)
      andInFilter.push({
        "relatedUserId": ObjectId(filter.relatedUserId)
      })

    if (filter.userId != null)
      andInFilter.push({
        "ownerId": ObjectId(filter.userId)
      })

    if (filter.from != null && filter.from != "")
      andInFilter.push({
        "createdAt": {
          "gt": new Date(filter.from)
        }
      })

    if (filter.to != null && filter.to != "")
      andInFilter.push({
        "createdAt": {
          "lt": new Date(filter.from)
        }
      })


    if (andInFilter.length > 0)
      temFilter['where']['and'] = andInFilter


    var config = {
      path: 'uploadFiles/excelFiles',
      save: true,
      fileName: 'item' + Date.now() + '.xlsx'
    };

    var data = [];
    console.log(JSON.stringify(temFilter))
    ChatItem.find(temFilter, function (err, items) {
      items.forEach(function (element) {
        var object = {};
        var secObject = {};
        var thierdObject = {};
        var ownerObject
        var relatedUserObject
        var productObject;
        element.owner(function (err, owner) {
          var countryNaem
          owner.country(function (err, country) {
            countryNaem = country.name
          })
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
              createdAt: owner['createdAt'].toString(),
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
              createdAt: owner['createdAt'].toString(),
              email: owner['email'],
              status: owner['status'],
              typeLogIn: owner['typeLogIn'],
              username: owner['username']
            }

        })
        element.chatProduct(function (err, product) {
          productObject = {
            name_ar: product['name_ar'],
            name_en: product['name_en'],
            price: product['price'],
            description: product['description'],
            icon: product['icon'],
            androidProduct: product['androidProduct'],
            appleProduct: product['appleProduct'],
          }
        })
        var objectItem = {
          isConsumed: element['isConsumed'],
          createdAt: element['createdAt'].toString(),
          mainPrice: element['price'],
        }
        // }

        element.relatedUser(function (err, relatedUser) {
          var countryNaem = ""
          if (relatedUser) {
            relatedUser.country(function (err, country) {
              countryNaem = country.name
            })

            if (relatedUser['lastLogin'] != null)
              relatedUserObject = {
                countryRelatedUser: countryNaem,
                imageRelatedUser: relatedUser['image'],
                totalBottlesThrownRelatedUser: relatedUser['totalBottlesThrown'],
                repliesBottlesCountRelatedUser: relatedUser['repliesBottlesCount'],
                repliesReceivedCountRelatedUser: relatedUser['repliesReceivedCount'],
                foundBottlesCountRelatedUser: relatedUser['foundBottlesCount'],
                extraBottlesCountRelatedUser: relatedUser['extraBottlesCount'],
                bottlesCountRelatedUser: relatedUser['bottlesCount'],
                registrationCompletedRelatedUser: relatedUser['registrationCompleted'],
                genderRelatedUser: relatedUser['gender'],
                nextRefillRelatedUser: relatedUser['nextRefill'].toString(),
                createdAtRelatedUser: relatedUser['createdAt'].toString(),
                lastLoginRelatedUser: relatedUser['lastLogin'].toString(),
                emailRelatedUser: relatedUser['email'],
                statusRelatedUser: relatedUser['status'],
                typeLogInRelatedUser: relatedUser['typeLogIn'],
                relatedUser: relatedUser['username']
              }
            else
              relatedUserObject = {
                countryRelatedUser: countryNaem,
                imageRelatedUser: relatedUser['image'],
                totalBottlesThrownRelatedUser: relatedUser['totalBottlesThrown'],
                repliesBottlesCountRelatedUser: relatedUser['repliesBottlesCount'],
                repliesReceivedCountRelatedUser: relatedUser['repliesReceivedCount'],
                foundBottlesCountRelatedUser: relatedUser['foundBottlesCount'],
                extraBottlesCountRelatedUser: relatedUser['extraBottlesCount'],
                bottlesCountRelatedUser: relatedUser['bottlesCount'],
                registrationCompletedRelatedUser: relatedUser['registrationCompleted'],
                genderRelatedUser: relatedUser['gender'],
                nextRefillRelatedUser: relatedUser['nextRefill'].toString(),
                createdAtRelatedUser: relatedUser['createdAt'].toString(),
                emailRelatedUser: relatedUser['email'],
                statusRelatedUser: relatedUser['status'],
                typeLogInRelatedUser: relatedUser['typeLogIn'],
                relatedUser: relatedUser['username']
              }
          }
          console.log("relatedUser");
          console.log(relatedUser);
        })

        object = Object.assign({}, objectItem, productObject);
        secObject = Object.assign({}, object, ownerObject);
        thierdObject = Object.assign({}, secObject, relatedUserObject);
        data.push(thierdObject);

      }, this);
      var model = mongoXlsx.buildDynamicModel(data);


      /* Generate Excel */
      mongoXlsx.mongoData2Xlsx(data, model, config, function (err, data) {
        console.log('File saved at:', data.fullPath);
        callback(null, {
          'path': urlFileRootexcel + config['fileName']
        });

      });
    });

    // model[0].access = 'id';
    // mongoXlsx.mongoData2Xlsx(data, model, config, function (err, data) {
    //   console.log('File saved at:', path.join(__dirname, '../../', data.fullPath), data.fullPath);
    //   return res.sendFile(path.join(__dirname, '../../', data.fullPath))
    // });

    // TODO
  };

  ChatItem.chatExtendReportOwner = function (filter, callback) {
    var ownerMatch = {};

    if (filter && filter.from) {
      ownerMatch['createdAt'] = {
        '$gt': new Date(filter.from)
      }
    }

    if (filter && filter.to) {
      if (ownerMatch['createdAt'] == null)
        ownerMatch['createdAt'] = {}
      ownerMatch['createdAt']['$lt'] = new Date(filter.to)
    }

    if (filter && filter.userId) {
      ownerMatch['ownerId'] = ObjectId(filter.userId)
    }

    console.log(ownerMatch)

    ChatItem.getDataSource().connector.connect(function (err, db) {

      var collection = db.collection('chatItem');
      var cursor = collection.aggregate([{
          $match: ownerMatch
        },
        {
          $group: {
            "_id": {
              "ownerId": "$ownerId",
              "chatProductId": "$chatProductId"
            },
            count: {
              $sum: 1
            },
            cost: {
              $sum: "$price"
            },
          }
        },
        {
          $lookup: {
            from: "user",
            localField: "_id.ownerId",
            foreignField: "_id",
            as: "owner"
          }
        },
        {
          $unwind: "$owner"
        },
        {
          "$addFields": {
            "owner.id": {
              $convert: {
                input: "$owner._id",
                to: "string"
              }
            }
          }
        },


        {
          $lookup: {
            from: "chatProduct",
            localField: "_id.chatProductId",
            foreignField: "_id",
            as: "chatProduct"
          }
        },
        {
          $unwind: "$chatProduct"
        },
        {
          "$addFields": {
            "chatProduct.id": {
              $convert: {
                input: "$chatProduct._id",
                to: "string"
              }
            }
          }
        },
        {
          "$addFields": {
            "chatProduct.count": {
              $convert: {
                input: "$count",
                to: "string"
              }
            }
          }
        },
        {
          "$addFields": {
            "chatProduct.cost": {
              $convert: {
                input: "$cost",
                to: "string"
              }
            }
          }
        },

        {
          $project: {
            count: 1,
            cost: 1,
            chatProduct: 1,
            _id: 1
          }
        },
        {
          $group: {
            "_id": {
              "ownerId": "$_id.ownerId",
            },
            chatProducts: {
              $addToSet: "$chatProduct"
            },
            totalCount: {
              $sum: "$count"
            },
            totalCost: {
              $sum: "$cost"
            }
          }
        },
        {
          $lookup: {
            from: "user",
            localField: "_id.ownerId",
            foreignField: "_id",
            as: "owner"
          }
        },
        {
          $unwind: "$owner"
        },
        {
          "$addFields": {
            "owner.id": {
              $convert: {
                input: "$owner._id",
                to: "string"
              }
            }
          }
        },
        {
          $project: {
            owner: 1,
            chatProducts: 1,
            totalCost: 1,
            totalCount: 1,
            _id: 0
          }
        },
      ]);
      cursor.get(function (err, ownerData) {
        if (err) return callback(err);

        return callback(null,
          ownerData
        );
      })
    })
  };
  ChatItem.chatExtendReportOwnerCount = function (filter, callback) {
    var ownerMatch = {};

    if (filter && filter.from) {
      ownerMatch['createdAt'] = {
        '$gt': new Date(filter.from)
      }
    }

    if (filter && filter.to) {
      if (ownerMatch['createdAt'] == null)
        ownerMatch['createdAt'] = {}
      ownerMatch['createdAt']['$lt'] = new Date(filter.to)
    }

    if (filter && filter.userId) {
      ownerMatch['ownerId'] = ObjectId(filter.userId)
    }

    console.log(ownerMatch)

    ChatItem.getDataSource().connector.connect(function (err, db) {

      var collection = db.collection('chatItem');
      var cursor = collection.aggregate([{
          $match: ownerMatch
        },
        {
          $group: {
            "_id": {
              "ownerId": "$ownerId",
              "chatProductId": "$chatProductId"
            },
            count: {
              $sum: 1
            },
            cost: {
              $sum: "$price"
            },
          }
        },
        {
          $lookup: {
            from: "user",
            localField: "_id.ownerId",
            foreignField: "_id",
            as: "owner"
          }
        },
        {
          $unwind: "$owner"
        },
        {
          "$addFields": {
            "owner.id": {
              $convert: {
                input: "$owner._id",
                to: "string"
              }
            }
          }
        },


        {
          $lookup: {
            from: "chatProduct",
            localField: "_id.chatProductId",
            foreignField: "_id",
            as: "chatProduct"
          }
        },
        {
          $unwind: "$chatProduct"
        },
        {
          "$addFields": {
            "chatProduct.id": {
              $convert: {
                input: "$chatProduct._id",
                to: "string"
              }
            }
          }
        },
        {
          "$addFields": {
            "chatProduct.count": {
              $convert: {
                input: "$count",
                to: "string"
              }
            }
          }
        },
        {
          "$addFields": {
            "chatProduct.cost": {
              $convert: {
                input: "$cost",
                to: "string"
              }
            }
          }
        },

        {
          $project: {
            count: 1,
            cost: 1,
            chatProduct: 1,
            _id: 1
          }
        },
        {
          $group: {
            "_id": {
              "ownerId": "$_id.ownerId",
            },
            chatProducts: {
              $addToSet: "$chatProduct"
            },
            totalCount: {
              $sum: "$count"
            },
            totalCost: {
              $sum: "$cost"
            }
          }
        },
        {
          $lookup: {
            from: "user",
            localField: "_id.ownerId",
            foreignField: "_id",
            as: "owner"
          }
        },
        {
          $unwind: "$owner"
        },
        {
          "$addFields": {
            "owner.id": {
              $convert: {
                input: "$owner._id",
                to: "string"
              }
            }
          }
        },
        {
          $project: {
            owner: 1,
            chatProducts: 1,
            totalCost: 1,
            totalCount: 1,
            _id: 0
          }
        },
      ]);
      cursor.get(function (err, ownerData) {
        if (err) return callback(err);

        return callback(null, {
          "count": ownerData.length
        });
      })
    })
  };

  ChatItem.getUserRelated = function (userId, isOwner, callback) {
    var where = {}
    if (isOwner == true) {
      where = {
        "ownerId": userId
      }
    } else {
      where = {
        "relatedUserId": userId
      }
    }

    ChatItem.find({
      "where": where
    }, function (err, items) {
      if (err)
        return callback(err)
      return callback(null, items)
    })
  }
  ChatItem.chatExtendReportRelated = function (filter, callback) {
    var relatedUserMatch = {};

    if (filter && filter.from) {
      relatedUserMatch['createdAt'] = {
        '$gt': new Date(filter.from)
      }
    }

    if (filter && filter.to) {
      if (relatedUserMatch['createdAt'] == null)
        relatedUserMatch['createdAt'] = {}
      relatedUserMatch['createdAt']['$lt'] = new Date(filter.to)
    }


    if (filter && filter.userId) {
      relatedUserMatch['relatedUserId'] = ObjectId(filter.userId)
    }

    // return callback(null, relatedUserMatch)
    ChatItem.getDataSource().connector.connect(function (err, db) {

      var collection = db.collection('chatItem');

      var cursor = collection.aggregate([{
          $match: relatedUserMatch
        }, {
          $group: {
            "_id": {
              "relatedUserId": "$relatedUserId",
              "chatProductId": "$chatProductId"
            },
            count: {
              $sum: 1
            },
            cost: {
              $sum: "$price"
            },
          }
        },
        {
          $lookup: {
            from: "user",
            localField: "_id.relatedUserId",
            foreignField: "_id",
            as: "relatedUser"
          }
        },
        {
          $unwind: "$relatedUser"
        },
        {
          "$addFields": {
            "relatedUser.id": {
              $convert: {
                input: "$relatedUser._id",
                to: "string"
              }
            }
          }
        },
        {
          $lookup: {
            from: "chatProduct",
            localField: "_id.chatProductId",
            foreignField: "_id",
            as: "chatProduct"
          }
        },
        {
          $unwind: "$chatProduct"
        },
        {
          "$addFields": {
            "chatProduct.id": {
              $convert: {
                input: "$chatProduct._id",
                to: "string"
              }
            }
          }
        },
        {
          "$addFields": {
            "chatProduct.count": {
              $convert: {
                input: "$count",
                to: "string"
              }
            }
          }
        },
        {
          "$addFields": {
            "chatProduct.cost": {
              $convert: {
                input: "$cost",
                to: "string"
              }
            }
          }
        },
        {
          $project: {
            count: 1,
            cost: 1,
            chatProduct: 1,
            _id: 1
          }
        },
        {
          $group: {
            "_id": {
              "relatedUserId": "$_id.relatedUserId",
            },
            chatProducts: {
              $addToSet: "$chatProduct"
            },
            totalCount: {
              $sum: "$count"
            },
            totalCost: {
              $sum: "$cost"
            }
          }
        },
        {
          $lookup: {
            from: "user",
            localField: "_id.relatedUserId",
            foreignField: "_id",
            as: "relatedUser"
          }
        },
        {
          $unwind: "$relatedUser"
        },
        {
          "$addFields": {
            "relatedUser.id": {
              $convert: {
                input: "$relatedUser._id",
                to: "string"
              }
            }
          }
        },
        {
          $project: {
            relatedUser: 1,
            chatProducts: 1,
            totalCost: 1,
            totalCount: 1,
            _id: 0
          }
        }
      ]);


      cursor.get(function (err, relatedUserData) {
        if (err) return callback(err);
        return callback(null,
          relatedUserData
        );
      })
    })
  };

  ChatItem.chatExtendReportRelatedCount = function (filter, callback) {
    var relatedUserMatch = {};

    if (filter && filter.from) {
      relatedUserMatch['createdAt'] = {
        '$gt': new Date(filter.from)
      }
    }

    if (filter && filter.to) {
      if (relatedUserMatch['createdAt'] == null)
        relatedUserMatch['createdAt'] = {}
      relatedUserMatch['createdAt']['$lt'] = new Date(filter.to)
    }


    if (filter && filter.userId) {
      relatedUserMatch['relatedUserId'] = ObjectId(filter.userId)
    }

    ChatItem.getDataSource().connector.connect(function (err, db) {

      var collection = db.collection('chatItem');

      var cursor = collection.aggregate([{
          $match: relatedUserMatch
        },
        {
          $group: {
            "_id": {
              "relatedUserId": "$relatedUserId",
              "chatProductId": "$chatProductId"
            },
            count: {
              $sum: 1
            },
            cost: {
              $sum: "$price"
            },
          }
        },
        {
          $lookup: {
            from: "user",
            localField: "_id.relatedUserId",
            foreignField: "_id",
            as: "relatedUser"
          }
        },
        {
          $unwind: "$relatedUser"
        },
        {
          "$addFields": {
            "relatedUser.id": {
              $convert: {
                input: "$relatedUser._id",
                to: "string"
              }
            }
          }
        },
        {
          $lookup: {
            from: "chatProduct",
            localField: "_id.chatProductId",
            foreignField: "_id",
            as: "chatProduct"
          }
        },
        {
          $unwind: "$chatProduct"
        },
        {
          "$addFields": {
            "chatProduct.id": {
              $convert: {
                input: "$chatProduct._id",
                to: "string"
              }
            }
          }
        },
        {
          "$addFields": {
            "chatProduct.count": {
              $convert: {
                input: "$count",
                to: "string"
              }
            }
          }
        },
        {
          "$addFields": {
            "chatProduct.cost": {
              $convert: {
                input: "$cost",
                to: "string"
              }
            }
          }
        },
        {
          $project: {
            count: 1,
            cost: 1,
            chatProduct: 1,
            _id: 1
          }
        },
        {
          $group: {
            "_id": {
              "relatedUserId": "$_id.relatedUserId",
            },
            chatProducts: {
              $addToSet: "$chatProduct"
            },
            totalCount: {
              $sum: "$count"
            },
            totalCost: {
              $sum: "$cost"
            }
          }
        },
        {
          $lookup: {
            from: "user",
            localField: "_id.relatedUserId",
            foreignField: "_id",
            as: "relatedUser"
          }
        },
        {
          $unwind: "$relatedUser"
        },
        {
          "$addFields": {
            "relatedUser.id": {
              $convert: {
                input: "$relatedUser._id",
                to: "string"
              }
            }
          }
        },
        {
          $project: {
            relatedUser: 1,
            chatProducts: 1,
            totalCost: 1,
            totalCount: 1,
            _id: 0
          }
        },
      ]);


      cursor.get(function (err, relatedUserData) {
        if (err) return callback(err);
        return callback(null, {
          "count": relatedUserData.length
        });
      })
    })
  };

};
