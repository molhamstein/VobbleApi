'use strict';
var appleReceiptVerify = require('node-apple-receipt-verify');
appleReceiptVerify.config({
  verbose: true
});
module.exports = function (Product) {
  appleReceiptVerify.validate({
    receipt: "454654546456"
  }, function (err, products) {
    if (err) {
        console.log("errrrrrrr");
        
      return console.error(err);
    }
    // ok!
  });
};
