'use strict';
const errors = require('../../server/errors');

module.exports = function (Product) {

  Product.getAllProducts = function (callback) {
    Product.find({}, function (err, product) {
      if (err) return callback(err)
      Product.app.models.ChatProduct.find({}, function (err, chatProduct) {
        if (err) return callback(err)
        for (let index = 0; index < chatProduct.length; index++) {
          const element = chatProduct[index];
          product.push(element)
          if (index + 1 == chatProduct.length) {
            return callback(null, product)
          }
        }
      })
    })
  }
};
