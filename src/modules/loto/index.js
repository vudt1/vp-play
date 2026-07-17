'use strict';

const rules = require('./domain/rules');
const {
  createRoomTable,
  ROOM_IDS,
  MAX_SEATS,
  TICKET_POOL_SIZE,
  WIN_POINTS,
} = require('./rooms/roomTable');

let attachLotoSockets;
try {
  attachLotoSockets = require('./sockets').attachLotoSockets;
} catch (_) {
  attachLotoSockets = undefined;
}

module.exports = {
  ...rules,
  createRoomTable,
  ROOM_IDS,
  MAX_SEATS,
  TICKET_POOL_SIZE,
  WIN_POINTS,
  attachLotoSockets,
};
