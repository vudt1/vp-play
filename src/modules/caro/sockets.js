'use strict';

const { createRoomTable } = require('./rooms/roomTable');
const { applyPoints } = require('../../services/userService');
const { createSocketAuthMiddleware } = require('../../sockets/authMiddleware');

function attachCaroSockets(io) {
  const nsp = io.of('/caro');
  nsp.use(createSocketAuthMiddleware());

  const table = createRoomTable({
    onSettle: async (payload) => {
      applyPoints(payload.pointsDelta);
      io.emit('rank:updated', { pointsDelta: payload.pointsDelta });
    },
  });

  nsp.on('connection', (socket) => {
    const player = () => ({
      ...socket.data.player,
      socketId: socket.id,
    });

    socket.emit('room:list', table.list());

    const existing = table.findPlayerRoom(socket.data.player.pccuid);
    if (existing != null) {
      const r = table.rebindSocket(socket.data.player.pccuid, socket.id);
      if (r.ok) {
        socket.join(roomChannel(existing));
        broadcastRoom(nsp, table, existing);
      }
    }

    socket.on('room:list', (ack) => {
      const list = table.list();
      socket.emit('room:list', list);
      if (typeof ack === 'function') ack({ ok: true, rooms: list });
    });

    socket.on('room:join', (payload, ack) => {
      const roomId = Number(payload?.roomId);
      const result = table.join(player(), roomId);
      if (!result.ok) return reply(ack, socket, result);
      socket.join(roomChannel(roomId));
      broadcastRoom(nsp, table, roomId);
      reply(ack, socket, result);
    });

    socket.on('room:leave', (_payload, ack) => {
      const roomId = table.findPlayerRoom(socket.data.player.pccuid);
      const result = table.leave(socket.data.player.pccuid);
      if (roomId != null) {
        socket.leave(roomChannel(roomId));
        if (result.aborted) {
          emitMatchAborted(nsp, roomId, result.abortReason);
        }
        broadcastRoom(nsp, table, roomId);
        if (result.finished) {
          nsp.to(roomChannel(roomId)).emit('match:finished', result.finished);
        }
      }
      reply(ack, socket, result);
    });

    socket.on('room:start', (_payload, ack) => {
      const result = table.start(socket.data.player.pccuid);
      if (!result.ok) return reply(ack, socket, result);
      const roomId = result.room.id;
      broadcastRoom(nsp, table, roomId);
      reply(ack, socket, { ok: true, room: result.room });
    });

    socket.on('match:move', (payload, ack) => {
      const pccuid = socket.data.player.pccuid;
      const roomId = table.findPlayerRoom(pccuid);
      const row = Number(payload?.row);
      const col = Number(payload?.col);
      const result = table.move(pccuid, row, col);
      if (!result.ok) {
        socket.emit('match:error', result.error);
        return reply(ack, socket, result);
      }
      if (roomId != null && result.moved) {
        nsp.to(roomChannel(roomId)).emit('match:moved', result.moved);
        if (result.finished) {
          nsp.to(roomChannel(roomId)).emit('match:finished', {
            ...result.finished,
            room: result.room,
          });
        }
        broadcastRoom(nsp, table, roomId);
      }
      reply(ack, socket, result);
    });

    socket.on('disconnect', () => {
      const pccuid = socket.data.player.pccuid;
      const roomId = table.findPlayerRoom(pccuid);
      if (roomId == null) return;

      let other = null;
      for (const s of nsp.sockets.values()) {
        if (s.id !== socket.id && s.data?.player?.pccuid === pccuid) {
          other = s;
          break;
        }
      }
      if (other) {
        const r = table.rebindSocket(pccuid, other.id);
        if (r.ok) {
          other.join(roomChannel(roomId));
          broadcastRoom(nsp, table, roomId);
        }
        return;
      }

      const result = table.disconnect(pccuid);
      if (result.aborted) {
        emitMatchAborted(nsp, roomId, result.abortReason);
      }
      broadcastRoom(nsp, table, roomId);
    });
  });

  return { table, nsp };
}

function roomChannel(roomId) {
  return `room:${roomId}`;
}

function emitMatchAborted(nsp, roomId, reason) {
  nsp.to(roomChannel(roomId)).emit('match:aborted', {
    reason: reason || 'solo',
  });
}

function broadcastRoom(nsp, table, roomId) {
  const room = table.list().find((r) => r.id === roomId);
  if (!room) return;
  nsp.to(roomChannel(roomId)).emit('room:state', room);
  nsp.emit('room:list', table.list());
}

function reply(ack, socket, result) {
  if (typeof ack === 'function') ack(result);
  else if (!result.ok) socket.emit('match:error', result.error);
}

module.exports = { attachCaroSockets };
