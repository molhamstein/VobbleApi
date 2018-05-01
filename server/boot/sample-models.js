module.exports = async function (app) {
  var User = app.models.user;
  var Role = app.models.Role;
  var shore = app.models.shore;
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
          gender: "male",
          image: "String",
          username: "admin"
        },
        {
          email: 'customer1@vobble.com',
          password: 'password',
          emailVerified: true,
          status: "active",
          gender: "male",
          image: "String",
          username: "customer1"

        },
        {
          email: 'customer2@vobble.com',
          password: 'password',
          emailVerified: true,
          status: "active",
          gender: "male",
          image: "String",
          username: "customer2"

        }
      ]);
      // console.log('Created users:', users);

      await shore.create([
        {
          name: "Main Shore",
          icon: "http://104.217.253.15:9999/api/uploads/videos/download/1522568292031_shore.jpg",
          cover: "http://104.217.253.15:9999/api/uploads/videos/download/1522568292031_shore.jpg",
        },
        {
          name: "Love Shore",
          icon: "http://104.217.253.15:9999/api/uploads/videos/download/1522568387594_shore2.jpg",
          cover: "http://104.217.253.15:9999/api/uploads/videos/download/1522568387594_shore2.jpg",
        },
        {
          name: "FadFed Shore",
          icon: "http://104.217.253.15:9999/api/uploads/videos/download/1522568292031_shore.jpg",
          cover: "http://104.217.253.15:9999/api/uploads/videos/download/1522568292031_shore.jpg",
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




