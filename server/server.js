'use strict';
require('cls-hooked');
const errors = require('../server/errors');

var loopback = require('loopback');
var boot = require('loopback-boot');
var schedule = require('node-schedule');
var app = module.exports = loopback();

const LoopBackContext = require('loopback-context');
app.use(LoopBackContext.perRequest());
app.use(loopback.token());

app.use(function (req, res, next) {
  // console("App Use");
  if (!req.accessToken) return next();
  //console.log("Token");
  //console.log(req.accessToken.userId);
  app.models.User.findById(req.accessToken.userId,
    function (err, user) {
      if (err) return next(err);
      if (!user) return next(errors.account.notFound());
      res.locals.user = user
      app.currentUser = user;
      user.roles.find({}, function (err, roles) {
        res.locals.rolesNames = roles.map(function (role) {
          return role.name;
        });
        next();
      });
    });
});


app.start = function () {
  // console.log("SSSSSSSS")
  // start the web server
  return app.listen(function () {
    app.emit('started');
    var baseUrl = app.get('url').replace(/\/$/, '');
    console.log('Web server listening at: %s', baseUrl);
    if (app.get('loopback-component-explorer')) {
      var explorerPath = app.get('loopback-component-explorer').mountPath;
      console.log('Browse your REST API at %s%s', baseUrl, explorerPath);
    }
  });
};


var timer = schedule.scheduleJob('0 1 0 * * *', function () {
  // var date = new Date();
  // date = new Date(date.setTime(date.getTime() + 1 * 86400000));
  var date = new Date();
  //console.log(date);
  date.setHours(date.getHours() + 24);
  //console.log(date);
  app.models.User.updateAll({}, {
    'bottlesCount': 1,
    'nextRefill': date
  }, function (err, res) {
    if (err)
      console.log(err);

  });
});


// Bootstrap the application, configure models, datasources and middleware.
// Sub-apps like REST API are mounted via boot scripts.
boot(app, __dirname, function (err) {
  if (err) throw err;

  // start the server if `$ node server.js`
  if (require.main === module)
    app.start();
});
