'use strict';

const { createRoomTable } = require('./rooms/roomTable');
const { applyPoints } = require('../../services/userService');
const { createSocketAuthMiddleware } = require('../../sockets/authMiddleware');
const { env } = require('../../config/env');

function attachLotoSockets(io) {
  const nsp = io.of('/loto');
  nsp.use(createSocketAuthMiddleware());

  const table = createRoomTable({
    reconnectMs: env.reconnectMs,
    drawMs: env.drawMs,
    kinhCooldownMs: env.kinhCooldownMs,
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
      const r = table.reconnect(player());
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
          emitRoundAborted(nsp, roomId, result.abortReason);
        }
        broadcastRoom(nsp, table, roomId);
      }
      reply(ack, socket, result);
    });

    socket.on('round:prepare_tickets', (_payload, ack) => {
      const result = table.prepareTickets(socket.data.player.pccuid);
      if (!result.ok) return reply(ack, socket, result);
      broadcastRoom(nsp, table, result.room.id);
      reply(ack, socket, result);
    });

    socket.on('round:select_ticket', (payload, ack) => {
      const result = table.selectTicket(socket.data.player.pccuid, payload?.ticketId ?? null);
      if (!result.ok) return reply(ack, socket, result);
      broadcastRoom(nsp, table, result.room.id);
      reply(ack, socket, result);
    });

    socket.on('round:start', (_payload, ack) => {
      const result = table.start(socket.data.player.pccuid);
      if (!result.ok) return reply(ack, socket, result);
      broadcastRoom(nsp, table, result.room.id);
      reply(ack, socket, result);
    });

    socket.on('round:submit_kinh', (_payload, ack) => {
      const pccuid = socket.data.player.pccuid;
      const roomId = table.findPlayerRoom(pccuid);
      // Include submitter: nsp.to(room) skips the sender socket.
      if (roomId != null) {
        nsp.in(roomChannel(roomId)).emit('round:player_checking_kinh', { pccuid });
      }
      const result = table.submitKinh(pccuid);
      if (result.finished) {
        nsp.to(roomChannel(roomId)).emit('round:over', {
          ...result.finished,
          room: result.room,
        });
        broadcastRoom(nsp, table, roomId);
        return reply(ack, socket, result);
      }
      if (!result.ok) {
        socket.emit('round:error', result.error);
        if (result.room && roomId != null) {
          broadcastRoom(nsp, table, roomId);
        }
        return reply(ack, socket, result);
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
        const r = table.reconnect({
          ...other.data.player,
          socketId: other.id,
        });
        if (r.ok) {
          other.join(roomChannel(roomId));
          broadcastRoom(nsp, table, roomId);
        }
        return;
      }

      const result = table.disconnect(pccuid);
      if (result.aborted) {
        emitRoundAborted(nsp, roomId, result.abortReason);
      }
      broadcastRoom(nsp, table, roomId);
    });
  });

  const timer = setInterval(() => {
    const events = table.tick(Date.now());
    for (const ev of events) {
      if (ev.type === 'drawn') {
        nsp.to(roomChannel(ev.roomId)).emit('round:number_drawn', {
          number: ev.number,
          drawnNumbers: ev.drawnNumbers,
          nextDrawAt: ev.nextDrawAt,
        });
        continue;
      }
      const room = ev.room || ev.result?.room;
      if (!room) continue;
      if (ev.type === 'aborted' || ev.result?.aborted) {
        emitRoundAborted(nsp, room.id, ev.result?.abortReason || ev.abortReason);
        broadcastRoom(nsp, table, room.id);
      } else if (ev.type === 'leave' && ev.result?.aborted) {
        emitRoundAborted(nsp, room.id, ev.result.abortReason);
        broadcastRoom(nsp, table, room.id);
      } else if (room.id != null) {
        broadcastRoom(nsp, table, room.id);
      }
    }
  }, 250);

  io.engine.on('close', () => clearInterval(timer));

  return { table, nsp, timer };
}

function roomChannel(roomId) {
  return `room:${roomId}`;
}

function emitRoundAborted(nsp, roomId, reason) {
  nsp.to(roomChannel(roomId)).emit('round:aborted', {
    reason: reason || 'solo',
  });
}

function broadcastRoom(nsp, table, roomId) {
  nsp.emit('room:list', table.list());
  for (const s of nsp.sockets.values()) {
    if (!s.rooms.has(roomChannel(roomId))) continue;
    const pccuid = s.data?.player?.pccuid;
    const room = table.publicRoom(roomId, pccuid);
    if (room) s.emit('room:state', room);
  }
}

function reply(ack, socket, result) {
  if (typeof ack === 'function') ack(result);
  else if (!result.ok) socket.emit('round:error', result.error);
}

module.exports = { attachLotoSockets };
