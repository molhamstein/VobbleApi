'use strict';

module.exports = function (Conversation) {

  var serviceAccount = require("../../server/boot/serviceAccountKey.json");

  let config = {
    apiKey: serviceAccount.firebaseApiKey,
    authDomain: "<vobble-1521577974841>.firebaseapp.com",
    projectId: "<vobble-1521577974841>",
    databaseURL: "https://<vobble-1521577974841>.firebaseio.com",
  };

  var firebase = require('firebase');

  if (!firebase.apps.length) {
    firebase.initializeApp(config);
  }

  var admin = require("firebase-admin");


  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: "https://vobble-1521577974841.firebaseio.com"
  });

  var db = admin.database();
  var ref = db.ref("conversations");

  // ref.orderByChild("expired").equalTo(0).once("value", function (snapshot) {
  //   var now = new Date()
  //   var lastweak = new Date(now.getTime() - (5 * 24 * 60 * 60 * 1000));
  //   console.log("lastweak")
  //   console.log(lastweak)
  //   console.log(snapshot.length);
  //   snapshot.forEach(function (child) {
  //     var conv = child.val();
  //     conv['key'] = child.key;
  //     if ((new Date(conv['createdAt']).getTime() < lastweak.getTime() && (conv['finishTime'] == 0 || conv['finishTime'] == null)) || (conv['finishTime'] != 0 && conv['finishTime'] != null && new Date(conv['finishTime']).getTime() < now.getTime())) {
  //       console.log("yes")
  //       let del_ref = admin.database().ref("conversations/" + conv.key);
  //       del_ref.remove()
  //         .then(function () {})
  //         .catch(function (error) {});
  //       Conversation.getDataSource().connector.connect(function (err, maindb) {
  //         var collection = maindb.collection('conversation');
  //         collection.insert(conv)
  //       })
  //     }
  //   });
  // });

  Conversation.makeChatWithbot = function (userId) {
    Conversation.app.models.User.findOne({
      "where": {
        "email": "vobbleapp@gmail.com"
      }
    }, function (err, viboUser) {
      if (err)
        console.log(err)
      else {
        Conversation.app.models.User.findById(userId, function (err, secUSer) {
          if (err)
            console.log(err)
          else {
            console.log(secUSer)
            var startTime = new Date().getTime();
            var finishTime = new Date(startTime + 24 * 60 * 60 * 1000).getTime()
            var tempData = {
              "bottle": {
                "file": "http://159.65.202.38:3000/api/uploadFiles/videos/download/3e6941e0-a172-11e9-8f1c-615828d459555c20efce1fdaf7443965a6421562584765694.mp4",
                "owner": JSON.parse(JSON.stringify(viboUser)),
                "ownerId": viboUser['id'].toString(),
                "repliesUserCount": 0,
                "shore": {
                  "cover": "http://159.65.202.38:3000/api/uploadFiles/images/download/41638b00-b1c0-11e8-812c-6bf5583f03a65b6382c483436e3b070dff9b1536229992367.jpg",
                  "icon": "http://159.65.202.38:3000/api/uploadFiles/images/download/43e79dd0-b1c0-11e8-812c-6bf5583f03a65b6382c483436e3b070dff9b1536229996589.jpg",
                  "id": "5b6382c483436e3b070dff9c",
                  "name_ar": "استكشف",
                  "name_en": "Explore"
                },
                "shoreId": "5b6382c483436e3b070dff9c",
                "status": "active",
                "thumbnail": "http://159.65.202.38:3000/api/uploadFiles/thumbnail/download/3e6941e0-a172-11e9-8f1c-615828d459555c20efce1fdaf7443965a6421562584765694_thumb.PNG"
              },
              "createdAt": startTime,
              "expired": 0,
              "is_seen": 1,
              "is_replay_blocked": 1,
              "startTime": startTime,
              "finishTime": finishTime,
              "updatedAt": startTime,
              "user": JSON.parse(JSON.stringify(secUSer)),
              "user1ChatMute": false,
              "user1ID": viboUser['id'].toString(),
              "user1LastSeenMessageId": "",
              "user1_unseen": 1,
              "user2ChatMute": false,
              "user2ID": userId.toString(),
              "user2LastSeenMessageId": "",
              "user2_unseen": 1,
            }

            var postsRef = ref;
            var newPostRef = postsRef.push();
            newPostRef.set(tempData);
            var messages = [
              "اهلا بك في تطبیق Vibo الجدید \n\n هنا یمكنك التعرف على أصدقاء جدد عن طریق البحث عن فیدیوهاتهم في البحر من زر \"ابحث\" و ارسال ردك لهم لتبدأ المحادثة بشكل خاص بینكم ( دردشة صوتیة،شات، صور وفیدیو )",
              "قم ب تصویر فیدیو قصیر ورمیه للبحر من زر \"ارمي\" یمكنك رمي اي محتوى فیدیو للبحر مثلا: ( أفكارك، مواهبك،ارائك، هوایاتك وایضا لحظات حیاتك الیومیة ، نكت، الغاز ) \n\nبشرط ان لا تخل في قوانین المحتوى وان تظهر بشكل واضح مع صوتك في الفیدیو وبالتأكید سیجدها أحدهم ویقوم بالرد علیك , \n\nانتبه لدیك عدد محدد من الفیدیوهات المجانیة یومیاً :)",
              "قوانین المحتوى وشروط الاستخدام: \n\n لضمان بقائك معنا في التطبیق ولكي تصل فیدیوهاتك لباقي المستخدمین.. \n\n - یرجى عدم تصویر اي فیدیوهات ذات محتوى جنسي \n\n - یرجى عدم التطرق لاي محتوى سیاسي او دیني یثیر الخلاف بین المستخدمین \n\n- جودة الفیدیو تساعد في انتشاره بین المستخدمین.",
              "یمكنك التبلیغ عن اي فیدیو بالضغط على النقاط في اعلى شاشة عرض الفیدیو و سنقوم بالتعامل معه على الفور \n\n في حال كان لدیك اي اقتراح او استفسار لاتتردد بالتواصل معنا على برید الدعم من زر الاعدادات خیار \"تواصل معنا\" \n شكرا لك \nفریق عمل Vibo"
            ]
            console.log("newPostRef.key");
            console.log(newPostRef.key);
            messages.forEach(element => {
              var postsMesRef = db.ref("conversations/" + newPostRef.key + "/messages");
              var newPostMesRef = postsMesRef.push({
                "senderId": viboUser['id'].toString(),
                "senderName": viboUser.username,
                "text": element
              });
            });
          }
        })
      }
    })

  }
  Conversation.testUser = function (userId, cb) {}
};
