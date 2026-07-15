'use strict';

const {
  BOARD_SIZE,
  createEmptyBoard,
  isValidMove,
  checkWin,
  findWinLine,
  isBoardFull,
  cloneBoard,
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
  findWinLine,
  isBoardFull,
  cloneBoard,
  createRoomTable,
  ROOM_IDS,
  MAX_SEATS,
  attachCaroSockets,
};
