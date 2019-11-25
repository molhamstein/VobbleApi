'use strict';
const errors = require('../../server/errors');
const mongoXlsx = require('mongo-xlsx');
const configPath = process.env.NODE_ENV === undefined ?
  '../../server/config.json' :
  `../../server/config.${process.env.NODE_ENV}.json`;
const config = require(configPath);
var ObjectId = require('mongodb').ObjectID;


var appleReceiptVerify = require('node-apple-receipt-verify');
appleReceiptVerify.config({
  secret: "8622c3ec270a4f3eb4ec599daa8d5720",
  environment: ['sandbox', 'production'],
  verbose: true
});


module.exports = function (Item) {

  var urlFileRoot = config.domain + config.restApiRoot + "/uploadFiles";

  var urlFileRootexcel = urlFileRoot + '/excelFiles/download/';


  // Item.validatesInclusionOf('storeType', {
  //   in: ['playStore', 'iTunes',]
  // });

  Item.beforeRemote('create', function (context, item, next) {
    if (context.req.body.receipt == undefined || context.req.body.transactionId == undefined) {
      // Item.app.models.Product.findById(context.req.body.productId, function (err, product) {
      //   if (err) {
      //     return next(err);
      //   }

      //   if (product == null) {
      //     return next(errors.product.productNotFound());
      //   }
      //   Item.app.models.User.findById(context.req.accessToken.userId, function (err, user) {
      //     if (err)
      //       return next(err, null);
      //     if (user.status != 'active') {
      return next(errors.product.unvalidReceipt());
      //     }

      //     product.productSold++;
      //     product.save();
      //     if (context.req.body.ownerId == null && context.req.accessToken != null)
      //       context.req.body.ownerId = context.req.accessToken.userId;


      //     context.req.body.type = product.type;
      //     context.req.body.price = product.price;
      //     console.log("context.req.body");
      //     console.log(context.req.body);

      //     next();
      //   })
      // })
    } else {
      Item.app.models.User.findById(context.req.accessToken.userId, function (err, user) {
        if (err)
          return next(err, null);
        if (user.status != 'active') {
          return next(errors.product.unvalidReceipt());
        }
        console.log("receipt")
        console.log(context.req.body.receipt)
        console.log("context.req.body.transactionId")
        console.log(context.req.body.transactionId)
        Item.find({
          "where": {
            "and": [{
              "transactionId": context.req.body.transactionId
            }]
          }
        }, function (err, oldItem) {
          if (oldItem.length > 0)
            return next(errors.product.unvalidReceipt());
          appleReceiptVerify.validate({
            receipt: context.req.body.receipt
          }, function (err, products) {
            if (err) {
              console.log("err")
              console.log(err)
              return next(errors.product.unvalidReceipt());
            } else {
              var transactionId = context.req.body.transactionId;
              // delete context.req.body.receipt;
              if (products.length == 0)
                return next(errors.product.unvalidReceipt());
              var isInProcess = false;
              for (let index = 0; index < products.length; index++) {
                const element = products[index];
                if (element.transactionId == transactionId) {
                  isInProcess = true;
                  Item.app.models.Product.findById(context.req.body.productId, function (err, product) {
                    if (err) {
                      return next(err);
                    }
                    product.productSold++;
                    product.save();
                    if (context.req.body.ownerId == null && context.req.accessToken != null)
                      context.req.body.ownerId = context.req.accessToken.userId;
                    if (product == null) {
                      return next(errors.product.productNotFound());
                    }
                    context.req.body.type = product.type;
                    context.req.body.price = product.price;
                    next();
                  })
                } else if (index == products.length - 1 && isInProcess == false) {
                  console.log("transactionId not found")
                  return next(errors.product.unvalidReceipt());
                }
              }
            }
            // ok!
          });
        })
      })
    }
  });


  Item.afterRemote('create', function (context, item, next) {
    Item.app.models.Product.findById(context.req.body.productId, function (err, product) {
      if (err) {
        return next(err);
      }
      Item.app.models.User.findById(context.req.body.ownerId).then(user => {
        let paid = user.totalPaid + product.price;
        user.updateAttributes({
          "totalPaid": paid
        }, function (err, data) {
          if (product.coinsCount > 0) {
            user.pocketCoins += product.coinsCount;
            user.save();
            next();
          } else if (product.bottleCount > 0) {
            user.extraBottlesCount += product.bottleCount;
            user.save();
            next();

          } else if (product.replyCount > 0) {
            user.extraReplysCount += product.replyCount;
            user.save();
            next();
          } else {
            var date = new Date().getTime();
            date += (product.validity * 60 * 60 * 1000);
            item.endAt = new Date(date);
            item.save();
            next();
          }
        }).catch(err => next(err));

      })
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
    Item.find(
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
              element.product(function (err, product) {
                // console.log(goodId);
                if (((ISOCode == "" || owner.ISOCode == ISOCode) && (goodId == "" || product.typeGoodsId == goodId)) && (username == "" || owner.username.includes(username))) {
                  result.push(element);
                }

                if (index + 1 == items.length) {
                  console.log("resuuuuuuuult");
                  callback(null, result);
                }
              })
            })
          }, this);
        } else {
          callback(null, [])
        }
      })
  }


  Item.getFilterItem = function (filter, callback) {
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



  /**
   *
   * @param {object} filter filter item
   * @param {Function(Error, object)} callback
   */

  Item.countFilter = function (filter, callback) {
    getFilter(filter, function (err, data) {
      if (err)
        callback(err, null);
      callback(err, {
        "count": data.length
      });
    })
  };


  Item.buyProductByCoins = function (productId, relatedUserId, context, callback) {
    var body = {
      "productId": productId,
      "ownerId": context.req.accessToken.userId,
      "typePurchasing": "coins"
    }
    if (relatedUserId) {
      body['relatedUserId'] = relatedUserId
    }
    Item.app.models.User.findById(context.req.accessToken.userId, function (err, user) {
      if (err)
        return callback(err, null);
      if (user.status != 'active') {
        return callback(errors.account.notActive());
      }
      Item.app.models.product.findById(productId, function (err, product) {
        if (err) {
          return callback(err);
        }
        if (product == null) {
          return callback(errors.product.productNotFound());
        }
        if (user.pocketCoins - product.price_coins < 0) {
          return callback(errors.product.youDonotHaveCoins());
        }
        product.productSold++;
        body['type'] = product.type;
        body['price'] = product.price_coins
        Item.create(body, function (err, item) {
          if (err)
            return callback(err, null)
          product.save();
          if (product.bottleCount > 0) {
            user.extraBottlesCount += product.bottleCount;
            user.pocketCoins -= product.price_coins;
            user.totalPaidCoins += product.price_coins;
            user.save();
            callback(null, item)
          } else if (product.replyCount > 0) {
            user.extraReplysCount += 99999999999;
            user.unlimitedReplysOpenDate = addHours(new Date(), 12)
            user.pocketCoins -= product.price_coins;
            user.totalPaidCoins += product.price_coins;
            user.save();
            callback(null, item);
          } else {
            var date = new Date().getTime();
            date += (product.validity * 60 * 60 * 1000);
            item.endAt = new Date(date);
            item.save();
            user.pocketCoins -= product.price_coins;
            user.totalPaidCoins += product.price_coins;
            user.save();
            callback(null, item)
          }
        })
      })
    })
  }

  /**
   *
   * @param {Function(Error, array)} callback
   */

  Item.itemStateReport = function (from, to, callback) {
    var result;
    var filter = {};
    if (from) {
      filter['startAt'] = {
        '$gt': new Date(from)
      }
    }
    if (to) {
      if (filter['startAt'] == null)
        filter['startAt'] = {}
      filter['startAt']['$lt'] = new Date(to)
    }
    Item.getDataSource().connector.connect(function (err, db) {

      var collection = db.collection('item');
      var cursor = collection.aggregate([{
          $match: filter
        }, {
          $lookup: {
            from: "user",
            localField: "ownerId",
            foreignField: "_id",
            as: "owner"
          }
        },
        {
          $group: {
            _id: '$owner.country.name',
            count: {
              $sum: 1
            },
            totalRevenue: {
              $sum: "$price"
            }
          }
        },
        {
          $project: {
            _id: 0,
            country: {
              $arrayElemAt: ["$_id", 0]
            },
            count: 1,
            totalRevenue: 1,

          }
        }
      ]);
      cursor.get(function (err, data) {
        // console.log(data);
        if (err) return callback(err);
        return callback(null, data);
      })
    });
    // TODO
    // callback(null, result);
  };


  Item.export = function (filter, callback) {

    var ISOCode = ""
    var goodId = ""
    var username = ""
    var index
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
    var config = {
      path: 'uploadFiles/excelFiles',
      save: true,
      fileName: 'item' + Date.now() + '.xlsx'
    };

    var data = [];
    Item.find(filter, function (err, items) {
      items.forEach(function (element) {
        var object = {};
        var secObject = {};
        var thierdObject = {};
        var ownerObject
        var relatedUserObject
        var productObject;
        element.owner(function (err, owner) {
          var countryNaem
          if (owner) {
            owner.country(function (err, country) {
              countryNaem = country.name
            })
            if ((ISOCode == "" || owner.ISOCode == ISOCode) && (username == "" || owner.username.includes(username))) {
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
            }
          }
        })
        element.product(function (err, product) {
          if (goodId == "" || product.typeGoodsId == goodId)
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

        if (element['endAt'] != null)
          var objectItem = {
            storeType: element['storeType'],
            storeToken: element['storeToken'],
            isConsumed: element['isConsumed'],
            valid: element['valid'],
            startAt: element['startAt'].toString(),
            endAt: element['endAt'].toString(),
            mainPrice: element['price'],
          }
        else {
          var objectItem = {
            storeType: element['storeType'],
            storeToken: element['storeToken'],
            isConsumed: element['isConsumed'],
            valid: element['valid'],
            startAt: element['startAt'].toString(),
            mainPrice: element['price'],
          }
        }

        console.log("productObject")
        console.log(productObject)

        if (ownerObject != undefined && productObject != undefined) {
          if (element.type == "Chat Extend") {
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
                console.log("relatedUser");
                console.log(relatedUser);
              }
            })
          }
          object = Object.assign({}, objectItem, productObject);
          secObject = Object.assign({}, object, ownerObject);
          thierdObject = Object.assign({}, secObject, relatedUserObject);
          data.push(thierdObject);
        }
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


  Item.chatExtendReportOwner = function (filter, callback) {
    var ownerMatch = {
      type: "Chat Extend",

    };

    if (filter && filter.from) {
      ownerMatch['startAt'] = {
        '$gt': new Date(filter.from)
      }
    }

    if (filter && filter.to) {
      if (ownerMatch['startAt'] == null)
        ownerMatch['startAt'] = {}
      ownerMatch['startAt']['$lt'] = new Date(filter.to)
    }

    if (filter && filter.userId) {
      ownerMatch['ownerId'] = ObjectId(filter.userId)
    }

    console.log(ownerMatch)

    Item.getDataSource().connector.connect(function (err, db) {

      var collection = db.collection('item');
      var cursor = collection.aggregate([{
          $match: ownerMatch
        },
        {
          $group: {
            "_id": {
              "ownerId": "$ownerId",
              "productId": "$productId"
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
            "owner.id": "$owner._id"
          }
        },


        {
          $lookup: {
            from: "product",
            localField: "_id.productId",
            foreignField: "_id",
            as: "product"
          }
        },
        {
          $unwind: "$product"
        },
        {
          "$addFields": {
            "product.id": "$product._id"
          }
        },
        {
          "$addFields": {
            "product.count": "$count"
          }
        },
        {
          "$addFields": {
            "product.cost": "$cost"
          }
        },

        {
          $project: {
            count: 1,
            cost: 1,
            product: 1,
            _id: 1
          }
        },
        {
          $group: {
            "_id": {
              "ownerId": "$_id.ownerId",
            },
            products: {
              $addToSet: "$product"
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
            "owner.id": "$owner._id"
          }
        },
        {
          $project: {
            owner: 1,
            products: 1,
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


  Item.chatExtendReportOwnerCount = function (filter, callback) {
    var ownerMatch = {
      type: "Chat Extend",

    };

    if (filter && filter.from) {
      ownerMatch['startAt'] = {
        '$gt': new Date(filter.from)
      }
    }

    if (filter && filter.to) {
      if (ownerMatch['startAt'] == null)
        ownerMatch['startAt'] = {}
      ownerMatch['startAt']['$lt'] = new Date(filter.to)
    }

    if (filter && filter.userId) {
      ownerMatch['ownerId'] = ObjectId(filter.userId)
    }

    console.log(ownerMatch)

    Item.getDataSource().connector.connect(function (err, db) {

      var collection = db.collection('item');
      var cursor = collection.aggregate([{
          $match: ownerMatch
        },
        {
          $group: {
            "_id": {
              "ownerId": "$ownerId",
              "productId": "$productId"
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
            "owner.id": "$owner._id"
          }
        },


        {
          $lookup: {
            from: "product",
            localField: "_id.productId",
            foreignField: "_id",
            as: "product"
          }
        },
        {
          $unwind: "$product"
        },
        {
          "$addFields": {
            "product.id": "$product._id"
          }
        },
        {
          "$addFields": {
            "product.count": "$count"
          }
        },
        {
          "$addFields": {
            "product.cost": "$cost"
          }
        },

        {
          $project: {
            count: 1,
            cost: 1,
            product: 1,
            _id: 1
          }
        },
        {
          $group: {
            "_id": {
              "ownerId": "$_id.ownerId",
            },
            products: {
              $addToSet: "$product"
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
            "owner.id": "$owner._id"
          }
        },
        {
          $project: {
            owner: 1,
            products: 1,
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


  Item.getUserRelated = function (userId, isOwner, callback) {
    var where = {}
    if (isOwner == true) {
      where = {
        "ownerId": userId,
        "type": "Chat Extend"
      }
    } else {
      where = {
        "relatedUserId": userId,
        "type": "Chat Extend"
      }
    }

    Item.find({
      "where": where
    }, function (err, items) {
      if (err)
        return callback(err)
      return callback(null, items)
    })
  }


  Item.chatExtendReportRelated = function (filter, callback) {
    var relatedUserMatch = {
      type: "Chat Extend",

    };

    if (filter && filter.from) {
      relatedUserMatch['startAt'] = {
        '$gt': new Date(filter.from)
      }
    }

    if (filter && filter.to) {
      if (relatedUserMatch['startAt'] == null)
        relatedUserMatch['startAt'] = {}
      relatedUserMatch['startAt']['$lt'] = new Date(filter.to)
    }


    if (filter && filter.userId) {
      relatedUserMatch['relatedUserId'] = ObjectId(filter.userId)
    }

    Item.getDataSource().connector.connect(function (err, db) {

      var collection = db.collection('item');

      var cursor = collection.aggregate([{
          $match: relatedUserMatch
        },
        {
          $group: {
            "_id": {
              "relatedUserId": "$relatedUserId",
              "productId": "$productId"
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
            "relatedUser.id": "$relatedUser._id"
          }
        },
        {
          $lookup: {
            from: "product",
            localField: "_id.productId",
            foreignField: "_id",
            as: "product"
          }
        },
        {
          $unwind: "$product"
        },
        {
          "$addFields": {
            "product.id": "$product._id"
          }
        },
        {
          "$addFields": {
            "product.count": "$count"
          }
        },
        {
          "$addFields": {
            "product.cost": "$cost"
          }
        },
        {
          $project: {
            count: 1,
            cost: 1,
            product: 1,
            _id: 1
          }
        },
        {
          $group: {
            "_id": {
              "relatedUserId": "$_id.relatedUserId",
            },
            products: {
              $addToSet: "$product"
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
            "relatedUser.id": "$relatedUser._id"
          }
        },
        {
          $project: {
            relatedUser: 1,
            products: 1,
            totalCost: 1,
            totalCount: 1,
            _id: 0
          }
        },
      ]);


      cursor.get(function (err, relatedUserData) {
        if (err) return callback(err);
        return callback(null,
          relatedUserData
        );
      })
    })
  };


  Item.chatExtendReportRelatedCount = function (filter, callback) {
    var relatedUserMatch = {
      type: "Chat Extend",

    };

    if (filter && filter.from) {
      relatedUserMatch['startAt'] = {
        '$gt': new Date(filter.from)
      }
    }

    if (filter && filter.to) {
      if (relatedUserMatch['startAt'] == null)
        relatedUserMatch['startAt'] = {}
      relatedUserMatch['startAt']['$lt'] = new Date(filter.to)
    }


    if (filter && filter.userId) {
      relatedUserMatch['relatedUserId'] = ObjectId(filter.userId)
    }

    Item.getDataSource().connector.connect(function (err, db) {

      var collection = db.collection('item');

      var cursor = collection.aggregate([{
          $match: relatedUserMatch
        },
        {
          $group: {
            "_id": {
              "relatedUserId": "$relatedUserId",
              "productId": "$productId"
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
            "relatedUser.id": "$relatedUser._id"
          }
        },
        {
          $lookup: {
            from: "product",
            localField: "_id.productId",
            foreignField: "_id",
            as: "product"
          }
        },
        {
          $unwind: "$product"
        },
        {
          "$addFields": {
            "product.id": "$product._id"
          }
        },
        {
          "$addFields": {
            "product.count": "$count"
          }
        },
        {
          "$addFields": {
            "product.cost": "$cost"
          }
        },
        {
          $project: {
            count: 1,
            cost: 1,
            product: 1,
            _id: 1
          }
        },
        {
          $group: {
            "_id": {
              "relatedUserId": "$_id.relatedUserId",
            },
            products: {
              $addToSet: "$product"
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
            "relatedUser.id": "$relatedUser._id"
          }
        },
        {
          $project: {
            relatedUser: 1,
            products: 1,
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




  /**
   *
   * @param {Function(Error)} callback
   */

  Item.solveData = function (callback) {
    Item.app.models.User.find({}, function (err, data) {
      if (err) {
        return callback(err)
      }
      data.forEach(element => {
        calcToUser(element);
        // console.log(element.id);
      });
    })
  };


  function calcToUser(user) {
    var totalPrice = 0;
    Item.find({
      "where": {
        "ownerId": user.id
      }
    }, function (err, data) {
      if (err)
        return
      if (data.length == 0)
        return

      for (let index = 0; index < data.length; index++) {
        const element = data[index];
        totalPrice += element.price;
        if (index == data.length - 1) {
          console.log(user.email)
          console.log(totalPrice);
          user.totalPaid = totalPrice;
          user.save();
        }
      }

    })
  }


  Item.getReportOfItem = function (match, callback) {
    Item.getDataSource().connector.connect(function (err, db) {

      var collection = db.collection('item');

      var cursor = collection.aggregate([{
          $match: match
        },
        {
          $group: {
            "_id": {
              month: {
                $month: "$startAt"
              },
              day: {
                $dayOfMonth: "$startAt"
              },
              year: {
                $year: "$startAt"
              },
              "productId": "$productId"
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
            from: "product",
            localField: "_id.productId",
            foreignField: "_id",
            as: "product"
          }
        },
        {
          $unwind: "$product"
        },
        {
          "$addFields": {
            "product.id": "$product._id"
          }


        },
        {
          $project: {
            count: 1,
            cost: 1,
            product: 1,
            groupe: "$_id",
            _id: 0
          }
        },
      ]);


      cursor.get(function (err, normalCoins) {
        if (err) return callback(err);
        return callback(null, normalCoins);
      })
    })
  }


  Item.getReportOfChatItem = function (match, callback) {
    Item.getDataSource().connector.connect(function (err, db) {

      var collection = db.collection('chatItem');

      var cursor = collection.aggregate([{
          $match: match
        },
        {
          $group: {
            "_id": {
              month: {
                $month: "$createdAt"
              },
              day: {
                $dayOfMonth: "$createdAt"
              },
              year: {
                $year: "$createdAt"
              },
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
            from: "chatProduct",
            localField: "_id.chatProductId",
            foreignField: "_id",
            as: "product"
          }
        },
        {
          $unwind: "$product"
        },
        {
          "$addFields": {
            "product.id": "$product._id"
          }
        },
        {
          $project: {
            count: 1,
            cost: 1,
            product: 1,
            groupe: "$_id",
            _id: 0
          }
        },
      ]);


      cursor.get(function (err, normalCoins) {
        if (err) return callback(err);
        return callback(null, normalCoins);
      })
    })
  }


  Item.exportReportOfAllItems = function (filter, callback) {
    var config = {
      path: 'uploadFiles/excelFiles',
      save: true,
      fileName: 'item' + Date.now() + '.xlsx'
    };

    Item.getReportOfAllItems(filter, function (err, data) {
      if (err)
        return (err);

      var itemsCount = []
      for (const key in data['coins']) {
        if (data['coins'].hasOwnProperty(key)) {
          const element = data['coins'][key];
          var object = {
            "date": key
          }
          if (element.product.length != {}) {
            for (const childKey in element['product']) {
              if (element['product'].hasOwnProperty(childKey)) {
                const childElement = element['product'][childKey];
                object[childElement.product.name_en] = childElement['count']
              }
            }
            itemsCount.push(object)
          }

        }
      }
      var modelItemsCount = mongoXlsx.buildDynamicModel(itemsCount);
      var dataItemsCount = mongoXlsx.mongoData2XlsxData(itemsCount, modelItemsCount)

      var coinsCount = []
      for (const key in data['dollar']) {
        if (data['dollar'].hasOwnProperty(key)) {
          const element = data['dollar'][key];
          var object = {
            "date": key
          }
          if (element.product.length != {}) {
            for (const childKey in element['product']) {
              if (element['product'].hasOwnProperty(childKey)) {
                const childElement = element['product'][childKey];
                object[childElement.product.name_en] = childElement['count']
              }
            }
            coinsCount.push(object)
          }

        }
      }
      var modelCoinsCount = mongoXlsx.buildDynamicModel(coinsCount);
      var dataCoinsCount = mongoXlsx.mongoData2XlsxData(coinsCount, modelCoinsCount)


      var itemsCost = []
      for (const key in data['coins']) {
        if (data['coins'].hasOwnProperty(key)) {
          const element = data['coins'][key];
          var object = {
            "date": key
          }
          if (element.product.length != {}) {
            for (const childKey in element['product']) {
              if (element['product'].hasOwnProperty(childKey)) {
                const childElement = element['product'][childKey];
                object[childElement.product.name_en] = childElement['cost']
              }
            }
            itemsCost.push(object)
          }

        }
      }
      var modelItemsCost = mongoXlsx.buildDynamicModel(itemsCost);
      var dataItemsCost = mongoXlsx.mongoData2XlsxData(itemsCost, modelItemsCost)

      var coinsCost = []
      for (const key in data['dollar']) {
        if (data['dollar'].hasOwnProperty(key)) {
          const element = data['dollar'][key];
          var object = {
            "date": key
          }
          if (element.product.length != {}) {
            for (const childKey in element['product']) {
              if (element['product'].hasOwnProperty(childKey)) {
                const childElement = element['product'][childKey];
                object[childElement.product.name_en] = childElement['cost']
              }
            }
            coinsCost.push(object)
          }
        }
      }
      var modelCoinsCost = mongoXlsx.buildDynamicModel(coinsCost);
      var dataCoinsCost = mongoXlsx.mongoData2XlsxData(coinsCost, modelCoinsCost)

      // callback(err, itemsCount)

      mongoXlsx.mongoData2XlsxMultiPage([dataItemsCount, dataCoinsCount, dataItemsCost, dataCoinsCost], ["Items Count", "Coins Count", "Items Cost", "Coins Cost"], config, function (err, data) {
        callback(null, {
          'path': urlFileRootexcel + config['fileName']
        });
      })

    })

  }


  Item.getReportOfAllItems = function (filter, callback) {
    let itemNormalMatch = {}
    let itemCoinslMatch = {}
    let itemChatlMatch = {}
    if (filter && filter.from) {
      itemNormalMatch['startAt'] = {
        '$gt': new Date(filter.from)
      }
      itemCoinslMatch['startAt'] = {
        '$gt': new Date(filter.from)
      }
      itemChatlMatch['createdAt'] = {
        '$gt': new Date(filter.from)
      }
    }
    if (filter && filter.to) {
      if (itemNormalMatch['startAt'] == null) {
        itemNormalMatch['startAt'] = {}
        itemCoinslMatch['startAt'] = {}
        itemChatlMatch['createdAt'] = {}
      }
      itemNormalMatch['startAt']['$lt'] = new Date(filter.to)
      itemCoinslMatch['startAt']['$lt'] = new Date(filter.to)
      itemChatlMatch['createdAt']['$lt'] = new Date(filter.to)
    }

    if (filter && filter.ownerId) {
      itemNormalMatch['ownerId'] = ObjectId(filter.ownerId)
      itemCoinslMatch['ownerId'] = ObjectId(filter.ownerId)
      itemChatlMatch['ownerId'] = ObjectId(filter.ownerId)
    }

    if (filter && filter.productsId && filter.productsId.length > 0) {
      let tempproductsId = []
      filter.productsId.forEach(element => {
        tempproductsId.push(ObjectId(element))
      });
      itemNormalMatch['productId'] = {
        "$in": tempproductsId
      }
      itemCoinslMatch['productId'] = {
        "$in": tempproductsId
      }
      itemChatlMatch['chatProductId'] = {
        "$in": tempproductsId
      }
    }
    itemNormalMatch['type'] = {
      $ne: "coins",
    }
    itemCoinslMatch['type'] = "coins";


    console.log("itemNormalMatch")
    console.log(itemNormalMatch)
    console.log("itemCoinslMatch")
    console.log(itemCoinslMatch)
    console.log("itemChatlMatch")
    console.log(itemChatlMatch)

    Item.getReportOfItem(itemNormalMatch, function (err, itemNormalData) {
      if (err)
        return callback(err)
      Item.getReportOfItem(itemCoinslMatch, function (err, itemCoinslData) {
        if (err)
          return callback(err)
        Item.getReportOfChatItem(itemChatlMatch, function (err, itemChatData) {
          if (err)
            return callback(err)
          // return callback(err, {
          //   "itemChatData": itemChatData,
          //   "itemCoinslData": itemCoinslData,
          //   "itemNormalData": itemNormalData
          // })
          margeTowarray(itemNormalData, itemChatData, function (coinsData) {
            margeTowarray(itemCoinslData, [], function (priceData) {

              return callback(err, {
                "coins": coinsData,
                "dollar": priceData
              })
            })
          })
        })
      })
    })
  }


  Item.getUsersCoinsByDay = function (from, to, ownerId, callback) {
    var filter = {};
    filter['startAt'] = {
      '$gt': new Date(from)
    }
    filter['startAt']['$lt'] = new Date(to)
    filter['type'] = "coins"
    if (ownerId)
      filter['ownerId'] = ObjectId(ownerId)

    Item.getDataSource().connector.connect(function (err, db) {
      var collection = db.collection('item');
      var users = collection.aggregate([{
          $match: filter
        },
        {
          $lookup: {
            from: "product",
            localField: "productId",
            foreignField: "_id",
            as: "product"
          }
        },
        {
          $unwind: "$product"
        },
        {
          $group: {
            "_id": {
              "ownerId": "$ownerId"
            },
            count: {
              $sum: 1
            },
            total: {
              $sum: "$price"
            },
            products: {
              $addToSet: "$product"
            }
          },

        },
        {
          $project: {
            _id: 0,
            ownerId: "$_id.ownerId",
            count: 1,
            total: 1,
            products: 1

          }
        },
        {
          $lookup: {
            from: "user",
            localField: "ownerId",
            foreignField: "_id",
            as: "owner"
          }
        },
        {
          $unwind: "$owner"
        }
      ])
      users.get(function (err, data) {
        // console.log(data);
        if (err) return callback(err);
        data = data.sort(function (a, b) {
          var aDate = new Date(a.owner.createdAt).getTime();
          var bDate = new Date(b.owner.createdAt).getTime();
          return bDate - aDate
        })
        return callback(null, data);
      })
    })
  }

  function getItems(filter) {
    return new Promise(function (resolve, reject) {
      Item.getDataSource().connector.connect(function (err, db) {
        var collection = db.collection('item');
        var users = collection.aggregate([{
            $match: filter
          },
          {
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
              from: "product",
              localField: "productId",
              foreignField: "_id",
              as: "product"
            }
          },
          {
            $unwind: "$product"
          },
          {
            $lookup: {
              from: "typeGoods",
              let: {
                id: {
                  $convert: {
                    input: "$product.typeGoodsId",
                    to: "objectId"
                  }
                }
              },
              pipeline: [{
                $match: {
                  $expr: {
                    $eq: ["$_id", "$$id"]
                  }
                }
              }],
              "as": "product.typeGoods"
            }
          },
          {
            $unwind: "$product.typeGoods"
          },
          {
            $group: {
              "_id": {
                month: {
                  $month: "$startAt"
                },
                day: {
                  $dayOfMonth: "$startAt"
                },
                year: {
                  $year: "$startAt"
                }
              },
              "countCoins": {
                "$sum": {
                  "$cond": [{
                      "$eq": ["$type", "coins"]
                    },
                    1,
                    0
                  ]
                }
              },
              "coinsArray": {
                "$addToSet": {
                  "$cond": [{
                      "$eq": ["$type", "coins"]
                    },
                    {
                      startAt: "$startAt",
                      name_en: "$product.name_en",
                      name_ar: "$product.name_ar",
                      username: "$owner.username",
                      ownerId: "$ownerId",
                    },
                    null
                  ]
                }
              },
              "totalCoins": {
                "$sum": {
                  "$cond": [{
                      "$eq": ["$type", "coins"]
                    },
                    "$price",
                    0
                  ]
                }
              },
              "totalSpentCoins": {
                "$sum": {
                  "$cond": [{
                      "$eq": ["$typePurchasing", "coins"]
                    },
                    "$price",
                    0
                  ]
                }
              },
              "extendChatArray": {
                "$addToSet": {
                  "$cond": [{
                      "$eq": ["$type", "Chat Extend"]
                    },
                    {
                      startAt: "$startAt",
                      name_en: "$product.name_en",
                      name_ar: "$product.name_ar",
                      username: "$owner.username",
                      ownerId: "$ownerId",
                    },
                    null
                  ]
                }
              },
              "countExtendChat": {
                "$sum": {
                  "$cond": [{
                      "$eq": ["$type", "Chat Extend"]
                    },
                    1,
                    0
                  ]
                }
              },
              "totalExtendChat": {
                "$sum": {
                  "$cond": [{
                      "$eq": ["$type", "Chat Extend"]
                    },
                    "$price",
                    0
                  ]
                }
              },
              "filterByCountryArray": {
                "$addToSet": {
                  "$cond": [{
                      "$eq": ["$product.typeGoods.name_en", "Filter By Country"]
                    },
                    {
                      startAt: "$startAt",
                      name_en: "$product.name_en",
                      name_ar: "$product.name_ar",
                      username: "$owner.username",
                      ownerId: "$ownerId",
                    },
                    null
                  ]
                }
              },
              "totalFilterByCountry": {
                "$sum": {
                  "$cond": [{
                      "$eq": ["$product.typeGoods.name_en", "Filter By Country"]
                    },
                    "$price",
                    0
                  ]
                }
              },
              "countFilterByCountry": {
                "$sum": {
                  "$cond": [{
                      "$eq": ["$product.typeGoods.name_en", "Filter By Country"]
                    },
                    1,
                    0
                  ]
                }
              },
              "filterByGenderArray": {
                "$addToSet": {
                  "$cond": [{
                      "$eq": ["$product.typeGoods.name_en", "Filter By Gender"]
                    },
                    {
                      startAt: "$startAt",
                      name_en: "$product.name_en",
                      name_ar: "$product.name_ar",
                      username: "$owner.username",
                      ownerId: "$ownerId",
                    },
                    null
                  ]
                }
              },
              "totalFilterByGender": {
                "$sum": {
                  "$cond": [{
                      "$eq": ["$product.typeGoods.name_en", "Filter By Gender"]
                    },
                    "$price",
                    0
                  ]
                }
              },
              "countFilterByGender": {
                "$sum": {
                  "$cond": [{
                      "$eq": ["$product.typeGoods.name_en", "Filter By Gender"]
                    },
                    1,
                    0
                  ]
                }
              },
              "repliesArray": {
                "$addToSet": {
                  "$cond": [{
                      "$eq": ["$product.typeGoods.name_en", "replies"]
                    },
                    {
                      startAt: "$startAt",
                      name_en: "$product.name_en",
                      name_ar: "$product.name_ar",
                      username: "$owner.username",
                      ownerId: "$ownerId",
                    },
                    null
                  ]
                }
              },
              "totalReply": {
                "$sum": {
                  "$cond": [{
                      "$eq": ["$product.typeGoods.name_en", "replies"]
                    },
                    "$price",
                    0
                  ]
                }
              },
              "countReply": {
                "$sum": {
                  "$cond": [{
                      "$eq": ["$product.typeGoods.name_en", "replies"]
                    },
                    1,
                    0
                  ]
                }
              },
              "bottleArray": {
                "$addToSet": {
                  "$cond": [{
                      "$eq": ["$product.typeGoods.name_en", "Bottles Packs"]
                    },
                    {
                      startAt: "$startAt",
                      name_en: "$product.name_en",
                      name_ar: "$product.name_ar",
                      username: "$owner.username",
                      ownerId: "$ownerId",
                    },
                    null
                  ]
                }
              },
              "totalBottle": {
                "$sum": {
                  "$cond": [{
                      "$eq": ["$product.typeGoods.name_en", "Bottles Packs"]
                    },
                    "$price",
                    0
                  ]
                }
              },
              "countBottle": {
                "$sum": {
                  "$cond": [{
                      "$eq": ["$product.typeGoods.name_en", "Bottles Packs"]
                    },
                    1,
                    0
                  ]
                }
              },
              total: {
                $sum: 1
              }
            },

          },
          {
            $project: {
              _id: 0,
              coinsArray: 1,
              totalBottle: 1,
              countBottle: 1,
              totalReply: 1,
              countReply: 1,
              countFilterByGender: 1,
              totalFilterByGender: 1,
              countFilterByCountry: 1,
              totalFilterByCountry: 1,
              totalExtendChat: 1,
              countExtendChat: 1,
              extendChatArray: 1,
              filterByCountryArray: 1,
              filterByGenderArray: 1,
              repliesArray: 1,
              bottleArray: 1,
              countCoins: 1,
              totalCoins: 1,
              totalCount: 1,
              totalSpentCoins: 1,
              total: 1,
              date: {
                $concat: [{
                  $toString: "$_id.year"
                }, "/", {
                  $toString: "$_id.month"
                }, "/", {
                  $toString: "$_id.day"
                }]
              }
            }
          }
        ])
        users.get(function (err, data) {
          // console.log(data);
          if (err) reject(err);
          data = data.sort(function (a, b) {
            var aDate = new Date(a.date).getTime();
            var bDate = new Date(b.date).getTime();
            return bDate - aDate
          })
          resolve(data)
        })
      })
    })
  }

  function getGift(filter) {
    return new Promise(function (resolve, reject) {

      Item.getDataSource().connector.connect(function (err, db) {
        var collection = db.collection('chatItem');
        var users = collection.aggregate([{
            $match: filter
          },
          {
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
              from: "chatProduct",
              localField: "chatProductId",
              foreignField: "_id",
              as: "chatProduct"
            }
          },
          {
            $unwind: "$chatProduct"
          },
          {
            $group: {
              "_id": {
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
              "totalSpentCoins": {
                "$sum": "$price"
              },
              "giftArray": {
                "$addToSet": {

                  startAt: "$createdAt",
                  name_en: "$chatProduct.name_en",
                  name_ar: "$chatProduct.name_ar",
                  username: "$owner.username",
                  ownerId: "$ownerId",

                }
              },
              countGift: {
                $sum: 1
              }
            }
          },
          {
            $project: {
              _id: 0,
              giftArray: 1,
              countGift: 1,
              totalSpentCoins: 1,
              date: {
                $concat: [{
                  $toString: "$_id.year"
                }, "/", {
                  $toString: "$_id.month"
                }, "/", {
                  $toString: "$_id.day"
                }]
              }
            }
          }
        ])
        users.get(function (err, data) {
          // console.log(data);
          if (err) reject(err);
          data = data.sort(function (a, b) {
            var aDate = new Date(a.date).getTime();
            var bDate = new Date(b.date).getTime();
            return bDate - aDate
          })
          resolve(data)
        })
      })
    })
  }

  Item.getItemsByDay = async function (from, to, ownerId, callback) {
    var filter = {};
    filter['startAt'] = {
      '$gt': new Date(from)
    }
    filter['startAt']['$lt'] = new Date(to)
    if (ownerId)
      filter['ownerId'] = ObjectId(ownerId)
    var itemData = await getItems(filter);
    var filterGift = {};
    filterGift['createdAt'] = {
      '$gt': new Date(from)
    }
    filterGift['createdAt']['$lt'] = new Date(to)
    if (ownerId)
      filterGift['ownerId'] = ObjectId(ownerId)
    var itemGift = await getGift(filterGift);
    var resultArray = []
    itemData.forEach(function (value) {
      var existing = itemGift.filter(function (v, i) {
        return (v.date == value.date);
      });
      if (existing.length) {
        value.totalSpentCoins += existing[0].totalSpentCoins;
        value.totalGift = existing[0].totalSpentCoins;
        value.giftArray = existing[0].giftArray;
        value.countGift = existing[0].countGift;

        resultArray.push(value)
      } else {
        value.giftArray = [];
        value.countGift = 0;
        value.totalGift = 0;
        resultArray.push(value);
      }
    });
    itemGift.forEach(function (value) {
      var existing = itemData.filter(function (v, i) {
        return (v.date == value.date);
      });
      if (existing.length == 0) {
        value.coinsArray = [];
        value.extendChatArray = [];
        value.filterByCountryArray = [];
        value.filterByGenderArray = [];
        value.repliesArray = [];
        value.bottleArray = [];
        value.countCoins = 0;
        value.totalCoins = 0;
        value.countExtendChat = 0;
        value.totalExtendChat = 0;
        value.totalFilterByCountry = 0;
        value.countFilterByCountry = 0;
        value.totalFilterByGender = 0;
        value.countFilterByGender = 0;
        value.totalReply = 0;
        value.countReply = 0;
        value.totalBottle = 0;
        value.countBottle = 0;
        value.totalGift = value.totalSpentCoins
        resultArray.push(value);
      }
    })
    resultArray = resultArray.sort(function (a, b) {
      var aDate = new Date(a.date).getTime();
      var bDate = new Date(b.date).getTime();
      return bDate - aDate
    })
    return callback(null, resultArray)
  }


  function margeTowarray(firArray, secArray, callback) {
    let result = {}
    firArray.forEach(element => {
      if (result[element.groupe.month + "-" + element.groupe.day + "-" + element.groupe.year] == null)
        result[element.groupe.month + "-" + element.groupe.day + "-" + element.groupe.year] = {
          // "count": 0,
          // "cost": 0,
          "product": {}
        }

      result[element.groupe.month + "-" + element.groupe.day + "-" + element.groupe.year]['product'][element.product["id"]] = element
      // result[element.groupe.day + "-" + element.groupe.month + "-" + element.groupe.year]['cost'] += element.cost;
      // result[element.groupe.day + "-" + element.groupe.month + "-" + element.groupe.year]['count'] += element.count;
    });
    secArray.forEach(element => {
      if (result[element.groupe.month + "-" + element.groupe.day + "-" + element.groupe.year] == null)
        result[element.groupe.month + "-" + element.groupe.day + "-" + element.groupe.year] = {
          "count": 0,
          "cost": 0,
          "product": {}
        }
      result[element.groupe.month + "-" + element.groupe.day + "-" + element.groupe.year]['product'][element.product["id"]] = element
      result[element.groupe.month + "-" + element.groupe.day + "-" + element.groupe.year]['cost'] += element.cost;
      result[element.groupe.month + "-" + element.groupe.day + "-" + element.groupe.year]['count'] += element.count;
    });
    sortObject(result, function (data) {
      return callback(data);
    })
  }


  function sortObject(result, callback) {
    var keys = [];

    for (const k in result) {
      if (result.hasOwnProperty(k)) {
        keys.push(k);
      }
    }

    console.log(keys)
    keys.sort((function (a, b) {
      return new Date(a) - new Date(b);
    }));
    console.log("keysssssssssss")
    console.log(keys)
    var len = keys.length;
    var newResult = {}
    if (keys.length == 0)
      return callback(newResult)

    for (let i = 0; i < len; i++) {
      var k = keys[i];
      newResult[k] = result[k]
      if (i + 1 == len)
        callback(newResult)
    }
  }


  function addHours(date, h) {
    date.setTime(date.getTime() + (h * 60 * 60 * 1000));
    return date;
  }


};
