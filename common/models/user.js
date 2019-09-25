'use strict';
const path = require('path');
const ejs = require('ejs');
const configPath = process.env.NODE_ENV === undefined ?
  '../../server/config.json' :
  `../../server/config.${process.env.NODE_ENV}.json`;
const config = require(configPath);
var g = require('strong-globalize')();
var debug = require('debug')('loopback:user');

const errors = require('../../server/errors');
const download = require('image-downloader')

const mongoXlsx = require('mongo-xlsx');
var cron = require('node-schedule');

var serviceAccount = require("../../server/boot/serviceAccountKey.json");
var version = require("../../server/boot/version.json");



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

  var urlFileRootexcel = urlFileRoot + '/excelFiles/download/';



  // ulr save depend of folder name
  var urlFileRootSave = urlFileRoot + '/profile/download/'


  User.beforeRemote('create', function (context, result, next) {

    User.app.models.Device.cheackDevice(context.req.body.deviceName, function (err, device) {
      if (err)
        return next(err)
      if (device != null) {
        context.req.body.deviceId = device.id;
        delete context.req.body.deviceName
      }
      var date = new Date();
      context.req.body.totalBottlesThrown = 0;
      context.req.body.registrationCompleted = true;
      var nextRefill = new Date();
      nextRefill.setHours(24, 0, 0, 0);
      context.req.body.nextRefill = nextRefill

      if (context.req.body.email) {
        User.findOne({
          where: {
            email: context.req.body.email
          }
        }, function (err, user) {
          if (err)
            return next(err)
          if (user)
            return next(errors.account.emailAlreadyExists());
          else
            next();
        })
      }
    })

  });

  User.afterRemote('create', function (context, result, next) {
    makeChat(result.id);
    next();
  })

  function makeChat(userId) {
    User.app.models.notificationCenter.initNotificationCenter(userId)
  }

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
    var deviceId = null
    User.app.models.Device.cheackDevice(data.deviceName, function (err, device) {
      if (err)
        return callback(err)
      if (device != null) {
        deviceId = device.id;
      }

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
          "and": [{
            "or": [{
                socialId: socialId
              },
              {
                "and": [{
                  username: {
                    like: name,
                    options: "i"
                  }
                }, {
                  email: email
                }]
              }
            ]
          }, {
            typeLogIn: "facebook"
          }]

        }
      }, function (err, oneUser) {
        if (err)
          callback(err, null);
        console.log("oneUser");
        console.log(oneUser);
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
                var date = new Date();
                var nextRefillVar = new Date();
                nextRefillVar.setHours(24, 0, 0, 0);
                User.create({
                  socialId: socialId,
                  gender: gender,
                  email: email,
                  image: image,
                  deviceId: deviceId,
                  username: name,
                  status: "active",
                  nextRefill: nextRefillVar,
                  password: "123",
                  typeLogIn: "facebook"
                }, function (err, newUser) {
                  if (err) {
                    if (err.statusCode == 422)
                      callback(errors.account.emailAlreadyExistsSN(), null);
                    else
                      callback(err, null);
                  }
                  // create the token
                  User.app.models.AccessToken.create({
                    ttl: 31536000000,
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
                      makeChat(newUser.id);
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
          if (oneUser.status != 'active') {
            return callback(errors.account.notActive());
          }
          oneUser.updateAttributes({
            "socialId": socialId,
            "deviceId": deviceId
          })
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
                ttl: 31536000000,
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
    });
  }

  User.loginInstegram = function (data, callback) {
    var deviceId = null
    User.app.models.Device.cheackDevice(data.deviceName, function (err, device) {
      if (err)
        return callback(err)
      if (device != null) {
        deviceId = device.id;
      }

      var result;
      var socialId = data.socialId;
      var token = data.token;
      var gender = data.gender;
      var image = data.image;
      var email = data.email;
      var name = data.name;
      console.log("data")
      console.log(data)
      User.findOne({
        where: {
          socialId: socialId,
          typeLogIn: "instegram"
        }
      }, function (err, oneUser) {
        if (err)
          callback(err, null);
        if (oneUser == null) {
          console.log("new user")
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
                    if (err.statusCode == 422)
                      callback(errors.account.emailAlreadyExistsSN(), null);
                    else
                      callback(err, null);
                  User.app.models.AccessToken.create({
                    ttl: 31536000000,
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
                      makeChat(newUser.id);

                      console.log("new user Data")
                      console.log(result)
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
          console.log("old user")
          console.log(oneUser)
          if (oneUser.status != 'active') {
            return callback(errors.account.notActive());
          }

          oneUser.updateAttributes({
            "deviceId": deviceId
          })
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
                ttl: 31536000000,
                userId: oneUser.id
              }, function (err, newToken) {
                console.log("new token")
                console.log(newToken)
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
                  console.log("result")
                  console.log(result)
                  callback(null, result);
                });
              })
            } else {
              console.log("old token")
              console.log(result)
              result.isNew = false;
              callback(null, result);
            }
          });
        }
      });
    });
  };

  User.loginGoogle = function (data, callback) {
    var deviceId = null
    User.app.models.Device.cheackDevice(data.deviceName, function (err, device) {
      if (err)
        return callback(err)
      if (device != null) {
        deviceId = device.id;
      }

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
                    if (err.statusCode == 422)
                      callback(errors.account.emailAlreadyExistsSN(), null);
                    else
                      callback(err, null);
                  User.app.models.AccessToken.create({
                    ttl: 31536000000,
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
                      makeChat(newUser.id);
                      callback(null, result);
                    });
                  })
                })
              })
          })
        } else {
          if (oneUser.status != 'active') {
            return callback(errors.account.notActive());
          }

          oneUser.updateAttributes({
            "deviceId": deviceId
          })

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
                ttl: 31536000000,
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
    })
  };


  User.twitterLogin = function (data, callback) {
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
        typeLogIn: "twitter"
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
                typeLogIn: "twitter"
              }, function (err, newUser) {
                if (err)
                  if (err.statusCode == 422)
                    callback(errors.account.emailAlreadyExistsSN(), null);
                  else
                    callback(err, null);
                User.app.models.AccessToken.create({
                  ttl: 31536000000,
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
              ttl: 31536000000,
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

  User.signupByPhone = function (phonenumber, deviceName, callback) {
    var deviceId = null
    User.app.models.Device.cheackDevice(deviceName, function (err, device) {
      if (err)
        return callback(err)
      if (device != null) {
        deviceId = device.id;
      }
      User.findOne({
        "where": {
          "phonenumber": phonenumber
        }
      }, function (err, user) {
        if (err)
          return callback(err, null)
        if (user) {
          sendVerificationCode(phonenumber, function () {
            return callback(null, {
              "success": true
            })
          });
          // })
        } else {
          User.create({
            "phonenumber": phonenumber,
            "password": "password",
            "deviceId": deviceId,
            "typeLogIn": "phonenumber"
          }, function (err, newUser) {
            if (err)
              return callback(err)
            makeChat(newUser.id)
            sendVerificationCode(phonenumber, function () {
              return callback(null, {
                "success": true
              })
            });
          })
        }
      })
    })
  }

  User.checkVerificationCode = function (phonenumber, code, callback) {
    var request = require("request");
    var options = {
      method: 'PUT',
      url: 'https://verificationapi-v1.sinch.com/verification/v1/verifications/number/' + phonenumber,
      headers: {
        'cache-control': 'no-cache',
        'Content-Type': 'application/json',
        'x-timestamp': new Date(),
        Authorization: serviceAccount.AuthorizationSinch
      },
      body: {
        sms: {
          code: code
        },
        method: 'sms'
      },
      json: true
    };

    request(options, function (error, response, body) {
      if (error) throw new Error(error);
      if (body.errorCode == 40003)
        callback(errors.account.usernameNotValid(), null);

      console.log(body);
      callback()

    });
  }

  function sendVerificationCode(mobile, callback) {
    var request = require("request");
    var options = {
      method: 'POST',
      url: 'https://verificationapi-v1.sinch.com/verification/v1/verifications',
      headers: {
        'cache-control': 'no-cache',
        'Content-Type': 'application/json',
        'x-timestamp': new Date(),
        Authorization: serviceAccount.AuthorizationSinch
      },
      body: {
        identity: {
          type: 'number',
          endpoint: mobile
        },
        method: 'sms'
      },
      json: true
    };

    request(options, function (error, response, body) {
      callback()
      if (error) throw new Error(error);

      console.log(body);
    });

  }


  User.loginByPhone = function (phonenumber, code, callback) {
    console.log(new Date());
    User.findOne({
      "where": {
        "phonenumber": phonenumber
      }
    }, function (err, user) {
      if (err)
        return callback(err)
      var request = require("request");
      var options = {
        method: 'PUT',
        url: 'https://verificationapi-v1.sinch.com/verification/v1/verifications/number/' + phonenumber,
        headers: {
          'cache-control': 'no-cache',
          'Content-Type': 'application/json',
          'x-timestamp': new Date(),
          Authorization: serviceAccount.AuthorizationSinch
        },
        body: {
          sms: {
            code: code
          },
          method: 'sms'
        },
        json: true
      };

      request(options, function (error, response, body) {
        if (error) throw new Error(error);
        if (body.errorCode == 40003)
          return callback(errors.account.codeNotFound())

        User.loginByPhonenumber({
          phonenumber: phonenumber,
          password: 'password',
        }, ["user"], function (err, data) {
          if (err)
            return callback(err)
          if (data.user.status != 'active') {
            return callback(errors.account.notActive());
          }

          if (data.user.gender == null)
            data.isNew = true
          else
            data.isNew = false
          return callback(err, data);
        })
      })
    })
  }
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

  User.me = function (context, deviceName, callback) {
    var result;
    var deviceId = null
    console.log("context.req.headers.version");
    console.log(context.req.headers['ios-version']);
    let userVersion = context.req.headers['ios-version']
    User.app.models.Device.cheackDevice(deviceName, function (err, device) {
      if (err) {
        return callback(err)
      }
      if (device != null) {
        deviceId = device.id;
      }
      var userId = context.req.accessToken.userId;
      User.findById(userId, function (err, oneUser) {
        if (err)
          return callback(err, null);
        if (oneUser.status != 'active') {
          return callback(errors.account.notActive());
        } else {
          oneUser.lastLogin = new Date();
          oneUser.deviceId = deviceId;
          // oneUser.save();
          if (userVersion == null)
            return callback(null, oneUser);
          else if (userVersion != null) {
            console.log("version type")
            var versionStatus = User.compirVersion(userVersion, version)
            var versionObject = {
              "status": "uptodate"
            };
            if (versionStatus == 'obsolete' || versionStatus == 'update available') {
              versionObject["status"] = versionStatus;
              versionObject["link"] = version.iosLink;
            }
            oneUser['version'] = versionObject
          }
          return callback(null, oneUser);
        }
      })
    })
    // TODO
  };

  User.editUsername = function (context, username, callback) {
    var result;
    var deviceId = null
    var userId = context.req.accessToken.userId;
    User.findById(userId, function (err, oneUser) {
      if (err)
        return callback(err, null);
      if (oneUser.canEditUsername == false) {
        return callback(errors.account.youCannotEditUsername());
      } else {
        User.checkUsername(username, function (err, data) {
          if (err)
            return callback(err, null)
          oneUser.updateAttributes({
            "username": username,
            "canEditUsername": true
          })
          return callback(null, true)
        })
      }
    })
    // TODO
  };


  User.compirVersion = function (userVersion, version) {

    var isAfterLoadVersion = false
    var isBeforLastVersion = false
    var arrayUserVersion = userVersion.toString().split('.');
    var arrayLastVersion = version.lastVersion.toString().split('.');
    var arrayLoadVersion = version.loadVersion.toString().split('.');
    console.log(arrayUserVersion)
    console.log(arrayLastVersion)
    console.log(arrayLoadVersion)
    if (arrayUserVersion[2] == undefined)
      arrayUserVersion[2] = 0
    for (let index = 0; index < arrayUserVersion.length; index++) {
      const element = parseInt(arrayUserVersion[index]);
      const elementLoadVersion = parseInt(arrayLoadVersion[index]);
      console.log(element + "  > " + elementLoadVersion)
      if (element > elementLoadVersion) {
        isAfterLoadVersion = true
        break;
      }
    }
    if (isAfterLoadVersion == false) {
      return ("obsolete")
    }

    for (let index = 0; index < arrayUserVersion.length; index++) {
      const element = parseInt(arrayUserVersion[index]);
      const elementLastVersion = parseInt(arrayLastVersion[index]);
      console.log(element + "  < " + elementLastVersion)
      if (element < elementLastVersion) {
        isBeforLastVersion = true
        break;
      }
    }


    if (isBeforLastVersion == true) {
      return ("update available")
    } else {
      return ("uptodate")
    }
  }


  User.loginByPhonenumber = function (credentials, include, fn) {
    var self = this;
    if (typeof include === 'function') {
      fn = include;
      include = undefined;
    }

    fn = fn || utils.createPromiseCallback();

    include = (include || '');
    if (Array.isArray(include)) {
      include = include.map(function (val) {
        return val.toLowerCase();
      });
    } else {
      include = include.toLowerCase();
    }


    var query = {
      phonenumber: credentials.phonenumber
    }

    if (!query.phonenumber) {
      var err2 = new Error(g.f('{{phonenumber}} is required'));
      err2.statusCode = 419;
      err2.code = 'PHONENUMBER_REQUIRED';
      fn(err2);
      return fn.promise;
    }

    self.findOne({
      where: query
    }, function (err, user) {
      var defaultError = new Error(g.f('login failed'));
      defaultError.statusCode = 418;
      defaultError.code = 'LOGIN_FAILED';

      function tokenHandler(err, token) {
        if (err) return fn(err);
        if (Array.isArray(include) ? include.indexOf('user') !== -1 : include === 'user') {
          // NOTE(bajtos) We can't set token.user here:
          //  1. token.user already exists, it's a function injected by
          //     "AccessToken belongsTo User" relation
          //  2. ModelBaseClass.toJSON() ignores own properties, thus
          //     the value won't be included in the HTTP response
          // See also loopback#161 and loopback#162

          token.__data.user = user;
        }
        afterLogin({}, user, function (err) {
          if (err)
            fn(err, null)
          else if (credentials.location_id == null || credentials.location_id == undefined)
            fn(err, token);
          else
            Client.app.models.locations.find({
              where: {
                id: credentials.location_id
              }
            }, function (err, location) {
              token.type_location = location[0].type
              if (location[0].type != 'manual')
                fn(err, token);
              else {
                Client.app.models.pendingClient.find({
                  where: {
                    "and": [{
                        location_id: credentials.location_id
                      },
                      {
                        client_id: token.userId
                      },
                    ]
                  }
                }, function (err, clinet) {
                  if (err)
                    fn(err, null);
                  if (clinet[0] != null && clinet[0].status == "active") {
                    token['pendingClient'] = false
                    fn(err, token);
                  } else if (clinet[0] != null && clinet[0].status != "active") {
                    var defaultError = new Error(g.f('You are pending client'));
                    defaultError.statusCode = 627;
                    defaultError.code = 'YOU_ARE_PENDING_CLIENT';
                    fn(defaultError, null);
                  } else if (clinet[0] == null) {
                    Client.app.models.pendingClient.create({
                      "client_id": token.userId,
                      "location_id": credentials.location_id
                    }, function (err, data) {
                      if (err)
                        fn(err, null);
                      var defaultError = new Error(g.f('You are pending client'));
                      defaultError.statusCode = 627;
                      defaultError.code = 'YOU_ARE_PENDING_CLIENT';
                      fn(defaultError, null);
                    })
                  }
                })
              }
            })
        })


      }

      if (err) {
        debug('An error is reported from User.findOne: %j', err);
        fn(defaultError);
      } else if (user) {
        user.hasPassword(credentials.password, function (err, isMatch) {
          if (err) {
            debug('An error is reported from User.hasPassword: %j', err);
            fn(defaultError);
          } else if (isMatch) {

            if (user.createAccessToken.length === 2) {
              user.createAccessToken(credentials.ttl, tokenHandler);
            } else {
              user.createAccessToken(credentials.ttl, credentials, tokenHandler);
            }

          } else {
            debug('The password is invalid for user %s', query.email || query.username);
            fn(defaultError);
          }
        });
      } else {
        debug('No matching record is found for user %s', query.email || query.username);
        fn(defaultError);
      }
    });
    return fn.promise;
  }


  function afterLogin(context, client, next) {
    // console.log(client);
    // var clientM = app.models.client;
    var data = client;
    User.findOne({
      where: {
        id: client.id
      }
    }, function (err, user) {
      if (user.emailVerified == false) {
        console.log("unauthorized")
        data = {
          name: "unauthorized",
          status: 601,
          message: "please verify your account"
        };
        const err = new Error("unauthorized");
        err.statusCode = 601;
        err.code = 'VERIFICATION_REQUIRED';
        next(err);
      } else
        next();

    });

  };





  /**
   *
   * @param {object} result
   * @param {Function(Error, object)} callback
   */

  User.genderStateReport = function (from, to, callback) {

    var filter = {};
    if (from) {
      filter['createdAt'] = {
        '$gt': new Date(from)
      }
    }
    if (to) {
      if (filter['createdAt'] == null)
        filter['createdAt'] = {}
      filter['createdAt']['$lt'] = new Date(to)
    }
    User.getDataSource().connector.connect(function (err, db) {

      var collection = db.collection('user');
      var cursor = collection.aggregate([{
          $match: filter
        },
        {
          $project: {
            male: {
              $cond: [{
                $eq: ["$gender", "male"]
              }, 1, 0]
            },
            female: {
              $cond: [{
                $eq: ["$gender", "female"]
              }, 1, 0]
            },
          }
        },
        {
          $group: {
            _id: null,
            male: {
              $sum: "$male"
            },
            female: {
              $sum: "$female"
            },
            total: {
              $sum: 1
            },
          }
        },
      ]);
      cursor.get(function (err, data) {
        console.log(data);
        if (err) return callback(err);
        var malePercent = 0
        var femalePercent = 0
        if (data[0] != null && data[0]['male'] != 0 && data[0]['total'] != 0)
          malePercent = data[0]['male'] * 100 / data[0]['total']
        if (data[0] != null && data[0]['female'] != 0 && data[0]['total'] != 0)
          femalePercent = data[0]['female'] * 100 / data[0]['total']
        var result = {
          "male": malePercent,
          "female": femalePercent
        }
        return callback(null, result);
      })
    });
  };


  User.export = function (filter, callback) {
    var config = {
      path: 'uploadFiles/excelFiles',
      save: true,
      fileName: 'user' + Date.now() + '.xlsx'
    };

    if (filter == null || filter['where']['and'][0] == null)
      filter = {}


    var data = [];
    User.find(filter, function (err, users) {
      users.forEach(function (element) {

        var object = {};
        var countryNaem
        element.country(function (err, country) {
          if (country == null)
            countryNaem = ""
          else
            countryNaem = country.name
        })

        if (element['lastLogin'] != null)
          object = {
            country: countryNaem,
            image: element['image'],
            totalBottlesThrown: element['totalBottlesThrown'],
            repliesBottlesCount: element['repliesBottlesCount'],
            repliesReceivedCount: element['repliesReceivedCount'],
            foundBottlesCount: element['foundBottlesCount'],
            extraBottlesCount: element['extraBottlesCount'],
            bottlesCount: element['bottlesCount'],
            registrationCompleted: element['registrationCompleted'],
            gender: element['gender'],
            nextRefill: element['nextRefill'].toString(),
            createdAt: element['createdAt'].toString(),
            lastLogin: element['lastLogin'].toString(),
            email: element['email'],
            status: element['status'],
            typeLogIn: element['typeLogIn'],
            username: element['username']
          }
        else
          object = {
            country: countryNaem,
            image: element['image'],
            totalBottlesThrown: element['totalBottlesThrown'],
            repliesBottlesCount: element['repliesBottlesCount'],
            repliesReceivedCount: element['repliesReceivedCount'],
            foundBottlesCount: element['foundBottlesCount'],
            extraBottlesCount: element['extraBottlesCount'],
            bottlesCount: element['bottlesCount'],
            registrationCompleted: element['registrationCompleted'],
            gender: element['gender'],
            nextRefill: element['nextRefill'].toString(),
            createdAt: element['createdAt'].toString(),
            email: element['email'],
            status: element['status'],
            typeLogIn: element['typeLogIn'],
            username: element['username']
          }
        data.push(object);
      }, this);
      /* Generate automatic model for processing (A static model should be used) */
      var model = mongoXlsx.buildDynamicModel(data);


      /* Generate Excel */
      mongoXlsx.mongoData2Xlsx(data, model, config, function (err, data) {
        console.log('File saved at:', data.fullPath);
        callback(null, {
          'path': urlFileRootexcel + config['fileName']
        });

      });
    });

    // model[0].access = 'id';
    // mongoXlsx.mongoData2Xlsx(data, model, config, function (err, data) {
    //   console.log('File saved at:', path.join(__dirname, '../../', data.fullPath), data.fullPath);
    //   return res.sendFile(path.join(__dirname, '../../', data.fullPath))
    // });

    // TODO
  };



  /**
   *
   * @param {Function(Error, array)} callback
   */

  User.accesstoken = function (callback) {
    var result;
    // TODO
    User.app.models.AccessToken.find({}, function (err, data) {
      if (err)
        callback(err, null);

      callback(null, data);

    })
  };

  cron.scheduleJob('* */2 * * *', function () {
    var todayDate = new Date(),
      weekDate = new Date(),
      yesterday = new Date();
    weekDate.setTime(todayDate.getTime() - (8 * 24 * 3600000))
    yesterday.setTime(todayDate.getTime() - (24 * 3600000))
    console.log("now", todayDate);
    console.log("weekDate", weekDate);
    console.log("yesterday", yesterday);
    User.find({
      "where": {
        "and": [{
            "lastLogin": {
              "gt": weekDate
            }
          },
          {
            "lastLogin": {
              "lt": yesterday
            }
          }
        ]
      }
    }, function (err, users) {
      if (!err) {
        users.forEach(element => {
          // if (element.email == "fatherboard1@gmail.com") {
          var diffHour = calcDiff(element.lastLogin, todayDate)
          console.log(diffHour)
          if (diffHour >= 24 && diffHour < 48 && !element.has24Not) {
            console.log("in 24 hourse");
            var message = {
              "app_id": "e8a91e90-a766-4f1b-a47e-e3b3f569dbef",
              "included_segments ": ["Active Users", "Inactive Users"],
              "contents": {
                "ar": "عروس البحر تركت لك فيديو في البحر، تعال شوفه!!!",
                "en": "You signed in yesterday! Why don't you check in today?"
              },
              "filters": [{
                "field": "tag",
                "key": "user_id",
                "relation": "=",
                "value": element.id
              }],
              "headings": {
                "en": "Hey " + element.username + " !",
                "ar": "مرحباً " + element.username + " !"
              }
            }
            element.updateAttributes({
              has24Not: true
            }, sendNewNotification(message))

          } else if (diffHour >= 48 && diffHour < 72 && !element.has48Not) {
            console.log("in 48 hourse");
            var message = {
              "app_id": "e8a91e90-a766-4f1b-a47e-e3b3f569dbef",
              "included_segments ": ["Active Users", "Inactive Users"],
              "contents": {
                "ar": "روح البحر واكتشف أسراره..",
                "en": "you missed lots of fun, come and check what have you missed."
              },
              "filters": [{
                "field": "tag",
                "key": "user_id",
                "relation": "=",
                "value": element.id
              }],
              "headings": {
                "en": "48h Where are you??",
                "ar": "مشغول؟؟"
              }
            }
            element.updateAttributes({
              has48Not: true
            }, sendNewNotification(message))
          } else if (diffHour >= 168 && diffHour < 192 && !element.has168Not) {
            console.log("in 168 hourse");
            var message = {
              "app_id": "e8a91e90-a766-4f1b-a47e-e3b3f569dbef",
              "included_segments ": ["Active Users", "Inactive Users"],
              "contents": {
                "ar": "ادخل وفضفض همك للبحر..",
                "en": "life is very short.. lets enjoy it together with Vibo!!!"
              },
              "filters": [{
                "field": "tag",
                "key": "user_id",
                "relation": "=",
                "value": element.id
              }],
              "headings": {
                "en": "7 days " + element.username + " seems you are busy",
                "ar": "ايش عندك؟"
              }
            }
            element.updateAttributes({
              has168Not: true
            }, sendNewNotification(message))
          }
        });
      }
    })
  })


  User.login = function (credentials, include, fn) {
    var deviceId = null
    User.app.models.Device.cheackDevice(credentials.deviceName, function (err, device) {
      if (err) {
        fn(err);
        return fn.promise;
      }
      if (device != null)
        deviceId = device.id;
      var self = User;
      if (typeof include === 'function') {
        fn = include;
        include = undefined;
      }

      fn = fn || utils.createPromiseCallback();

      include = (include || '');
      if (Array.isArray(include)) {
        include = include.map(function (val) {
          return val.toLowerCase();
        });
      } else {
        include = include.toLowerCase();
      }


      var query = {
        email: credentials.email
      }

      if (!query.email) {
        var err2 = new Error(g.f('{{email}} is required'));
        err2.statusCode = 400;
        err2.code = 'EMAIL_REQUIRED';
        fn(err2);
        return fn.promise;
      }

      self.findOne({
        where: query
      }, function (err, user) {
        var defaultError = new Error(g.f('login failed'));
        defaultError.statusCode = 401;
        defaultError.code = 'LOGIN_FAILED';

        function tokenHandler(err, token) {
          if (err) return fn(err);
          if (Array.isArray(include) ? include.indexOf('user') !== -1 : include === 'user') {
            // NOTE(bajtos) We can't set token.user here:
            //  1. token.user already exists, it's a function injected by
            //     "AccessToken belongsTo User" relation
            //  2. ModelBaseClass.toJSON() ignores own properties, thus
            //     the value won't be included in the HTTP response
            // See also loopback#161 and loopback#162

            token.__data.user = user;
          }
          afterLogin({}, user, function (err) {
            if (err)
              fn(err, null)
            else
              fn(err, token);
          })
        }

        if (err) {
          debug('An error is reported from User.findOne: %j', err);
          fn(defaultError);
        } else if (user) {
          if (user.status != 'active') {
            fn(errors.account.notActive());
          }
          user.hasPassword(credentials.password, function (err, isMatch) {
            if (err) {
              debug('An error is reported from User.hasPassword: %j', err);
              fn(defaultError);
            } else if (isMatch) {

              if (user.createAccessToken.length === 2) {
                user.createAccessToken(credentials.ttl, tokenHandler);
              } else {
                user.createAccessToken(credentials.ttl, credentials, tokenHandler);
              }
              user.updateAttributes({
                "deviceId": deviceId
              })
            } else {
              debug('The password is invalid for user %s', query.email || query.username);
              fn(defaultError);
            }
          });
        } else {
          debug('No matching record is found for user %s', query.email || query.username);
          fn(defaultError);
        }
      });
      return fn.promise;
    })
  }


  function calcDiff(date1, date2) {
    var hours = Math.abs(date1 - date2) / 36e5;
    return hours;
  }
  var sendNewNotification = function (data) {
    var headers = {
      "Content-Type": "application/json; charset=utf-8",
      "Authorization": serviceAccount.AuthorizationOneSignel
    };

    var options = {
      host: "onesignal.com",
      port: 443,
      path: "/api/v1/notifications",
      method: "POST",
      headers: headers
    };

    var https = require('https');
    var req = https.request(options, function (res) {
      res.on('data', function (data) {
        console.log("Response:");
        // console.log(JSON.parse(data));
      });
    });

    req.on('error', function (e) {
      console.log("ERROR:");
      console.log(e);
    });

    req.write(JSON.stringify(data));
    req.end();
  };

};
