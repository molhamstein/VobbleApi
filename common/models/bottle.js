'use strict';

module.exports = function (Bottle) {


    // Set owner Id
    Bottle.beforeRemote('create', function (context, result, next) {
        // check user is active 
        if (context.res.locals.user.status !== 'active') {
            return next(errors.account.notActive());
        }
        console.log("context.req.accessToken");
        console.log(context);

        context.req.body.ownerId = context.req.accessToken.userId;
        let weight = 0
        Bottle.app.models.bottleUserseen.findById(context.req.accessToken.userId, function (err, user) {
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
        user.save();
        next();
    });



    /**
 * get one mthode with some logic
 * @param {string} gender gender of owner bottle
 * @param {string} ISOCode ISOCode of owner bottle
 * @param {Function(Error, object)} callback
 */

    Bottle.getOneBottle = function (gender, ISOCode, req, callback) {
        var result;
        var filter = {};
        var seenBottle = [];
        var countPagination = 0;
        Bottle.app.models.bottleUserseen.find({}, function (err, bottles) {
            seenBottle = bottles;
        })
        var whileVariable = true;

        // while (whileVariable) {
        // console.log("T");

        Bottle.find({ limit: 10, skip: 10 * countPagination, order: 'weight DESC' }, function (err, bottles) {
            if (err) {
                callback(err, null);
                whileVariable = false;
            }
            var ranking = bottles;
            // var index = ranking.length - 1;
            if (ranking.length == 0) {
                callback(null, []);
                whileVariable = false;

            }
            // while (index >= 0) {
            //     var element = ranking[index];
            //     element.owner(function (err, owner) {
            //         if ((new String(req.accessToken.userId).valueOf() === new String(owner.id).valueOf()) || (filter.gender && filter.gender != owner.gender) || (filter.ISOCode && filter.ISOCode != owner.ISOCode) || (findInSeenUser(seenBottle, req.accessToken.userId, element.id))) {
            //             console.log("Delete Object");
            //             ranking.splice(index, 1);
            //         }
            //     });
            //     index -= 1;
            // }
            // ranking.sort(compare);
            console.log("SSSS");
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
                callback(null, ranking[0]);
                whileVariable = false;
            }
            else {
                callback(null, []);
            }
            countPagination++;

        });
        // };
    };


    function removeInvalidBottle(ranking, userId, seenBottle, filter) {
        var index = ranking.length - 1;
        while (index >= 0) {
            var element = ranking[index];
            element.owner(function (err, owner) {
                if ((new String(userId).valueOf() === new String(owner.id).valueOf()) || (filter.gender && filter.gender != owner.gender) || (filter.ISOCode && filter.ISOCode != owner.ISOCode) || (findInSeenUser(seenBottle, userId, element.id))) {
                    console.log("Delete Object");
                    ranking.splice(index, 1);
                }
            });
            index -= 1;
        }
        return ranking;
    }
    // function for sort bottle depend of weight
    function compare(a, b) {
        if (a.weight > b.weight)
            return -1;
        if (a.weight < b.weight)
            return 1;
        return 0;
    }

    function getData() {

    }

    function findInSeenUser(array, keyA, keyB) {
        // console.log("array");
        // console.log(array);

        // console.log("keyA");
        // console.log(keyA);

        // console.log("keyB");
        // console.log(keyB);
        var found = false;
        array.forEach(function (element) {

            if (new String(element.userId).valueOf() === new String(keyA).valueOf() && new String(element.bottleId).valueOf() === new String(keyB).valueOf()) {
                // console.log("Error")
                found = true;
                return 0;
            }
        }, this);

        // console.log("Not Error")

        return found;
    }


};
