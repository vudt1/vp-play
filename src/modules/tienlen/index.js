'use strict';

const card = require('./domain/card');
const combination = require('./domain/combination');
const deal = require('./domain/deal');
const playRules = require('./domain/playRules');
const scoring = require('./domain/scoring');
const { createRoomTable, ROOM_IDS, MAX_SEATS } = require('./rooms/roomTable');
const { attachTienlenSockets } = require('./sockets');

module.exports = {
  card,
  combination,
  deal,
  playRules,
  scoring,
  createRoomTable,
  ROOM_IDS,
  MAX_SEATS,
  attachTienlenSockets,
};
