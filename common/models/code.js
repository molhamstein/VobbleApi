'use strict';

module.exports = function(Code) {
    Code.validatesInclusionOf('status', { in: ['active', 'used']
});

};
