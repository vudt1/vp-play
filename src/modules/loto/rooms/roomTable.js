'use strict';

const path = require('path');
const rules = require('../domain/rules');

const ROOM_IDS = [1, 2];
const MAX_SEATS = 20;
const TICKET_POOL_SIZE = 40;
const WIN_POINTS = 10;

function loadDataset() {
  // eslint-disable-next-line import/no-dynamic-require, global-require
  return require(path.join(__dirname, '..', 'data', 'loto_dataset.json'));
}

function createRoomTable(options = {}) {
  const onSettle = options.onSettle ?? (async () => {});
  const reconnectMs = options.reconnectMs ?? 60_000;
  const drawMs = options.drawMs ?? 8_000;
  const kinhCooldownMs = options.kinhCooldownMs ?? 30_000;
  const dataset = options.dataset ?? loadDataset();
  const rng = options.rng ?? Math.random;
  const nowFn = options.now ?? Date.now;

  const rooms = new Map();
  for (const id of ROOM_IDS) {
    rooms.set(id, emptyRoom(id));
  }

  const playerIndex = new Map();

  function emptyRoom(id) {
    return {
      id,
      phase: 'idle',
      seats: [],
      hostPccuid: null,
      ticketPool: [],
      drawnNumbers: [],
      numberBag: [],
      nextDrawAt: null,
      drawingPaused: false,
      checkingPccuid: null,
      lastResult: null,
    };
  }

  function err(code, message, extra) {
    return { ok: false, error: { code, message, ...(extra || {}) } };
  }

  function ok(extra) {
    return { ok: true, ...extra };
  }

  function publicSeat(seat, now) {
    const cdUntil = seat.cooldownUntil || 0;
    return {
      pccuid: seat.pccuid,
      displayName: seat.displayName,
      connected: seat.connected,
      ticketId: seat.ticketId || null,
      cooldownUntil: cdUntil > now ? cdUntil : null,
    };
  }

  function lastResultPublic(room) {
    if (!room.lastResult) return null;
    return {
      result: room.lastResult.result,
      winnerId: room.lastResult.winnerId,
      winnerPccuid: room.lastResult.winnerPccuid,
      pointsDelta: { ...(room.lastResult.pointsDelta || {}) },
      reason: room.lastResult.reason || null,
      winningRows: room.lastResult.winningRows || [],
    };
  }

  function lobbyRoom(room) {
    const now = nowFn();
    return {
      id: room.id,
      phase: room.phase,
      seats: room.seats.map((s) => publicSeat(s, now)),
      hostPccuid: room.hostPccuid,
      ticketPool: [],
      drawnNumbers: [],
      nextDrawAt: null,
      checkingPccuid: room.checkingPccuid,
      lastResult: lastResultPublic(room),
      poolSize: (room.ticketPool || []).length,
    };
  }

  function publicRoom(room, viewerPccuid) {
    const now = nowFn();
    const waitingPick = room.phase === 'waiting' || room.phase === 'idle';
    const payload = {
      id: room.id,
      phase: room.phase,
      seats: room.seats.map((s) => publicSeat(s, now)),
      hostPccuid: room.hostPccuid,
      drawnNumbers: (room.drawnNumbers || []).slice(),
      nextDrawAt: room.nextDrawAt,
      checkingPccuid: room.checkingPccuid,
      lastResult: lastResultPublic(room),
      poolSize: (room.ticketPool || []).length,
      ticketPool: [],
      myTicket: null,
    };

    if (waitingPick) {
      payload.ticketPool = (room.ticketPool || []).map((t) => rules.publicTicketFull(t));
    } else if (viewerPccuid) {
      const seat = room.seats.find((s) => s.pccuid === viewerPccuid);
      const ticket = ticketForSeat(room, seat);
      payload.myTicket = rules.publicTicketFull(ticket);
    }

    return payload;
  }

  function list() {
    return ROOM_IDS.map((id) => lobbyRoom(rooms.get(id)));
  }

  function getPublicRoom(roomId, viewerPccuid) {
    const room = rooms.get(roomId);
    return room ? publicRoom(room, viewerPccuid) : null;
  }

  function findPlayerRoom(pccuid) {
    return playerIndex.get(pccuid) ?? null;
  }

  function reassignHost(room) {
    if (room.seats.some((s) => s.pccuid === room.hostPccuid)) return;
    room.hostPccuid = room.seats[0]?.pccuid ?? null;
  }

  function syncPhaseIdleWaiting(room) {
    if (room.phase === 'playing' || room.phase === 'settling') return;
    if (room.seats.length === 0) {
      Object.assign(room, emptyRoom(room.id));
      return;
    }
    room.phase = room.seats.length >= 2 ? 'waiting' : 'idle';
  }

  function clearRoundState(room, { keepTickets } = { keepTickets: false }) {
    room.drawnNumbers = [];
    room.numberBag = [];
    room.nextDrawAt = null;
    room.drawingPaused = false;
    room.checkingPccuid = null;
    if (!keepTickets) {
      room.ticketPool = [];
      for (const s of room.seats) {
        s.ticketId = null;
        s.cooldownUntil = 0;
      }
    } else {
      for (const s of room.seats) {
        s.cooldownUntil = 0;
      }
    }
  }

  function connectedCount(room) {
    return room.seats.filter((s) => s.connected).length;
  }

  function abortRound(room, reason) {
    clearRoundState(room, { keepTickets: true });
    room.lastResult = {
      result: 'abort',
      winnerId: null,
      winnerPccuid: null,
      pointsDelta: {},
      reason: reason || 'solo',
      winningRows: [],
    };
    if (room.seats.length === 0) {
      Object.assign(room, emptyRoom(room.id));
    } else if (room.seats.length === 1) {
      room.phase = 'idle';
    } else {
      room.phase = 'waiting';
    }
    return {
      ok: true,
      aborted: true,
      abortReason: reason || 'solo',
      room: publicRoom(room),
    };
  }

  function maybeAbortIfSolo(room) {
    if (room.phase !== 'playing' && room.phase !== 'settling') return null;
    if (connectedCount(room) >= 2 && room.seats.length >= 2) return null;
    return abortRound(room, room.seats.length < 2 ? 'solo' : 'disconnect');
  }

  function restoreSeat(player, room, seat) {
    seat.connected = true;
    seat.socketId = player.socketId || seat.socketId;
    seat.disconnectedUntil = null;
    seat.displayName = player.displayName || seat.displayName;
    return ok({ room: publicRoom(room, player.pccuid) });
  }

  function join(player, roomId) {
    const room = rooms.get(roomId);
    if (!room) return err('ROOM_NOT_FOUND', 'Không tìm thấy phòng chơi');
    if (playerIndex.has(player.pccuid)) {
      const current = playerIndex.get(player.pccuid);
      if (current === roomId) {
        const seat = room.seats.find((s) => s.pccuid === player.pccuid);
        if (!seat) return err('NOT_IN_ROOM', 'Chưa vào phòng');
        return restoreSeat(player, room, seat);
      }
      return err('ALREADY_IN_ROOM', 'Bạn đã ở trong phòng khác');
    }
    if (room.phase === 'playing' || room.phase === 'settling') {
      return err('ROOM_BUSY', 'Phòng đang có người chơi');
    }
    if (room.seats.length >= MAX_SEATS) return err('ROOM_FULL', 'Phòng đã đầy');

    room.seats.push({
      pccuid: player.pccuid,
      displayName: player.displayName || player.pccuid,
      socketId: player.socketId || null,
      connected: true,
      ticketId: null,
      disconnectedUntil: null,
      cooldownUntil: 0,
    });
    if (!room.hostPccuid) room.hostPccuid = player.pccuid;
    syncPhaseIdleWaiting(room);
    playerIndex.set(player.pccuid, roomId);
    return ok({ room: publicRoom(room, player.pccuid) });
  }

  function leave(pccuid) {
    const roomId = playerIndex.get(pccuid);
    if (roomId == null) return err('NOT_IN_ROOM', 'Chưa chọn phòng chơi');
    const room = rooms.get(roomId);

    room.seats = room.seats.filter((s) => s.pccuid !== pccuid);
    playerIndex.delete(pccuid);
    reassignHost(room);

    if (room.phase === 'playing' || room.phase === 'settling') {
      if (room.seats.length === 0) {
        Object.assign(room, emptyRoom(roomId));
        return {
          ok: true,
          aborted: true,
          abortReason: 'empty',
          room: publicRoom(room),
        };
      }
      const aborted = maybeAbortIfSolo(room);
      if (aborted) return aborted;
      return ok({ room: publicRoom(room) });
    }

    if (room.seats.length === 0) {
      Object.assign(room, emptyRoom(roomId));
    } else {
      syncPhaseIdleWaiting(room);
    }
    return ok({ room: publicRoom(room) });
  }

  function disconnect(pccuid, now = nowFn()) {
    const roomId = playerIndex.get(pccuid);
    if (roomId == null) return ok({});
    const room = rooms.get(roomId);
    const seat = room.seats.find((s) => s.pccuid === pccuid);
    if (!seat) return ok({});

    seat.connected = false;
    seat.socketId = null;
    seat.disconnectedUntil = now + reconnectMs;

    if (room.phase === 'playing' || room.phase === 'settling') {
      const aborted = maybeAbortIfSolo(room);
      if (aborted) return aborted;
    }
    return ok({ room: publicRoom(room) });
  }

  function reconnect(player, now = nowFn()) {
    const roomId = playerIndex.get(player.pccuid);
    if (roomId == null) return err('NOT_IN_ROOM', 'Chưa chọn phòng chơi');
    const room = rooms.get(roomId);
    const seat = room.seats.find((s) => s.pccuid === player.pccuid);
    if (!seat) return err('NOT_IN_ROOM', 'Chưa chọn phòng chơi');
    if (!seat.connected && seat.disconnectedUntil != null && now > seat.disconnectedUntil) {
      leave(player.pccuid);
      return err('SEAT_EXPIRED', 'Hết thời gian giữ chỗ');
    }
    return restoreSeat(player, room, seat);
  }

  function prepareTickets(pccuid) {
    const roomId = playerIndex.get(pccuid);
    if (roomId == null) return err('NOT_IN_ROOM', 'Chưa vào phòng');
    const room = rooms.get(roomId);
    if (room.hostPccuid !== pccuid) return err('NOT_HOST', 'Chỉ host được chuẩn bị vé');
    if (room.phase !== 'waiting' && room.phase !== 'idle') {
      return err('ROOM_BUSY', 'Không thể chuẩn bị vé lúc này');
    }
    if (room.seats.length < 2) return err('NEED_PLAYERS', 'Cần ít nhất 2 người');

    room.ticketPool = rules.pickRandomTickets(dataset, TICKET_POOL_SIZE, rng);
    for (const s of room.seats) {
      s.ticketId = null;
      s.cooldownUntil = 0;
    }
    room.drawnNumbers = [];
    room.numberBag = [];
    room.nextDrawAt = null;
    room.checkingPccuid = null;
    room.lastResult = null;
    room.phase = 'waiting';
    return ok({ room: publicRoom(room, pccuid) });
  }

  function selectTicket(pccuid, ticketId) {
    const roomId = playerIndex.get(pccuid);
    if (roomId == null) return err('NOT_IN_ROOM', 'Chưa vào phòng');
    const room = rooms.get(roomId);
    if (room.phase !== 'waiting' && room.phase !== 'idle') {
      return err('ROOM_BUSY', 'Không thể chọn vé lúc này');
    }
    if (!room.ticketPool.length) return err('NO_POOL', 'Chưa chuẩn bị vé');
    const seat = room.seats.find((s) => s.pccuid === pccuid);
    if (!seat) return err('NOT_IN_ROOM', 'Chưa vào phòng');

    if (ticketId == null || ticketId === '') {
      seat.ticketId = null;
      return ok({ room: publicRoom(room, pccuid) });
    }

    const ticket = room.ticketPool.find((t) => t.ticketId === ticketId);
    if (!ticket) return err('TICKET_NOT_FOUND', 'Vé không có trong pool');
    const taken = room.seats.find((s) => s.ticketId === ticketId && s.pccuid !== pccuid);
    if (taken) return err('TICKET_TAKEN', 'Vé đã được chọn');

    seat.ticketId = ticketId;
    return ok({ room: publicRoom(room, pccuid) });
  }

  function start(pccuid, now = nowFn()) {
    const roomId = playerIndex.get(pccuid);
    if (roomId == null) return err('NOT_IN_ROOM', 'Chưa vào phòng');
    const room = rooms.get(roomId);
    if (room.hostPccuid !== pccuid) return err('NOT_HOST', 'Chỉ host được bắt đầu');
    if (room.phase === 'playing' || room.phase === 'settling') {
      return err('ROOM_BUSY', 'Ván đang diễn ra');
    }
    if (room.seats.length < 2) return err('NEED_PLAYERS', 'Cần ít nhất 2 người');
    if (connectedCount(room) < 2) {
      return err('NEED_CONNECTED', 'Cần ít nhất 2 người đang kết nối');
    }
    if (!room.ticketPool.length) return err('NO_POOL', 'Chưa chuẩn bị vé');
    if (room.seats.some((s) => !s.ticketId)) {
      return err('TICKETS_INCOMPLETE', 'Mọi người phải chọn vé trước khi bắt đầu');
    }

    room.drawnNumbers = [];
    room.numberBag = rules.createNumberBag(90);
    room.drawingPaused = false;
    room.checkingPccuid = null;
    room.lastResult = null;
    for (const s of room.seats) s.cooldownUntil = 0;
    room.phase = 'playing';
    room.nextDrawAt = now + drawMs;
    return ok({ room: publicRoom(room, pccuid) });
  }

  function ticketForSeat(room, seat) {
    if (!seat?.ticketId) return null;
    return room.ticketPool.find((t) => t.ticketId === seat.ticketId) || null;
  }

  function settleWin(room, winnerSeat, winningRows) {
    const winnerId = winnerSeat.pccuid;
    const deltas = { [winnerId]: WIN_POINTS };
    const finished = {
      result: 'win',
      winnerId,
      winnerPccuid: winnerId,
      pointsDelta: deltas,
      reason: 'kinh',
      winningRows,
    };
    clearRoundState(room, { keepTickets: true });
    room.lastResult = finished;
    room.phase = room.seats.length >= 2 ? 'waiting' : 'idle';

    Promise.resolve(
      onSettle({
        pointsDelta: deltas,
        winnerId,
        winnerPccuid: winnerId,
      })
    ).catch(() => {});

    return ok({
      room: publicRoom(room, winnerId),
      finished,
    });
  }

  function submitKinh(pccuid, now = nowFn()) {
    const roomId = playerIndex.get(pccuid);
    if (roomId == null) return err('NOT_IN_ROOM', 'Chưa vào phòng');
    const room = rooms.get(roomId);
    if (room.phase !== 'playing') {
      return err('NOT_PLAYING', room.phase === 'settling' ? 'Đang kiểm tra Kinh' : 'Chưa bắt đầu rao');
    }
    const seat = room.seats.find((s) => s.pccuid === pccuid);
    if (!seat) return err('NOT_IN_ROOM', 'Chưa vào phòng');
    if (seat.cooldownUntil && now < seat.cooldownUntil) {
      return err('KINH_COOLDOWN', 'Đang cooldown sau Kinh sai', {
        cooldownUntil: seat.cooldownUntil,
      });
    }
    const ticket = ticketForSeat(room, seat);
    if (!ticket) return err('NO_TICKET', 'Chưa có vé');

    room.phase = 'settling';
    room.checkingPccuid = pccuid;
    room.drawingPaused = true;

    const verdict = rules.verifyKinh(room.drawnNumbers, ticket);
    if (verdict.win) {
      return settleWin(room, seat, verdict.winningRows);
    }

    seat.cooldownUntil = now + kinhCooldownMs;
    room.phase = 'playing';
    room.checkingPccuid = null;
    room.drawingPaused = false;
    if (room.nextDrawAt == null || room.nextDrawAt < now) {
      room.nextDrawAt = now + drawMs;
    }

    return {
      ok: false,
      error: {
        code: 'INVALID_KINH',
        message: verdict.message || 'Kinh không hợp lệ',
        cooldownUntil: seat.cooldownUntil,
      },
      room: publicRoom(room, pccuid),
    };
  }

  function drawStep(room, now) {
    if (room.phase !== 'playing' || room.drawingPaused) return null;
    if (room.nextDrawAt == null || now < room.nextDrawAt) return null;

    const num = rules.drawNextNumber(room.numberBag, rng);
    if (num == null) {
      const aborted = abortRound(room, 'full_bag');
      return { type: 'aborted', result: aborted };
    }
    room.drawnNumbers.push(num);
    room.nextDrawAt = now + drawMs;
    return {
      type: 'drawn',
      number: num,
      roomId: room.id,
      drawnNumbers: room.drawnNumbers.slice(),
      nextDrawAt: room.nextDrawAt,
    };
  }

  function tick(now = nowFn()) {
    const events = [];
    for (const room of rooms.values()) {
      for (const seat of [...room.seats]) {
        if (
          !seat.connected &&
          seat.disconnectedUntil != null &&
          now > seat.disconnectedUntil
        ) {
          const r = leave(seat.pccuid);
          events.push({ type: 'leave', pccuid: seat.pccuid, result: r });
        }
      }

      if (room.phase === 'playing' || room.phase === 'settling') {
        const solo = maybeAbortIfSolo(room);
        if (solo) {
          events.push({ type: 'aborted', result: solo });
          continue;
        }
      }

      const drawn = drawStep(room, now);
      if (drawn) events.push(drawn);
    }
    return events;
  }

  return {
    list,
    join,
    leave,
    disconnect,
    reconnect,
    prepareTickets,
    selectTicket,
    start,
    submitKinh,
    tick,
    findPlayerRoom,
    publicRoom: getPublicRoom,
    ROOM_IDS,
    MAX_SEATS,
    TICKET_POOL_SIZE,
    WIN_POINTS,
    drawMs,
    kinhCooldownMs,
    reconnectMs,
  };
}

module.exports = { createRoomTable, ROOM_IDS, MAX_SEATS, TICKET_POOL_SIZE, WIN_POINTS };
