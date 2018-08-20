'use strict';
const path = require('path');
const ejs = require('ejs');
const configPath = process.env.NODE_ENV === undefined ?
  '../../server/config.json' :
  `../../server/config.${process.env.NODE_ENV}.json`;
const config = require(configPath);
const errors = require('../../server/errors');
const download = require('image-downloader')




// "siteDomain": "http://104.217.253.15/vobbleApp/Vobble-webApp",

module.exports = function (User) {

  User.deactiveUser = function (id, callback) {
    // TODO
    User.findById(id, function (err, user) {
      if (err) {
        console.log(err);
        next();
      }
      user.status = "deactive";
      user.save();
      callback(null);
    });
    callback(null);
  };


  // file root save 
  var urlFileRoot = config.domain + config.restApiRoot + "/uploadFiles";

  // ulr save depend of folder name
  var urlFileRootSave = urlFileRoot + '/profile/download/'


  User.beforeRemote('create', function (context, result, next) {
    // set next refill
    var date = new Date();
    context.req.body.totalBottlesThrown = 0;
    context.req.body.registrationCompleted = true;
    // change to 12
    // todo
    // context.req.body.nextRefill = new Date(date.setTime(date.getTime() + 1 * 86400000));
    var nextRefill = new Date();
    nextRefill.setHours(24, 0, 0, 0);
    context.req.body.nextRefill = nextRefill
    next();
  });




  function sendVerificationEmail(user, subject, message, callback) {
    var options = {
      type: 'email',
      to: user.email,
      from: 'vobbleapp@gmail.com',
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
  // User.afterRemote('create', function (context, user, next) {
  //     sendVerificationEmail(user, 'Thanks for registering.', '', function (err, res) {
  //         if (err)
  //             next(err);
  //         next();
  //     })
  //     // next();
  // });




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
    // let url = `${config.siteDomain}` + `/login/reset-password?access_token=${info.accessToken.id}&user_id=${info.user.id}`;
    // let url = `http://104.217.253.15/vobbleResetPassword?access_token=${info.accessToken.id}&user_id=${info.user.id}`;
    let url = `http://159.65.202.38/vobbleResetPassword?access_token=${info.accessToken.id}&user_id=${info.user.id}`;

    ejs.renderFile(path.resolve(__dirname + "../../../server/views/reset-password-template.ejs"), {
      url: url
    }, function (err, html) {
      if (err) return console.log('> error sending password reset email', err);
      User.app.models.Email.send({
        to: info.email,
        from: 'vobbleapp@gmail.com',
        subject: 'Password reset',
        html: html
      }, function (err) {
        if (err) return console.log('> error sending password reset email', err);
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

  User.loginFacebook = function (data, callback) {
    console.log("SS");
    var socialId = data.socialId;
    var token = data.token;
    var gender = data.gender;
    var image = data.image;
    // var image = "https://www.idlidu.com/Content/images/default.png";
    var email = data.email;
    var name = data.name;
    // image=image.replace("height=50&width=50", "height=200&width=200");
    var result;
    // check if user is new or old in the system 
    User.findOne({
      where: {
        socialId: socialId,
        typeLogIn: "facebook"
      }
    }, function (err, oneUser) {
      if (err)
        callback(err, null);
      // new user
      if (oneUser == null) {
        // cheack if username is userd befor
        User.findOne({
          where: {
            username: name
          }
        }, function (err, userByUsername) {
          if (userByUsername) {
            var randVal = 100 + (Math.random() * (999 - 100));
            var x = Math.round(randVal);
            name = name + "_" + x;
          }



          const parts = image.split('.');
          // extension = parts[parts.length - 1];
          var extension = "jpg"
          var newFilename = (new Date()).getTime() + '.' + extension;

          const options = {
            url: image,
            dest: 'uploadFiles/profile/' + newFilename // Save to /path/to/dest/image.jpg
          }

          download.image(options)
            .then(({
              filename,
              imageFile
            }) => {
              image = urlFileRootSave + newFilename;
              console.log(newFilename);
              var date = new Date();
              var nextRefillVar = new Date();
              nextRefillVar.setHours(24, 0, 0, 0);
              User.create({
                socialId: socialId,
                gender: gender,
                email: email,
                image: image,
                username: name,
                status: "active",
                nextRefill: nextRefillVar,
                password: "123",
                typeLogIn: "facebook"
              }, function (err, newUser) {
                if (err)
                  callback(err, null);
                // create the token
                User.app.models.AccessToken.create({
                  userId: newUser.id
                }, function (err, newToken) {
                  // get the token with user of new user
                  // User.app.models.AccessToken.findOne({ include: 'user', userId: newUser.id }, function (err, token) {
                  // User.app.models.AccessToken.findOne(, function (err, token) {
                  User.app.models.AccessToken.findOne({
                    include: {
                      relation: 'user',
                      scope: {
                        include: {
                          relation: 'country'
                        }
                      }
                    },
                    where: {
                      userId: newUser.id
                    }
                  }, function (err, token) {
                    if (err)
                      callback(err, null);
                    result = token;
                    result.isNew = true;
                    callback(null, result);
                  });
                })

              })
            })

        })
        // .catch((err) => {
        //     console.log('err', err)

        //     throw err
        // })

      }
      // old user
      else {
        // get the token with user
        User.app.models.AccessToken.findOne({
          include: {
            relation: 'user',
            scope: {
              include: {
                relation: 'country'
              }
            }
          },
          where: {
            userId: oneUser.id
          }
        }, function (err, token) {
          if (err)
            callback(err, null);
          result = token;
          if (result == null) {
            User.app.models.AccessToken.create({
              userId: oneUser.id
            }, function (err, newToken) {
              // get the token with user of new user
              // User.app.models.AccessToken.findOne({ include: 'user', userId: newUser.id }, function (err, token) {
              // User.app.models.AccessToken.findOne(, function (err, token) {
              User.app.models.AccessToken.findOne({
                include: {
                  relation: 'user',
                  scope: {
                    include: {
                      relation: 'country'
                    }
                  }
                },
                where: {
                  userId: oneUser.id
                }
              }, function (err, token) {
                if (err)
                  callback(err, null);
                result = token;
                result.isNew = false;
                callback(null, result);
              });
            })
          } else {
            result.isNew = false;
            callback(null, result);
          }
        });
      }
    });
  }

  User.loginInstegram = function (data, callback) {
    var result;
    // TODO
    var socialId = data.socialId;
    var token = data.token;
    var gender = data.gender;
    var image = data.image;
    // var image = "https://www.idlidu.com/Content/images/default.png";
    var email = data.email;
    var name = data.name;
    User.findOne({
      where: {
        socialId: socialId,
        typeLogIn: "instegram"
      }
    }, function (err, oneUser) {
      if (err)
        callback(err, null);
      if (oneUser == null) {
        User.findOne({
          where: {
            username: name
          }
        }, function (err, userByUsername) {
          if (userByUsername) {
            var randVal = 100 + (Math.random() * (999 - 100));
            var x = Math.round(randVal);
            name = name + "_" + x;
          }
          const parts = image.split('.');
          // extension = parts[parts.length - 1];
          var extension = "jpg"
          var newFilename = (new Date()).getTime() + '.' + extension;

          const options = {
            url: image,
            dest: 'uploadFiles/profile/' + newFilename // Save to /path/to/dest/image.jpg
          }
          var nextRefillVar = new Date();
          nextRefillVar.setHours(24, 0, 0, 0);
          download.image(options)
            .then(({
              filename,
              imageFile
            }) => {
              image = urlFileRootSave + newFilename;
              console.log("newFilename");
              console.log(newFilename);
              var date = new Date();
              User.create({
                socialId: socialId,
                gender: gender,
                image: image,
                email: email,
                username: name,
                status: "active",
                nextRefill: nextRefillVar,
                password: "123",
                typeLogIn: "instegram"
              }, function (err, newUser) {
                if (err)
                  callback(err, null);
                User.app.models.AccessToken.create({
                  userId: newUser.id
                }, function (err, newToken) {
                  User.app.models.AccessToken.findOne({
                    include: {
                      relation: 'user',
                      scope: {
                        include: {
                          relation: 'country'
                        }
                      }
                    },
                    where: {
                      userId: newUser.id
                    }
                  }, function (err, token) {
                    if (err)
                      callback(err, null);
                    result = token;
                    result.isNew = true;
                    callback(null, result);
                  });
                })
              })
            }).catch((err) => {
              console.log("err");
              console.log(err);
            })
        })
      } else {
        User.app.models.AccessToken.findOne({
          include: {
            relation: 'user',
            scope: {
              include: {
                relation: 'country'
              }
            }
          },
          where: {
            userId: oneUser.id
          }
        }, function (err, token) {

          if (err)
            callback(err, null);
          result = token;
          if (result == null) {
            User.app.models.AccessToken.create({
              userId: oneUser.id
            }, function (err, newToken) {
              // get the token with user of new user
              // User.app.models.AccessToken.findOne({ include: 'user', userId: newUser.id }, function (err, token) {
              // User.app.models.AccessToken.findOne(, function (err, token) {
              User.app.models.AccessToken.findOne({
                include: {
                  relation: 'user',
                  scope: {
                    include: {
                      relation: 'country'
                    }
                  }
                },
                where: {
                  userId: oneUser.id
                }
              }, function (err, token) {
                if (err)
                  callback(err, null);
                result = token;
                result.isNew = false;
                callback(null, result);
              });
            })
          } else {
            result.isNew = false;
            callback(null, result);
          }
        });
      }
    });
  };

  User.loginGoogle = function (data, callback) {
    var result;
    var socialId = data.socialId;
    var token = data.token;
    var gender = data.gender;
    var image = data.image;
    // var image = "https://www.idlidu.com/Content/images/default.png";
    var email = data.email;
    var name = data.name;
    User.findOne({
      where: {
        socialId: socialId,
        typeLogIn: "google"
      }
    }, function (err, oneUser) {
      if (err)
        callback(err, null);
      if (oneUser == null) {
        User.findOne({
          where: {
            username: name
          }
        }, function (err, userByUsername) {
          if (userByUsername) {
            var randVal = 100 + (Math.random() * (999 - 100));
            var x = Math.round(randVal);
            name = name + "_" + x;
          }
          const parts = image.split('.');
          // extension = parts[parts.length - 1];
          var extension = "jpg";

          var newFilename = (new Date()).getTime() + '.' + extension;

          const options = {
            url: image,
            dest: 'uploadFiles/profile/' + newFilename // Save to /path/to/dest/image.jpg
          }
          download.image(options)
            .then(({
              filename,
              imageFile
            }) => {
              image = urlFileRootSave + newFilename;
              console.log(newFilename);
              var date = new Date();
              var nextRefillVar = new Date();
              nextRefillVar.setHours(24, 0, 0, 0);
              User.create({
                nextRefill: nextRefillVar,
                socialId: socialId,
                gender: gender,
                image: image,
                username: name,
                email: email,
                status: "active",
                password: "123",
                typeLogIn: "google"
              }, function (err, newUser) {
                if (err)
                  callback(err, null);
                User.app.models.AccessToken.create({
                  userId: newUser.id
                }, function (err, newToken) {
                  User.app.models.AccessToken.findOne({
                    include: {
                      relation: 'user',
                      scope: {
                        include: {
                          relation: 'country'
                        }
                      }
                    },
                    where: {
                      userId: newUser.id
                    }
                  }, function (err, token) {
                    if (err)
                      callback(err, null);
                    result = token;
                    result.isNew = true;
                    callback(null, result);
                  });
                })
              })
            })
        })
      } else {
        User.app.models.AccessToken.findOne({
          include: {
            relation: 'user',
            scope: {
              include: {
                relation: 'country'
              }
            }
          },
          where: {
            userId: oneUser.id
          }
        }, function (err, token) {

          if (err)
            callback(err, null);
          result = token;
          if (result == null) {
            User.app.models.AccessToken.create({
              userId: oneUser.id
            }, function (err, newToken) {
              // get the token with user of new user
              // User.app.models.AccessToken.findOne({ include: 'user', userId: newUser.id }, function (err, token) {
              // User.app.models.AccessToken.findOne(, function (err, token) {
              User.app.models.AccessToken.findOne({
                include: {
                  relation: 'user',
                  scope: {
                    include: {
                      relation: 'country'
                    }
                  }
                },
                where: {
                  userId: oneUser.id
                }
              }, function (err, token) {
                if (err)
                  callback(err, null);
                result = token;
                result.isNew = false;
                callback(null, result);
              });
            })
          } else {
            result.isNew = false;
            callback(null, result);
          }
        });
      }
    });
  };

  /**
   * check username is unique
   * @param {string} newUsername
   * @param {Function(Error, boolean)} callback
   */

  User.checkUsername = function (newUsername, callback) {
    var result;
    User.findOne({
      where: {
        username: newUsername
      }
    }, function (err, userByUsername) {
      if (userByUsername) {
        callback(errors.account.usernameNotValid(), null);

      } else
        callback(null, true);

    })
    // TODO
  };


  /**
   * block user
   * @param {string} userId
   * @param {Function(Error, boolean)} callback
   */

  User.block = function (userId, context, callback) {
    const locals = context.res.locals;
    locals.user.blocking.find({}).then(users => {
      var isNewBlock = false
      isNewBlock = users.find(function (user) {
        // return user.userId;
        if (new String(userId).valueOf() === new String(user.userId).valueOf()) {
          return true
        }
      });
      if (isNewBlock) {
        callback(errors.block.alreadyIsBlocked(), null);

      } else {
        var newBlock = {
          "userId": userId,
          "ownerId": context.req.accessToken.userId
        }
        User.app.models.block.create(newBlock, function (err, newBlocked) {
          if (err)
            callback(err);
          callback(null, newBlocked);

        })
      }
    });
  };

  /**
   * unblock user
   * @param {string} userId
   * @param {Function(Error, boolean)} callback
   */

  User.unBlock = function (userId, context, callback) {
    var result;
    const locals = context.res.locals;
    locals.user.blocking.findOne({
      where: {
        "userId": userId
      }
    }).then(users => {
      console.log(users);
      if (!users) {
        callback(errors.block.noBlocked(), null);
      } else {
        User.app.models.block.deleteById(users.id, function (err) {
          if (err)
            callback(err);
          callback(null);
        })
      }
    });
  };

  /**
   *
   * @param {Function(Error, array)} callback
   */

  User.myListBlock = function (context, callback) {
    var result;
    const locals = context.res.locals;
    locals.user.blocking.find({
      include: {
        relation: 'user'
      }
    }).then(users => {
      callback(null, users);
    });
    // TODO
  };


  /**
   * get my info
   * @param {Function(Error, object)} callback
   */

  User.me = function (context, callback) {
    var result;
    var userId = context.req.accessToken.userId;
    User.findById(userId, function (err, oneUser) {
      if (err)
        callback(err, null);
      else {
        oneUser.lastLogin = new Date();
        oneUser.save();
        callback(null, oneUser);
      }
    })
    // TODO
  };

};
