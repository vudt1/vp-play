'use strict';

const { createSocketAuthMiddleware } = require('./authMiddleware');
const { attachTienlenSockets } = require('../modules/tienlen/sockets');
const { attachCaroSockets } = require('../modules/caro/sockets');
const { attachLotoSockets } = require('../modules/loto/sockets');

function attachSockets(io) {
  io.use(createSocketAuthMiddleware());

  const tienlen = attachTienlenSockets(io);
  const caro = attachCaroSockets(io);
  const loto = attachLotoSockets(io);
  return { tienlen, caro, loto };
}

module.exports = { attachSockets };
