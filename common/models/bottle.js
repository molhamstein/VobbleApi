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
            if (user.bottlesCountToday == 0) {
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
        user.bottlesCount++;
        user.bottlesCountToday--;
        user.save();
        next();
    });



    /**
 * get one mthode with some logic
 * @param {string} gender gender of owner bottle
 * @param {string} ISOCode ISOCode of owner bottle
 * @param {Function(Error, object)} callback
 */

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
        var countPagination = 0;
        Bottle.app.models.bottleUserseen.find({where: { userId: req.accessToken.userId }}, function (err, bottles) {
            seenBottle = bottles;
        })
        var whileVariable = true;

        Bottle.find({ where: { status: 'active' }, order: 'weight DESC' }, function (err, bottles) {
            if (err) {
                callback(err, null);
                whileVariable = false;
            }
            var ranking = bottles;
            ranking = removeInvalidBottle(bottles, req.accessToken.userId, seenBottle, filter);
            if (ranking[0]) {
                var bottleUserseenObject = {
                    "userId": req.accessToken.userId,
                    "bottleId": ranking[0].id
                }
                Bottle.app.models.bottleUserseen.create(bottleUserseenObject)
                    .then()
                    .catch(err => console.log(err));
                // console.log(ranking);
                callback(null, ranking);
                whileVariable = false;
            }
            else {
                callback(null, errors.bottle.noNewBottle());
            }
            countPagination++;

        });
    };


    function removeInvalidBottle(ranking, userId, seenBottle, filter) {
        var index = ranking.length - 1;
        var newRanking=[];
        while (index >= 0) {
            var element = ranking[index];
            element.owner(function (err, owner) {
                element.shore(function (err, shore) {
                    var numberOfSeenThisBottle=findInSeenUser(seenBottle, userId, element.id);
                    if ((new String(userId).valueOf() === new String(owner.id).valueOf()) || (filter.gender && filter.gender != owner.gender) || (filter.ISOCode && filter.ISOCode != owner.ISOCode) || (filter.shoreId && filter.shoreId != shore.id)) {
                        console.log("Delete Object");
                        ranking.splice(index, 1);
                    }else if(numberOfSeenThisBottle>0){
                        ranking[index].numberRepeted=numberOfSeenThisBottle;
                        newRanking.push(ranking[index]);
                        ranking.splice(index, 1);
                    }
                })
            });
            index -= 1;
        }
        newRanking.sort(compare);
        ranking=ranking.concat(newRanking);
        return ranking;
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
                // console.log("Error")
                found++;
            }
        }, this);

        // console.log("Not Error")
        return found;
    }


};
