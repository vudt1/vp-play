'use strict';

const {
  BOARD_SIZE,
  createEmptyBoard,
  isValidMove,
  checkWin,
  isBoardFull,
} = require('./domain/caroRules');
const { createRoomTable, ROOM_IDS, MAX_SEATS } = require('./rooms/roomTable');

let attachCaroSockets;
try {
  attachCaroSockets = require('./sockets').attachCaroSockets;
} catch (_) {
  attachCaroSockets = undefined;
}

module.exports = {
  BOARD_SIZE,
  createEmptyBoard,
  isValidMove,
  checkWin,
  isBoardFull,
  createRoomTable,
  ROOM_IDS,
  MAX_SEATS,
  attachCaroSockets,
};
