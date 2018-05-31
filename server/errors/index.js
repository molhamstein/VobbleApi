const cError = require('./cError');

module.exports.account = {
  authorizationRequired: function () {
    return new cError('AUTHORIZATION_REQUIRED', 401, 'Authorization Required', 401);
  },
  accessDenied: function () {
    return new cError('ACCESS_DENIED', 403, 'Access Denied', 403);
  },
  notFound: function () {
    return new cError('NOT_FOUND', 404, 'User not found', 404);
  },
  notActive: function () {
    return new cError('NOT_ACTIVE_USER', 403, 'User not active', 403);
  },
  emailNotValid: function () {
    return new cError('EMAIL_NOT_VALID', 400, 'Email not valid', 400);
  },
  usernameNotValid: function () {
    return new cError('USERNAME_NOT_VALID', 405, 'Username not valid', 405);
  }
};




module.exports.bottle = {
  noAvailableBottleToday: function () {
    return new cError('NOT_AVAILABLE_BOTTLE_TODAY', 408, 'not available bottle today', 408);
  },
  noNewBottle: function () {
    return new cError('NO_NEW_BOTTLE', 406, 'no new bottle', 406);
  }
};

