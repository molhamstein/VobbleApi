'use strict';
const errors = require('../../server/errors');
const mongoXlsx = require('mongo-xlsx');
const configPath = process.env.NODE_ENV === undefined ?
  '../../server/config.json' :
  `../../server/config.${process.env.NODE_ENV}.json`;
const config = require(configPath);

module.exports = function (Report) {

  var urlFileRoot = config.domain + config.restApiRoot + "/uploadFiles";

  var urlFileRootexcel = urlFileRoot + '/excelFiles/download/';

  Report.export = function (filter, callback) {
    var shoreId = "";
    var gt = ""
    var ls = ""
    var gender = ""
    var ISOCode = ""
    var index
    if (filter != null)
      index = filter['where']['and'].length - 1;
    else
      index = -1
    while (index >= 0) {
      if (filter['where']['and'][index]['owner.gender'] != null) {
        gender = filter['where']['and'][index]['owner.gender'];
        filter['where']['and'].splice(index, 1)
      } else if (filter['where']['and'][index]['owner.ISOCode'] != null) {
        ISOCode = filter['where']['and'][index]['owner.ISOCode'];
        filter['where']['and'].splice(index, 1)
      }

      index -= 1;
    }

    if (filter == null || filter['where']['and'][0] == null)
      filter = {}

    var config = {
      path: 'uploadFiles/excelFiles',
      save: true,
      fileName: 'report' + Date.now() + '.xlsx'
    };
    var data = [];
    Report.find(filter, function (err, reports) {
      reports.forEach(function (element) {
        var object = {};
        var secObject = {}
        var thierdObject = {}
        var typeObject;
        var objectreport;
        var ownerObject;
        var ownerBottleObject;

        var countryNaem = ""
        element.report_Type(function (err, report_Type) {
          typeObject = {
            "report type EN": report_Type['reportName_en'],
            "report type AR": report_Type['reportName_ar']
          }
        })
        element.bottle(function (err, bottle) {
          if (bottle)
            bottle.owner(function (err, ownerBottle) {
              ownerBottle.country(function (err, country) {
                countryNaem = country.name
              })
              if (ownerBottle['lastLogin'] != null)
                ownerBottleObject = {
                  countryOwnerBottle: countryNaem,
                  imageOwnerBottle: ownerBottle['image'],
                  totalBottlesThrownOwnerBottle: ownerBottle['totalBottlesThrown'],
                  repliesBottlesCountOwnerBottle: ownerBottle['repliesBottlesCount'],
                  repliesReceivedCountOwnerBottle: ownerBottle['repliesReceivedCount'],
                  foundBottlesCountOwnerBottle: ownerBottle['foundBottlesCount'],
                  extraBottlesCountOwnerBottle: ownerBottle['extraBottlesCount'],
                  bottlesCountOwnerBottle: ownerBottle['bottlesCount'],
                  registrationCompletedOwnerBottle: ownerBottle['registrationCompleted'],
                  genderOwnerBottle: ownerBottle['gender'],
                  nextRefillOwnerBottle: ownerBottle['nextRefill'].toString(),
                  ceatedAtOwnerBottle: ownerBottle['createdAt'].toString(),
                  lastLoginOwnerBottle: ownerBottle['lastLogin'].toString(),
                  emailOwnerBottle: ownerBottle['email'],
                  statusOwnerBottle: ownerBottle['status'],
                  typeLogInOwnerBottle: ownerBottle['typeLogIn'],
                  owner: ownerBottle['username']
                }
              else
                ownerBottleObject = {
                  countryOwnerBottle: countryNaem,
                  imageOwnerBottle: ownerBottle['image'],
                  totalBottlesThrownOwnerBottle: ownerBottle['totalBottlesThrown'],
                  repliesBottlesCountOwnerBottle: ownerBottle['repliesBottlesCount'],
                  repliesReceivedCountOwnerBottle: ownerBottle['repliesReceivedCount'],
                  foundBottlesCountOwnerBottle: ownerBottle['foundBottlesCount'],
                  extraBottlesCountOwnerBottle: ownerBottle['extraBottlesCount'],
                  bottlesCountOwnerBottle: ownerBottle['bottlesCount'],
                  registrationCompletedOwnerBottle: ownerBottle['registrationCompleted'],
                  genderOwnerBottle: ownerBottle['gender'],
                  nextRefillOwnerBottle: ownerBottle['nextRefill'].toString(),
                  createdAtOwnerBottle: ownerBottle['createdAt'].toString(),
                  emailOwnerBottle: ownerBottle['email'],
                  statusOwnerBottle: ownerBottle['status'],
                  typeLogInOwnerBottle: ownerBottle['typeLogIn'],
                  owner: ownerBottle['username']
                }
            })
        })
        element.owner(function (err, owner) {
          owner.country(function (err, country) {
            countryNaem = country.name
          })
          if (owner['lastLogin'] != null)
            ownerObject = {
              country: countryNaem,
              image: owner['image'],
              totalBottlesThrown: owner['totalBottlesThrown'],
              repliesBottlesCount: owner['repliesBottlesCount'],
              repliesReceivedCount: owner['repliesReceivedCount'],
              foundBottlesCount: owner['foundBottlesCount'],
              extraBottlesCount: owner['extraBottlesCount'],
              bottlesCount: owner['bottlesCount'],
              registrationCompleted: owner['registrationCompleted'],
              gender: owner['gender'],
              nextRefill: owner['nextRefill'].toString(),
              ownerCreatedAt: owner['createdAt'].toString(),
              lastLogin: owner['lastLogin'].toString(),
              email: owner['email'],
              status: owner['status'],
              typeLogIn: owner['typeLogIn'],
              reporter: owner['username']
            }
          else
            ownerObject = {
              country: countryNaem,
              image: owner['image'],
              totalBottlesThrown: owner['totalBottlesThrown'],
              repliesBottlesCount: owner['repliesBottlesCount'],
              repliesReceivedCount: owner['repliesReceivedCount'],
              foundBottlesCount: owner['foundBottlesCount'],
              extraBottlesCount: owner['extraBottlesCount'],
              bottlesCount: owner['bottlesCount'],
              registrationCompleted: owner['registrationCompleted'],
              gender: owner['gender'],
              nextRefill: owner['nextRefill'].toString(),
              ownerCreatedAt: owner['createdAt'].toString(),
              email: owner['email'],
              status: owner['status'],
              typeLogIn: owner['typeLogIn'],
              reporter: owner['username']
            }
        })
        var objectreport = {
          CreatedAt: element['createdAt'].toString(),
        }

        object = Object.assign({}, objectreport, typeObject);
        secObject = Object.assign({}, object, ownerObject);
        thierdObject = Object.assign({}, secObject, ownerBottleObject);
        data.push(thierdObject);
      }, this);
      /* Generate automatic model for processing (A static model should be used) */
      var model = mongoXlsx.buildDynamicModel(data);


      /* Generate Excel */
      mongoXlsx.mongoData2Xlsx(data, model, config, function (err, data) {
        //console.log('File saved at:', data.fullPath);
        callback(null, {
          'path': urlFileRootexcel + config['fileName']
        });

      });
    });
  };


};
