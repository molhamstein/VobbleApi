'use strict';
const errors = require('../../server/errors');
const mongoXlsx = require('mongo-xlsx');
const configPath = process.env.NODE_ENV === undefined ?
  '../../server/config.json' :
  `../../server/config.${process.env.NODE_ENV}.json`;
const config = require(configPath);

module.exports = function (Item) {

  var urlFileRoot = config.domain + config.restApiRoot + "/uploadFiles";

  var urlFileRootexcel = urlFileRoot + '/excelFiles/download/';


  Item.validatesInclusionOf('storeType', { in: ['playStore', 'iTunes']
  });

  Item.beforeRemote('create', function (context, item, next) {
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
      context.req.body.price = product.price;
      next();
    })
  });

  Item.afterRemote('create', function (context, item, next) {
    Item.app.models.Product.findById(context.req.body.productId, function (err, product) {
      if (err) {
        return next(err);
      }
      if (product.bottleCount > 0) {
        Item.app.models.User.findById(context.req.body.ownerId).then(user => {
          user.extraBottlesCount += product.bottleCount;
          user.save();
          next();
        }).catch(err => next(err));
      } else {
        var date = new Date().getTime();
        date += (product.validity * 60 * 60 * 1000);
        item.endAt = new Date(date);
        item.save();
        next();
      }
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
    Item.find(
      filter,
      function (err, items) {
        if (err)
          callback(err, null);
        // console.log("items")
        // console.log(items)
        var result = [];
        if (items) {
          items.forEach(function (element) {
            element.owner(function (err, owner) {
              element.product(function (err, product) {
                // console.log(goodId);
                if (((ISOCode == "" || owner.ISOCode == ISOCode) && (goodId == "" || product.typeGoodsId == goodId)) && (username == "" || owner.username.includes(username))) {
                  result.push(element);
                }
              })
            })
          }, this);
        }
        callback(null, result);
      })
  }

  Item.getFilterItem = function (filter, callback) {
    var offset = filter['offset'];
    var limit = filter['limit'];
    if (offset == null)
      offset = 0;
    if (limit == null)
      limit = 10;
    getFilter(filter, function (err, data) {
      if (err)
        callback(err, null);
      var newData = data.splice(offset, offset - 1 + limit);
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
        var ownerObject
        var productObject;
        element.owner(function (err, owner) {
          var countryNaem
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

        if (ownerObject != null || productObject != null) {
          object = Object.assign({}, objectItem, productObject);
          secObject = Object.assign({}, object, ownerObject);
          data.push(secObject);
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


};
