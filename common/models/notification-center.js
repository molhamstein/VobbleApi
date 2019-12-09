'use strict';

module.exports = function (Notificationcenter) {
  Notificationcenter.initNotificationCenter = function (ownerId) {
    var notification = {
      "ownerId": ownerId,
      "title": "Welcome to vibo",
      "text": "اهلا بك في تطبیق Vibo الجدید \n\n هنا یمكنك التعرف على أصدقاء جدد عن طریق البحث عن فیدیوهاتهم في البحر من زر \"ابحث\" و ارسال ردك لهم لتبدأ المحادثة بشكل خاص بینكم ( دردشة صوتیة،شات، صور وفیدیو )\n\n\n ب تصویر فیدیو قصیر ورمیه للبحر من زر \"ارمي\" یمكنك رمي اي محتوى فیدیو للبحر مثلا: ( أفكارك، مواهبك،ارائك، هوایاتك وایضا لحظات حیاتك الیومیة ، نكت، الغاز ) \n\nبشرط ان لا تخل في قوانین المحتوى وان تظهر بشكل واضح مع صوتك في الفیدیو وبالتأكید سیجدها أحدهم ویقوم بالرد علیك , \n\nانتبه لدیك عدد محدد من الفیدیوهات المجانیة یومیاً :)\n\n\nقوانین المحتوى وشروط الاستخدام: \n\n لضمان بقائك معنا في التطبیق ولكي تصل فیدیوهاتك لباقي المستخدمین.. \n\n - یرجى عدم تصویر اي فیدیوهات ذات محتوى جنسي \n\n - یرجى عدم التطرق لاي محتوى سیاسي او دیني یثیر الخلاف بین المستخدمین \n\n- جودة الفیدیو تساعد في انتشاره بین المستخدمین.\n\n\n التبلیغ عن اي فیدیو بالضغط على النقاط في اعلى شاشة عرض الفیدیو و سنقوم بالتعامل معه على الفور \n\n في حال كان لدیك اي اقتراح او استفسار لاتتردد بالتواصل معنا على برید الدعم من زر الاعدادات خیار \"تواصل معنا\" \n شكرا لك \nفریق عمل Vibo"
    }
    Notificationcenter.create(notification, function (err, data) {

    })
  }

  Notificationcenter.getMyCenterNotification = function (context, callback) {
    var userId = context.req.accessToken.userId;
    Notificationcenter.find({
      "where": {
        ownerId: userId
      }
    }, function (err, data) {
      if (err)
        return callback(err)
      callback(null, data)
    })
  }

  Notificationcenter.makeNotificationSeen = function (notificationIds, context, callback) {
    var userId = context.req.accessToken.userId;
    //console.log(userId)
    //console.log(notificationIds)
    Notificationcenter.updateAll({
      id: {
        inq: notificationIds
      }
    }, {
      "isSeen": true
    }, function (err, data) {
      if (err)
        return callback(err)
      callback(null, 200)
    })

    // Notificationcenter.find({
    //   "where": {
    //     ownerId: userId
    //   }
    // }, function (err, data) {
    //   if (err)
    //     return callback(err)
    //   callback(null, data)
    // })
  }


};
