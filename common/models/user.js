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

    // to Send Verfication email after register 
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

    //send password reset link when requested
    User.on('resetPasswordRequest', function (info) {
        // let url = `${config.siteDomain}/login/reset-password?access_token=${info.accessToken.id}&user_id=${info.user.id}`;
        let url = `${config.siteDomain}` + `/login/reset-password?access_token=${info.accessToken.id}&user_id=${info.user.id}`;
        ejs.renderFile(path.resolve(__dirname + "../../../server/views/reset-password-template.ejs"), { url: url }, function (err, html) {
            if (err) return console.log('> error sending password reset email', err);
            User.app.models.Email.send({
                to: info.email,
                from: 'dlaaalsite@gmail.com',
                subject: 'Password reset',
                html: html
            }, function (err) {
                if (err) return console.log('> error sending password reset email');
            });
        });
    });
    /**
     *
     * @param {string} token
     * @param {string} name
     * @param {string} email
     * @param {Function(Error, object)} callback
     */

    User.loginFacebook = function (socialId, token, gender, image, email, name, callback) {
        var result;
        // TODO
        User.findOne({ where: { socialId: socialId, typeLogIn: "facebook" } }, function (err, oneUser) {
            if (err)
                callback(err, null);
            if (oneUser == null) {
                User.create({
                    socialId: socialId,
                    gender: gender,
                    image: image,
                    username: name,
                    password: "123",
                    typeLogIn: "facebook"
                }, function (err, newUser) {
                    if (err)
                        callback(err, null);
                    User.app.models.AccessToken.create({
                        userId: newUser.id
                    }, function (err, newToken) {
                        callback(null, newToken);
                    })

                })
            } else {
                User.app.models.AccessToken.findOne({ userId: oneUser.id }, function (err, token) {
                    if (err)
                        callback(err, null);
                    callback(null, token);
                });
            }
        });
    }

    User.loginInstegram = function (socialId, token, gender, image, email, name, callback) {
        var result;
        // TODO
        User.findOne({ where: { socialId: socialId, typeLogIn: "instegram" } }, function (err, oneUser) {
            if (err)
                callback(err, null);
            if (oneUser == null) {
                User.create({
                    socialId: socialId,
                    gender: gender,
                    image: image,
                    username: name,
                    password: "123",
                    typeLogIn: "instegram"
                }, function (err, newUser) {
                    if (err)
                        callback(err, null);
                    User.app.models.AccessToken.create({
                        userId: newUser.id
                    }, function (err, newToken) {
                        callback(null, newToken);
                    })

                })
            } else {
                User.app.models.AccessToken.findOne({ userId: oneUser.id }, function (err, token) {
                    if (err)
                        callback(err, null);
                    callback(null, token);
                });
            }
        });
    };

};
