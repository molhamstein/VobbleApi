const cError = require('./cError');

module.exports.account = {
  authorizationRequired: function () {
    return new cError('AUTHORIZATION_REQUIRED', 401, 'Authorization Required', 401);
  },
  accessDenied: function () {
    return new cError('ACCESS_DENIED', 402, 'Access Denied', 403);
  },
  notFound: function () {
    return new cError('NOT_FOUND', 403, 'User not found', 404);
  },
  notActive: function () {
    return new cError('NOT_ACTIVE_USER', 404, 'User not active', 403);
  },
  emailNotValid: function () {
    return new cError('EMAIL_NOT_VALID', 400, 'Email not valid', 400);
  }
};




module.exports.bottle = {
  noNewBottle: function () {
    return new cError('NO_NEW_BOTTLE', 200, 'no new bottle', 405);
  },
  noAvailableBottleToday: function () {
    return new cError('NOT_AVAILABLE_BOTTLE_TODAY', 200, 'not available bottle today', 406);
  }
};

