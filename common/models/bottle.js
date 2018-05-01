'use strict';

module.exports = function (Bottle) {

        
    // Set owner Id
    Bottle.beforeRemote('create', function (context, result, next) {
        // check user is active 
        if (context.res.locals.user.status !== 'active') {
            return next(errors.account.notActive());
        }
        context.req.body.ownerId = context.req.accessToken.userId;
        next();
    });
    Bottle.afterRemote('create', function (context, result, next) {
        const user = context.res.locals.user;
        user.bottlesCount++;
        user.save();
        next();
    });


    // Bottle.find({include: {owner: ['gender']}}, function() { /* ... */ });

};
