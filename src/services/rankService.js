'use strict';

const { topRanks } = require('./userService');

function getTop(limit = 10) {
  return topRanks(limit);
}

module.exports = { getTop };
