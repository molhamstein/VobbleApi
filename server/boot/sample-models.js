module.exports = async function (app) {
  var User = app.models.user;
  var Role = app.models.Role;
  var shore = app.models.shore;
  var reportType = app.models.reportType;
  var country = app.models.country;
  var RoleMapping = app.models.RoleMapping;
  var typeGoods = app.models.typeGoods;
  var product = app.models.product;
  var bottle = app.models.bottle;
  const FileContainer = app.models.FileContainer;
  const configPath = process.env.NODE_ENV === undefined ? '../../server/config.json' : `../../server/config.${process.env.NODE_ENV}.json`;
  const config = require(configPath);
  const imageBaseUrl = config.domain + '/api';
  const images = [
    imageBaseUrl + '/uploadFiles/images/download/user-default.jpg',
    imageBaseUrl + '/uploadFiles/images/download/beach.jpg',
    imageBaseUrl + '/uploadFiles/images/download/main.png',
    imageBaseUrl + '/uploadFiles/images/download/love.jpg',
    imageBaseUrl + '/uploadFiles/images/download/other.png',

  ];
  const files = [
    imageBaseUrl + '/uploadFiles/videos/download/083246d0-4f2f-11e8-af28-93a1158274a61525392405437.mp4',
    imageBaseUrl + '/uploadFiles/videos/download/1ed91300-4f2f-11e8-af28-93a1158274a61525392443440.mp4',
    imageBaseUrl + '/uploadFiles/videos/download/d1b4bba0-4f2f-11e8-af28-93a1158274a61525392743514.mp4'
  ]


  const thumble = [
    imageBaseUrl + '/uploadFiles/thumb/download/083246d0-4f2f-11e8-af28-93a1158274a61525392405437_thumb.PNG',
    imageBaseUrl + '/uploadFiles/thumb/download/1ed91300-4f2f-11e8-af28-93a1158274a61525392443440_thumb.PNG',
    imageBaseUrl + '/uploadFiles/thumb/download/d1b4bba0-4f2f-11e8-af28-93a1158274a61525392743514_thumb.PNG'
  ]


  const iconProduct=[
    imageBaseUrl + '/uploadFiles/images/bottles2.png',
    imageBaseUrl + '/uploadFiles/images/globe-01.png'
  ]
  /*
  {
    "email": "admin@vobble.com",
    "password": "password"
  }
  */

  var date = new Date();
  date = new Date(date.setTime(date.getTime() + 1 * 86400000));

  try {
    const user = await User.find();

    if (user.length <= 0) {

      await country.create(
        [
          { "name": "Afghanistan", "code": "AF" },
          { "name": "land Islands", "code": "AX" },
          { "name": "Albania", "code": "AL" },
          { "name": "Algeria", "code": "DZ" },
          { "name": "American Samoa", "code": "AS" },
          { "name": "AndorrA", "code": "AD" },
          { "name": "Angola", "code": "AO" },
          { "name": "Anguilla", "code": "AI" },
          { "name": "Antarctica", "code": "AQ" },
          { "name": "Antigua and Barbuda", "code": "AG" },
          { "name": "Argentina", "code": "AR" },
          { "name": "Armenia", "code": "AM" },
          { "name": "Aruba", "code": "AW" },
          { "name": "Australia", "code": "AU" },
          { "name": "Austria", "code": "AT" },
          { "name": "Azerbaijan", "code": "AZ" },
          { "name": "Bahamas", "code": "BS" },
          { "name": "Bahrain", "code": "BH" },
          { "name": "Bangladesh", "code": "BD" },
          { "name": "Barbados", "code": "BB" },
          { "name": "Belarus", "code": "BY" },
          { "name": "Belgium", "code": "BE" },
          { "name": "Belize", "code": "BZ" },
          { "name": "Benin", "code": "BJ" },
          { "name": "Bermuda", "code": "BM" },
          { "name": "Bhutan", "code": "BT" },
          { "name": "Bolivia", "code": "BO" },
          { "name": "Bosnia and Herzegovina", "code": "BA" },
          { "name": "Botswana", "code": "BW" },
          { "name": "Bouvet Island", "code": "BV" },
          { "name": "Brazil", "code": "BR" },
          { "name": "British Indian Ocean Territory", "code": "IO" },
          { "name": "Brunei Darussalam", "code": "BN" },
          { "name": "Bulgaria", "code": "BG" },
          { "name": "Burkina Faso", "code": "BF" },
          { "name": "Burundi", "code": "BI" },
          { "name": "Cambodia", "code": "KH" },
          { "name": "Cameroon", "code": "CM" },
          { "name": "Canada", "code": "CA" },
          { "name": "Cape Verde", "code": "CV" },
          { "name": "Cayman Islands", "code": "KY" },
          { "name": "Central African Republic", "code": "CF" },
          { "name": "Chad", "code": "TD" },
          { "name": "Chile", "code": "CL" },
          { "name": "China", "code": "CN" },
          { "name": "Christmas Island", "code": "CX" },
          { "name": "Cocos (Keeling) Islands", "code": "CC" },
          { "name": "Colombia", "code": "CO" },
          { "name": "Comoros", "code": "KM" },
          { "name": "Congo", "code": "CG" },
          { "name": "Congo, The Democratic Republic of the", "code": "CD" },
          { "name": "Cook Islands", "code": "CK" },
          { "name": "Costa Rica", "code": "CR" },
          { "name": "Cote D'Ivoire", "code": "CI" },
          { "name": "Croatia", "code": "HR" },
          { "name": "Cuba", "code": "CU" },
          { "name": "Cyprus", "code": "CY" },
          { "name": "Czech Republic", "code": "CZ" },
          { "name": "Denmark", "code": "DK" },
          { "name": "Djibouti", "code": "DJ" },
          { "name": "Dominica", "code": "DM" },
          { "name": "Dominican Republic", "code": "DO" },
          { "name": "Ecuador", "code": "EC" },
          { "name": "Egypt", "code": "EG" },
          { "name": "El Salvador", "code": "SV" },
          { "name": "Equatorial Guinea", "code": "GQ" },
          { "name": "Eritrea", "code": "ER" },
          { "name": "Estonia", "code": "EE" },
          { "name": "Ethiopia", "code": "ET" },
          { "name": "Falkland Islands (Malvinas)", "code": "FK" },
          { "name": "Faroe Islands", "code": "FO" },
          { "name": "Fiji", "code": "FJ" },
          { "name": "Finland", "code": "FI" },
          { "name": "France", "code": "FR" },
          { "name": "French Guiana", "code": "GF" },
          { "name": "French Polynesia", "code": "PF" },
          { "name": "French Southern Territories", "code": "TF" },
          { "name": "Gabon", "code": "GA" },
          { "name": "Gambia", "code": "GM" },
          { "name": "Georgia", "code": "GE" },
          { "name": "Germany", "code": "DE" },
          { "name": "Ghana", "code": "GH" },
          { "name": "Gibraltar", "code": "GI" },
          { "name": "Greece", "code": "GR" },
          { "name": "Greenland", "code": "GL" },
          { "name": "Grenada", "code": "GD" },
          { "name": "Guadeloupe", "code": "GP" },
          { "name": "Guam", "code": "GU" },
          { "name": "Guatemala", "code": "GT" },
          { "name": "Guernsey", "code": "GG" },
          { "name": "Guinea", "code": "GN" },
          { "name": "Guinea-Bissau", "code": "GW" },
          { "name": "Guyana", "code": "GY" },
          { "name": "Haiti", "code": "HT" },
          { "name": "Heard Island and Mcdonald Islands", "code": "HM" },
          { "name": "Holy See (Vatican City State)", "code": "VA" },
          { "name": "Honduras", "code": "HN" },
          { "name": "Hong Kong", "code": "HK" },
          { "name": "Hungary", "code": "HU" },
          { "name": "Iceland", "code": "IS" },
          { "name": "India", "code": "IN" },
          { "name": "Indonesia", "code": "ID" },
          { "name": "Iran, Islamic Republic Of", "code": "IR" },
          { "name": "Iraq", "code": "IQ" },
          { "name": "Ireland", "code": "IE" },
          { "name": "Isle of Man", "code": "IM" },
          { "name": "Israel", "code": "IL" },
          { "name": "Italy", "code": "IT" },
          { "name": "Jamaica", "code": "JM" },
          { "name": "Japan", "code": "JP" },
          { "name": "Jersey", "code": "JE" },
          { "name": "Jordan", "code": "JO" },
          { "name": "Kazakhstan", "code": "KZ" },
          { "name": "Kenya", "code": "KE" },
          { "name": "Kiribati", "code": "KI" },
          { "name": "Korea, Democratic People'S Republic of", "code": "KP" },
          { "name": "Korea, Republic of", "code": "KR" },
          { "name": "Kuwait", "code": "KW" },
          { "name": "Kyrgyzstan", "code": "KG" },
          { "name": "Lao People'S Democratic Republic", "code": "LA" },
          { "name": "Latvia", "code": "LV" },
          { "name": "Lebanon", "code": "LB" },
          { "name": "Lesotho", "code": "LS" },
          { "name": "Liberia", "code": "LR" },
          { "name": "Libyan Arab Jamahiriya", "code": "LY" },
          { "name": "Liechtenstein", "code": "LI" },
          { "name": "Lithuania", "code": "LT" },
          { "name": "Luxembourg", "code": "LU" },
          { "name": "Macao", "code": "MO" },
          { "name": "Macedonia, The Former Yugoslav Republic of", "code": "MK" },
          { "name": "Madagascar", "code": "MG" },
          { "name": "Malawi", "code": "MW" },
          { "name": "Malaysia", "code": "MY" },
          { "name": "Maldives", "code": "MV" },
          { "name": "Mali", "code": "ML" },
          { "name": "Malta", "code": "MT" },
          { "name": "Marshall Islands", "code": "MH" },
          { "name": "Martinique", "code": "MQ" },
          { "name": "Mauritania", "code": "MR" },
          { "name": "Mauritius", "code": "MU" },
          { "name": "Mayotte", "code": "YT" },
          { "name": "Mexico", "code": "MX" },
          { "name": "Micronesia, Federated States of", "code": "FM" },
          { "name": "Moldova, Republic of", "code": "MD" },
          { "name": "Monaco", "code": "MC" },
          { "name": "Mongolia", "code": "MN" },
          { "name": "Montenegro", "code": "ME" },
          { "name": "Montserrat", "code": "MS" },
          { "name": "Morocco", "code": "MA" },
          { "name": "Mozambique", "code": "MZ" },
          { "name": "Myanmar", "code": "MM" },
          { "name": "Namibia", "code": "NA" },
          { "name": "Nauru", "code": "NR" },
          { "name": "Nepal", "code": "NP" },
          { "name": "Netherlands", "code": "NL" },
          { "name": "Netherlands Antilles", "code": "AN" },
          { "name": "New Caledonia", "code": "NC" },
          { "name": "New Zealand", "code": "NZ" },
          { "name": "Nicaragua", "code": "NI" },
          { "name": "Niger", "code": "NE" },
          { "name": "Nigeria", "code": "NG" },
          { "name": "Niue", "code": "NU" },
          { "name": "Norfolk Island", "code": "NF" },
          { "name": "Northern Mariana Islands", "code": "MP" },
          { "name": "Norway", "code": "NO" },
          { "name": "Oman", "code": "OM" },
          { "name": "Pakistan", "code": "PK" },
          { "name": "Palau", "code": "PW" },
          { "name": "Palestinian Territory, Occupied", "code": "PS" },
          { "name": "Panama", "code": "PA" },
          { "name": "Papua New Guinea", "code": "PG" },
          { "name": "Paraguay", "code": "PY" },
          { "name": "Peru", "code": "PE" },
          { "name": "Philippines", "code": "PH" },
          { "name": "Pitcairn", "code": "PN" },
          { "name": "Poland", "code": "PL" },
          { "name": "Portugal", "code": "PT" },
          { "name": "Puerto Rico", "code": "PR" },
          { "name": "Qatar", "code": "QA" },
          { "name": "Reunion", "code": "RE" },
          { "name": "Romania", "code": "RO" },
          { "name": "Russian Federation", "code": "RU" },
          { "name": "RWANDA", "code": "RW" },
          { "name": "Saint Helena", "code": "SH" },
          { "name": "Saint Kitts and Nevis", "code": "KN" },
          { "name": "Saint Lucia", "code": "LC" },
          { "name": "Saint Pierre and Miquelon", "code": "PM" },
          { "name": "Saint Vincent and the Grenadines", "code": "VC" },
          { "name": "Samoa", "code": "WS" },
          { "name": "San Marino", "code": "SM" },
          { "name": "Sao Tome and Principe", "code": "ST" },
          { "name": "Saudi Arabia", "code": "SA" },
          { "name": "Senegal", "code": "SN" },
          { "name": "Serbia", "code": "RS" },
          { "name": "Seychelles", "code": "SC" },
          { "name": "Sierra Leone", "code": "SL" },
          { "name": "Singapore", "code": "SG" },
          { "name": "Slovakia", "code": "SK" },
          { "name": "Slovenia", "code": "SI" },
          { "name": "Solomon Islands", "code": "SB" },
          { "name": "Somalia", "code": "SO" },
          { "name": "South Africa", "code": "ZA" },
          { "name": "South Georgia and the South Sandwich Islands", "code": "GS" },
          { "name": "Spain", "code": "ES" },
          { "name": "Sri Lanka", "code": "LK" },
          { "name": "Sudan", "code": "SD" },
          { "name": "Suriname", "code": "SR" },
          { "name": "Svalbard and Jan Mayen", "code": "SJ" },
          { "name": "Swaziland", "code": "SZ" },
          { "name": "Sweden", "code": "SE" },
          { "name": "Switzerland", "code": "CH" },
          { "name": "Syrian Arab Republic", "code": "SY" },
          { "name": "Taiwan, Province of China", "code": "TW" },
          { "name": "Tajikistan", "code": "TJ" },
          { "name": "Tanzania, United Republic of", "code": "TZ" },
          { "name": "Thailand", "code": "TH" },
          { "name": "Timor-Leste", "code": "TL" },
          { "name": "Togo", "code": "TG" },
          { "name": "Tokelau", "code": "TK" },
          { "name": "Tonga", "code": "TO" },
          { "name": "Trinidad and Tobago", "code": "TT" },
          { "name": "Tunisia", "code": "TN" },
          { "name": "Turkey", "code": "TR" },
          { "name": "Turkmenistan", "code": "TM" },
          { "name": "Turks and Caicos Islands", "code": "TC" },
          { "name": "Tuvalu", "code": "TV" },
          { "name": "Uganda", "code": "UG" },
          { "name": "Ukraine", "code": "UA" },
          { "name": "United Arab Emirates", "code": "AE" },
          { "name": "United Kingdom", "code": "GB" },
          { "name": "United States", "code": "US" },
          { "name": "United States Minor Outlying Islands", "code": "UM" },
          { "name": "Uruguay", "code": "UY" },
          { "name": "Uzbekistan", "code": "UZ" },
          { "name": "Vanuatu", "code": "VU" },
          { "name": "Venezuela", "code": "VE" },
          { "name": "Viet Nam", "code": "VN" },
          { "name": "Virgin Islands, British", "code": "VG" },
          { "name": "Virgin Islands, U.S.", "code": "VI" },
          { "name": "Wallis and Futuna", "code": "WF" },
          { "name": "Western Sahara", "code": "EH" },
          { "name": "Yemen", "code": "YE" },
          { "name": "Zambia", "code": "ZM" },
          { "name": "Zimbabwe", "code": "ZW" }
        ]
      );



      let reportTypes = await reportType.create(
        [
          {
            "reportName_en": "spam",
            "reportName_ar": "مؤذي"
          }, {
            "reportName_en": "sexual content",
            "reportName_ar": "محتوى جنسي"
          }, {
            "reportName_en": "promotional content",
            "reportName_ar": "محتوى ترويجي"
          }, {
            "reportName_en": "wrong classification",
            "reportName_ar": "تصنيف خاطئ"
          }, {
            "reportName_en": "illegal content",
            "reportName_ar": "محتوى غير قانوني"
          }
        ]);


      let users = await User.create([
        {
          email: 'admin@vobble.com',
          password: 'password',
          emailVerified: true,
          status: "active",
          gender: "male",
          image: images[0],
          username: "admin",
          ISOCode: "CC",
          nextRefill: date
        },
        {
          email: 'customer1@vobble.com',
          password: 'password',
          emailVerified: true,
          status: "active",
          gender: "male",
          image: images[0],
          createdAt: "2012-05-03T23:56:42.924Z",
          username: "customer1",
          ISOCode: "BF",
          nextRefill: date

        },
        {
          email: 'customer2@vobble.com',
          password: 'password',
          emailVerified: true,
          status: "active",
          gender: "male",
          createdAt: "2018-05-09T23:56:42.924Z",
          image: images[0],
          username: "customer2",
          ISOCode: "BD",
          nextRefill: date
        }
      ]);
      // console.log('Created users:', users);

      let shores = await shore.create([
        {
          name_en: "Main Shore",
          name_ar: "الشط الرئيسي",
          icon: images[2],
          cover: images[1],
        },
        {
          name_en: "Love Shore",
          name_ar: "شط الحب",
          icon: images[3],
          cover: images[1],
        },
        {
          name_en: "FadFed Shore",
          name_ar: "شط الفضفضى",
          icon: images[4],
          cover: images[1],
        }
      ]);
      let loveShore = shores.find(o => o.name_en === 'Love Shore');
      let fadfedShore = shores.find(o => o.name_en === 'FadFed Shore');
      let mainShore = shores.find(o => o.name_en === 'Main Shore');




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

      typesGood = await typeGoods.create(
        [
          {
            "name_en": "Bottles Packs",
            "name_ar": "زجاجات",
            "id" : "5b13ee987fe59d9d184bfe3e"
          }, {
            "name_en": "Filter By Gender",
            "name_ar": "تصنيف حسب الجنس",
            "id" : "5b13ee987fe59d9d184bfe3f"            
          }, {
            "name_en": "Filter By Country",
            "name_ar": "تصنيف حسب البلد",
            "id" : "5b13ee987fe59d9d184bfe40"            
          }
        ]);

      let bottleType = typesGood.find(o => o.name_en === 'Bottles Packs');
      let genderType = typesGood.find(q => q.name_en === 'Filter By Gender');
      let countryType = typesGood.find(s => s.name_en === 'Filter By Country');

      await product.create([
        {
          "name_ar": "زجاجة واحدة",
          "name_en": "1 bottles",
          "bottleCount": 1,
          "price": "5000",
          "description": "description",
          "icon": iconProduct[0],
          "androidProduct": "string",
          "appleProduct": "string",
          "typeGoodsId": bottleType.id
        },
        {
          "name_ar": "3 زجاجات",
          "name_en": "3 bottles",
          "price": "9000",
          "bottleCount": 3,
          "description": "description",
          "icon": iconProduct[0],
          "androidProduct": "string",
          "appleProduct": "string",
          "typeGoodsId": bottleType.id
        },
        {
          "name_ar": "5 زجاجات",
          "name_en": "5 bottles",
          "bottleCount": 5,
          "price": "13000",
          "description": "description",
          "icon": iconProduct[0],
          "androidProduct": "string",
          "appleProduct": "string",
          "typeGoodsId": bottleType.id
        },
        {
          "name_ar": "فلترة لمدة 24 ساعة",
          "name_en": "filter for 24 hours",
          "price": "6000",
          "validity": 24,
          "description": "description",
          "icon": iconProduct[1],
          "androidProduct": "string",
          "appleProduct": "string",
          "typeGoodsId": genderType.id
        },
        {
          "name_ar": "فلترة لمدة 48 ساعة",
          "name_en": "filter for 24 hours",
          "price": "10000",
          "validity": 48,
          "description": "description",
          "icon": iconProduct[1],
          "androidProduct": "string",
          "appleProduct": "string",
          "typeGoodsId": genderType.id
        },
        {
          "name_ar": "فلترة لمدة 24 ساعة",
          "name_en": "filter for 24 hours",
          "price": "6000",
          "validity": 24,          
          "description": "description",
          "icon": iconProduct[1],
          "androidProduct": "string",
          "appleProduct": "string",
          "typeGoodsId": countryType.id
        },
        {
          "name_ar": "فلترة لمدة 48 ساعة",
          "name_en": "filter for 24 hours",
          "price": "10000",
          "validity": 48,
          "description": "description",
          "icon": iconProduct[1],
          "androidProduct": "string",
          "appleProduct": "string",
          "typeGoodsId": countryType.id
        }
      ])



      await bottle.create([
        {
          "file": files[0],
          "thumbnail": thumble[0],
          "createdAt": "2018-05-03T23:56:42.924Z",
          "shoreId": loveShore.id,
          "ownerId": customer.id,
          "weight": 9920533014003,

        },
        {
          "file": files[0],
          "thumbnail": thumble[0],
          "createdAt": "2018-05-03T23:56:42.924Z",
          "shoreId": loveShore.id,
          "ownerId": customer.id,
          "weight": 9920533014003,
          "status": "deactivate"
        },
        {
          "file": files[1],
          "thumbnail": thumble[1],
          "createdAt": "2018-01-03T23:56:42.924Z",
          "shoreId": loveShore.id,
          "ownerId": customer2.id,
          "weight": 10648712214003,
        },
        {
          "file": files[2],
          "thumbnail": thumble[2],
          "createdAt": "2015-05-03T23:56:42.924Z",
          "weight": 9636449814003,
          "shoreId": mainShore.id,
          "ownerId": customer.id
        }

      ])
      console.log('seedData: DONE!');
    }

  } catch (err) {
    console.log(err)
    throw err;
  }
};




