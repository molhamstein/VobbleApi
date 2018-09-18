'use strict';
const errors = require('../../server/errors');

module.exports = function (Item) {
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

  Item.getFilterItem = function (filter, callback) {
    var ISOCode = ""
    var goodId = ""

    // filter['where']['and'].forEach(function (key, element,object) {
    //   if (key['owner.ISOCode'] != null) {
    //     ISOCode = key['owner.ISOCode'];
    //     object.splice(element, 1)
    //   } else if (key['product.typeGoodsId'] != null) {
    //     console.log(goodId);
    //     goodId = key['product.typeGoodsId'];
    //     object.splice(element, 1)
    //   }
    //   console.log(key);
    // }, this);

    var index = filter['where']['and'].length - 1;

    while (index >= 0) {
      if (filter['where']['and'][index]['owner.ISOCode'] != null) {
        ISOCode = filter['where']['and'][index]['owner.ISOCode'];
        filter['where']['and'].splice(index, 1)
      } else if (filter['where']['and'][index]['product.typeGoodsId'] != null) {
        goodId = filter['where']['and'][index]['product.typeGoodsId'];
        filter['where']['and'].splice(index, 1)
      }

      index -= 1;
    }

    if (filter['where']['and'][0] == null)
      filter = {}
    console.log(filter);
    Item.find(
      filter,
      function (err, items) {
        if (err)
          callback(err, null);
        console.log("items")
        console.log(items)
        var result = [];
        if (items) {
          items.forEach(function (element) {
            element.owner(function (err, owner) {
              element.product(function (err, product) {
                console.log(goodId);
                if (((ISOCode != "" && owner.ISOCode != ISOCode) || (goodId != "" && product.typeGoodsId != goodId)) == false) {
                  result.push(element);
                }
              })
            })
          }, this);
        }
        callback(null, result);
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
        console.log(data);
        if (err) return callback(err);
        return callback(null, data);
      })
    });
    // TODO
    // callback(null, result);
  };

};
