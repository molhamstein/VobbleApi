'use strict';

module.exports = function (Item) {

    Item.beforeRemote('create', function (context, item, next) {
        console.log(context.req.body.ownerId);
        Item.app.models.Product.findById(context.req.body.productId, function (err, product) {
            if (err) {
                console.log(err);
                next();
            }
            context.req.body.ownerId = context.req.accessToken.userId;
            if (product.bottleCount > 0) {
                Item.app.models.User.findById(context.req.body.ownerId).then(user => {
                    user.bottlesCount += product.bottleCount;
                    user.save();
                    next();
                }).catch(err => next(err));
            } else {
                var date = new Date().getTime();
                date += (product.validity * 60 * 60 * 1000);
                context.req.body.endAt = new Date(date);
            }
        })
    });

};
