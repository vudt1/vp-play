'use strict';

const { verifyAccessToken } = require('../auth/keycloakVerify');

function createSocketAuthMiddleware() {
  return async (socket, next) => {
    try {
      const token =
        socket.handshake.auth?.token ||
        (socket.handshake.headers.authorization || '').replace(/^Bearer\s+/i, '');
      const verified = await verifyAccessToken(token);
      if (!verified.ok) {
        return next(new Error(verified.message || 'Unauthorized'));
      }
      socket.data.player = verified.player;
      socket.data.token = token;
      return next();
    } catch (_e) {
      return next(new Error('Unauthorized'));
    }
  };
}

module.exports = { createSocketAuthMiddleware };
