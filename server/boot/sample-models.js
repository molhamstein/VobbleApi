module.exports = async function (app) {
  var User = app.models.user;
  var Role = app.models.Role;
  var bottleType = app.models.bottleType;
  var RoleMapping = app.models.RoleMapping;
  const FileContainer = app.models.FileContainer;
  const configPath = process.env.NODE_ENV === undefined ? '../../server/config.json' : `../../server/config.${process.env.NODE_ENV}.json`;
  const config = require(configPath);
  const imageBaseUrl = config.domain + '/api';
  const images = [
    imageBaseUrl + '/files/images/download/e99bcfb0-ddd3-11e7-8654-77a982fe81a21512928788523.jpg',
    imageBaseUrl + '/files/images/download/e99bcfb0-ddd3-11e7-8654-77a982fe81a21512928788523.jpg',
    imageBaseUrl + '/files/images/download/e99bcfb0-ddd3-11e7-8654-77a982fe81a21512928788523.jpg',
    imageBaseUrl + '/files/images/download/e99bcfb0-ddd3-11e7-8654-77a982fe81a21512928788523.jpg'
  ];

  /*
  {
    "email": "admin@vobble.com",
    "password": "password"
  }
  */


  try {
    const user = await User.find();

    if (user.length <= 0) {

      let users = await User.create([
        {
          email: 'admin@vobble.com',
          password: 'password',
          emailVerified: true,
          status: "active",
          gender: "male"
        },
        {
          email: 'customer1@vobble.com',
          password: 'password',
          emailVerified: true,
          status: "active",
          gender: "male"

        },
        {
          email: 'customer2@vobble.com',
          password: 'password',
          emailVerified: true,
          status: "active",
          gender: "male"

        }
      ]);
      // console.log('Created users:', users);

      await bottleType.create([
        {
          "name": "firstType",
          "image": null
        }, {
          "name": "secondeType",
          "image": null
        }
      ])

      // console.log('Created reports:', reports);

      let customer = users.find(o => o.email === 'customer1@vobble.com');
      let customer2 = users.find(o => o.email === 'customer2@vobble.com');
      let appAdmin = users.find(o => o.email === 'admin@vobble.com');

      //Create Roles and assign to user
      Role.create({
        name: 'admin'
      }).then(role => {
        console.log('Created role:', role);
        role.principals.create({
          principalType: RoleMapping.USER,
          principalId: appAdmin.id
        }).then(principal => {
          console.log('Created principal:', principal);
        });
      });


      console.log('seedData: DONE!');
    }

  } catch (err) {
    console.log(err)
    throw err;
  }
};




