'use strict';
const errors = require('../../server/errors');

module.exports = function (Bottle) {


    // Set owner Id
    Bottle.beforeRemote('create', function (context, result, next) {
        // check user is active 
        if (context.res.locals.user.status !== 'active') {
            return next(errors.account.notActive());
        }


        context.req.body.ownerId = context.req.accessToken.userId;
        let weight = 0
        Bottle.app.models.User.findById(context.req.body.ownerId, function (err, user) {
            if (err) {
                console.log(err);
                next();
            }
            if (user.bottlesCountToday == 0 && user.bottlesCount == 0) {
                return next(errors.bottle.noAvailableBottleToday());
            }
            weight += Date.parse(new Date()) * 3;
            weight += Date.parse(user.createdAt) * 4;
            context.req.body.weight = weight;
            next();
        })


    });




    // increment bottlesCount for user
    Bottle.afterRemote('create', function (context, result, next) {
        const user = context.res.locals.user;
        user.bottles++;
        if (user.bottlesCount > 0)
            user.bottlesCount--;
        else
            user.bottlesCountToday--;
        user.save();
        next();
    });


    // get bottle to view

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
        Bottle.app.models.bottleUserseen.find({ where: { userId: req.accessToken.userId } }, function (err, bottles) {
            seenBottle = bottles;
        })

        var blockList = [];
        // get id user block list 
        Bottle.app.models.block.find({
            where:
            {
                or: [
                    { "ownerId": req.accessToken.userId },
                    { "userId": req.accessToken.userId },
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
        Bottle.find({ where: { status: 'active' }, order: 'weight DESC' }, function (err, bottles) {
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
                callback(null, ranking[0]);
            }
            else {
                callback(errors.bottle.noNewBottle(), null);
            }
        });
    };


    function sortBottle(ranking, userId, seenBottle, blockList, filter) {
        console.log("blockList");
        console.log(blockList);
        var index = ranking.length - 1;
        var newRanking = [];
        var blocking = false;
        while (index >= 0) {
            var element = ranking[index];
            element.owner(function (err, owner) {
                element.shore(function (err, shore) {
                    var numberOfSeenThisBottle = findInSeenUser(seenBottle, userId, element.id);
                    var isBlocked = isInBlockList(blockList, owner.id)
                    if (element.status == "deactivate" || owner.status == "deactivate" || isBlocked || (new String(userId).valueOf() === new String(owner.id).valueOf()) || (filter.gender && filter.gender != owner.gender) || (filter.ISOCode && filter.ISOCode != owner.ISOCode) || (filter.shoreId && filter.shoreId != shore.id)) {
                        ranking.splice(index, 1);
                    }
                    else if (numberOfSeenThisBottle > 0) {
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


};
