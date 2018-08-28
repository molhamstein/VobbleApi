
const cError = require('./cError');

module.exports.account = {
  authorizationRequired: function () {
    return new cError('AUTHORIZATION_REQUIRED', 401, 'Authorization Required', 401);
  },
  accessDenied: function () {
    return new cError('ACCESS_DENIED', 403, 'Access Denied', 403);
  },
  notFound: function () {
    return new cError('NOT_FOUND', 404, 'User not found', 409);
  },
  notActive: function () {
    return new cError('NOT_ACTIVE_USER', 403, 'User not active', 403);
  },
  emailNotValid: function () {
    return new cError('EMAIL_NOT_VALID', 400, 'Email not valid', 400);
  },
  usernameNotValid: function () {
    return new cError('USERNAME_NOT_VALID', 405, 'Username not valid', 405);
  },
  emailAlreadyExists: function () {
    return new cError('EMAIL_ALREADY_EXISTS',413, 'Email already exists', 413);
  },
  emailAlreadyExistsSN: function () {
    return new cError('EMAIL_ALREADY_EXISTS_SN',412, 'Email already exists SN', 412);
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


// module.exports.global = {
//   notInEnum: function (nameError,messageError) {
//     return new cError('NOT_IN_ENUM_'+nameError, 409, 'not in enum '+messageError, 409);
//   }
// };

module.exports.block = {
  alreadyIsBlocked: function () {
    return new cError('ALREADY_IS_BLOCKED', 409, 'already is blocked', 409);
  },
  noBlocked : function () {
    return new cError('NO_BLOCKED', 410, 'no blocked', 410);
  }
};


module.exports.product = {
  productNotFound: function () {
    return new cError('PRODUCT_NOT_FOUND', 411, 'product not found', 411);
  }
};

