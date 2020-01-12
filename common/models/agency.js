'use strict';

module.exports = function(Agency) {
    Agency.validatesInclusionOf('status', { in: ['active', 'deactive']
});

};
