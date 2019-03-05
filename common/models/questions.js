'use strict';

module.exports = function (Questions) {
  Questions.validatesInclusionOf('status', {
    in: ['active', 'inactive']
  });

};
