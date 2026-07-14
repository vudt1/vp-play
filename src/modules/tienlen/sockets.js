'use strict';

const { createRoomTable } = require('./rooms/roomTable');
const { applyPoints } = require('../../services/userService');
const { env } = require('../../config/env');

function attachTienlenSockets(io) {
  const table = createRoomTable({
    turnTimeoutMs: env.turnTimeoutMs,
    dealGraceMs: env.dealGraceMs,
    reconnectMs: env.reconnectMs,
    onSettle: async (payload) => {
      applyPoints(payload.pointsDelta);
      io.emit('rank:updated', { pointsDelta: payload.pointsDelta });
    },
  });

  io.on('connection', (socket) => {
    const player = () => ({
      ...socket.data.player,
      socketId: socket.id,
    });

    socket.emit('room:list', table.list());

    const existing = table.findPlayerRoom(socket.data.player.pccuid);
    if (existing != null) {
      const r = table.reconnect(player());
      if (r.ok) {
        socket.join(roomChannel(existing));
        broadcastRoom(io, table, existing);
        if (r.privateHand) {
          socket.emit('hand:dealt', { cards: r.privateHand });
        }
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
      broadcastRoom(io, table, roomId);
      reply(ack, socket, result);
    });

    socket.on('room:leave', (_payload, ack) => {
      const roomId = table.findPlayerRoom(socket.data.player.pccuid);
      const result = table.leave(socket.data.player.pccuid);
      if (roomId != null) {
        socket.leave(roomChannel(roomId));
        if (result.aborted) {
          emitHandAborted(io, roomId, result.abortReason);
        }
        broadcastRoom(io, table, roomId);
        if (result.finished) {
          io.to(roomChannel(roomId)).emit('hand:finished', result.finished);
        }
      }
      reply(ack, socket, result);
    });

    socket.on('room:start', (_payload, ack) => {
      const result = table.start(socket.data.player.pccuid);
      if (!result.ok) return reply(ack, socket, result);
      const roomId = result.room.id;
      broadcastRoom(io, table, roomId);
      if (result.dealt) {
        for (const [pccuid, cards] of Object.entries(result.dealt)) {
          emitToPlayer(io, pccuid, 'hand:dealt', { cards });
        }
      }
      reply(ack, socket, { ok: true, room: result.room });
    });

    socket.on('hand:sync', (_payload, ack) => {
      const cards = table.getPrivateHand(socket.data.player.pccuid);
      if (cards == null) {
        return reply(ack, socket, {
          ok: false,
          error: { code: 'NO_HAND', message: 'Không có bài để đồng bộ' },
        });
      }
      reply(ack, socket, { ok: true, cards });
    });

    socket.on('hand:play', (payload, ack) => {
      const pccuid = socket.data.player.pccuid;
      const roomId = table.findPlayerRoom(pccuid);
      const result = table.play(pccuid, payload?.cardIds || []);
      if (!result.ok) {
        socket.emit('hand:error', result.error);
        return reply(ack, socket, result);
      }
      if (roomId != null) broadcastRoom(io, table, roomId);
      if (result.finished) {
        io.to(roomChannel(roomId)).emit('hand:finished', result.finished);
      } else {
        emitPrivateHand(io, table, pccuid);
      }
      reply(ack, socket, result);
    });

    socket.on('hand:pass', (_payload, ack) => {
      const pccuid = socket.data.player.pccuid;
      const roomId = table.findPlayerRoom(pccuid);
      const result = table.pass(pccuid);
      if (!result.ok) {
        socket.emit('hand:error', result.error);
        return reply(ack, socket, result);
      }
      if (roomId != null) broadcastRoom(io, table, roomId);
      if (result.finished) {
        io.to(roomChannel(roomId)).emit('hand:finished', result.finished);
      }
      reply(ack, socket, result);
    });

    socket.on('disconnect', () => {
      const pccuid = socket.data.player.pccuid;
      const roomId = table.findPlayerRoom(pccuid);
      if (roomId == null) return;
      let other = null;
      for (const s of io.sockets.sockets.values()) {
        if (s.id !== socket.id && s.data?.player?.pccuid === pccuid) {
          other = s;
          break;
        }
      }
      if (other) {
        const r = table.reconnect({
          ...other.data.player,
          socketId: other.id,
        });
        if (r.ok) {
          other.join(roomChannel(roomId));
          broadcastRoom(io, table, roomId);
          if (r.privateHand) {
            other.emit('hand:dealt', { cards: r.privateHand });
          }
        }
        return;
      }
      table.disconnect(pccuid);
      broadcastRoom(io, table, roomId);
    });
  });

  const timer = setInterval(() => {
    const events = table.tick(Date.now());
    for (const ev of events) {
      const room = ev.room || ev.result?.room;
      if (room) {
        if (ev.result?.aborted) {
          emitHandAborted(io, room.id, ev.result.abortReason);
        }
        broadcastRoom(io, table, room.id);
        if (ev.result?.finished) {
          io.to(roomChannel(room.id)).emit('hand:finished', ev.result.finished);
        }
      }
    }
  }, 1000);

  io.engine.on('close', () => clearInterval(timer));

  return { table, timer };
}

function roomChannel(roomId) {
  return `room:${roomId}`;
}

function emitHandAborted(io, roomId, reason) {
  io.to(roomChannel(roomId)).emit('hand:aborted', {
    reason: reason || 'solo',
  });
}

function broadcastRoom(io, table, roomId) {
  const room = table.list().find((r) => r.id === roomId);
  if (!room) return;
  io.to(roomChannel(roomId)).emit('room:state', room);
  io.emit('room:list', table.list());
}

function emitToPlayer(io, pccuid, event, payload) {
  for (const s of io.sockets.sockets.values()) {
    if (s.data?.player?.pccuid === pccuid) {
      s.emit(event, payload);
    }
  }
}

function emitPrivateHand(io, table, pccuid) {
  const cards = table.getPrivateHand(pccuid);
  if (cards == null) return;
  emitToPlayer(io, pccuid, 'hand:update', { cards });
}

function reply(ack, socket, result) {
  if (typeof ack === 'function') ack(result);
  else if (!result.ok) socket.emit('hand:error', result.error);
}

module.exports = { attachTienlenSockets };
