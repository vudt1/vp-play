'use strict';

const { createSocketAuthMiddleware } = require('./authMiddleware');
const { attachTienlenSockets } = require('../modules/tienlen/sockets');
const { attachCaroSockets } = require('../modules/caro/sockets');

function attachSockets(io) {
  io.use(createSocketAuthMiddleware());

  const tienlen = attachTienlenSockets(io);
  const caro = attachCaroSockets(io);
  return { tienlen, caro };
}

module.exports = { attachSockets };
