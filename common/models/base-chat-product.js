'use strict';

module.exports = function (BaseChatProduct) {
  BaseChatProduct.getAllChatProduct = function (callback) {
    // callback(null, ["ssss"])
    BaseChatProduct.getDataSource().connector.connect(function (err, db) {

      var collection = db.collection('baseChatProduct');
      var cursor = collection.aggregate([{
        $match: {
          "status": "active"
        }
      }, {
        $lookup: {
          from: "chatProduct",
          let: {
            location_id: "$_id"
          },
          pipeline: [{
              $match: {
                $expr: {
                  $and: [{
                      $eq: ["$status", "active"]
                    },
                    {
                      $eq: ["$baseProductId", "$$location_id"]
                    }
                  ]
                }
              },
            },
            {
              $project: {
                _id: 0,
                'id': '$_id',
                createdAt: 1,
                status: 1,
                price: 1,
                name_ar: 1,
                name_en: 1,
                icon: 1,
              }
            }
          ],
          as: "chatProduct"
        }
      }, {
        $project: {
          _id: 0,
          'id': '$_id',
          createdAt: 1,
          chatProduct: 1,
          status: 1,
          name_ar: 1,
          name_en: 1,
          icon: 1,
        }
      }, {
        $match: {
          $expr: {
            $gt: [{
              $size: "$chatProduct"
            }, 0]
          }
        }
      }]);
      cursor.get(function (err, data) {
        if (err) return callback(err);
        return callback(null, data);
      })
    });
  }

  //   pipeline: [{
  //     $match: {
  //         $expr: {
  //             $and: [
  //                 {$eq: ["$fulfillmentLocationId", "$$location_id"]},
  //                 {$eq: ["$zipCode", "SOME_VARIABLE_STRING_2"]}
  //             ]
  //         }
  //     }
  // },
  // { 
  //     $project: { _id: 0, zipCode: 1, cutoffTime: 1 } 
  // }],
};
