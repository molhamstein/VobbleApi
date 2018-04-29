'use strict';
const path = require('path');
const ejs = require('ejs');
const configPath = process.env.NODE_ENV === undefined ?
    '../../server/config.json' :
    `../../server/config.${process.env.NODE_ENV}.json`;
const config = require(configPath);


 // "siteDomain": "http://104.217.253.15/vobbleApp/Vobble-webApp",

module.exports = function (User) {


    function sendVerificationEmail(user, subject, message, callback) {
        var options = {
            type: 'email',
            to: user.email,
            from: 'dlaaalsite@gmail.com',
            subject: subject,
            message: message,
            template: path.resolve(__dirname, '../../server/views/verify-template.ejs'),
            user: user
        };
        var siteDomain = `${config.siteDomain}`
        options.verifyHref = siteDomain +
            '/login/verify' +
            '?uid=' + options.user.id;
        console.log(options.verifyHref);
        user.verify(options, function (err, res) {
            if (err) {
                User.deleteById(user.id);
                callback(err)
            }
            callback(null, user);
        });
    }


    User.afterRemote('create', function (context, user, next) {
        sendVerificationEmail(user, 'Thanks for registering.', '', function (err, res) {
            if (err)
                next(err);
            next();
        })
    });




    User.afterRemote('confirm', function (context, user, next) {
        User.findById(context.req.query.uid).then(user => {
            user.status = 'active';
            user.save();
            next();
        }).catch(err => next(err));
    });


};
