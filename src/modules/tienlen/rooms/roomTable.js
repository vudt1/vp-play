'use strict';

const { validatePlay } = require('../domain/playRules');
const { deal } = require('../domain/deal');
const { pointsForFinish } = require('../domain/scoring');


const ROOM_IDS = [1, 2, 3];
const MAX_SEATS = 4;

function createRoomTable(options = {}) {
  const turnTimeoutMs = options.turnTimeoutMs ?? 30_000;
  const dealGraceMs = options.dealGraceMs ?? 8_000;
  const reconnectMs = options.reconnectMs ?? 60_000;
  const random = options.random ?? Math.random;
  const onSettle = options.onSettle ?? (async () => { });

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
      hand: null,
    };
  }

  function list() {
    return ROOM_IDS.map((id) => publicRoom(rooms.get(id)));
  }

  function findPlayerRoom(pccuid) {
    return playerIndex.get(pccuid) ?? null;
  }

  function join(player, roomId) {
    const room = rooms.get(roomId);
    if (!room) return err('ROOM_NOT_FOUND', 'Không tìm thấy phòng chơi');
    if (playerIndex.has(player.pccuid)) {
      const current = playerIndex.get(player.pccuid);
      if (current === roomId) return ok({ room: publicRoom(room) });
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
      disconnectedUntil: null,
    });
    if (!room.hostPccuid) room.hostPccuid = player.pccuid;
    if (room.phase === 'idle') room.phase = 'waiting';
    playerIndex.set(player.pccuid, roomId);
    return ok({ room: publicRoom(room) });
  }

  function leave(pccuid) {
    const roomId = playerIndex.get(pccuid);
    if (roomId == null) return err('NOT_IN_ROOM', 'Chưa chọn phòng chơi');
    const room = rooms.get(roomId);

    if (room.phase === 'playing' || room.phase === 'settling') {
      return forceLeaveMidHand(room, pccuid);
    }

    room.seats = room.seats.filter((s) => s.pccuid !== pccuid);
    playerIndex.delete(pccuid);
    reassignHost(room);
    if (room.seats.length === 0) {
      Object.assign(room, emptyRoom(roomId));
    }
    return ok({ room: publicRoom(room) });
  }

  function forceLeaveMidHand(room, pccuid) {
    const seat = room.seats.find((s) => s.pccuid === pccuid);
    if (!seat) return err('NOT_IN_ROOM', 'Chưa vào phòng');

    seat.connected = false;
    seat.disconnectedUntil = 0;
    playerIndex.delete(pccuid);

    room.seats = room.seats.filter((s) => s.pccuid !== pccuid);
    reassignHost(room);

    if (room.seats.length < 2) {
      return abortHand(room, room.seats.length === 0 ? 'empty' : 'solo');
    }

    if (room.hand) {
      delete room.hand.hands[pccuid];
      room.hand.active = room.hand.active.filter((id) => id !== pccuid);
      if (room.hand.ringPassed) room.hand.ringPassed.delete(pccuid);
      if (room.hand.lastPlayer === pccuid) room.hand.lastPlayer = null;
      if (room.hand.currentTurn === pccuid) {
        if (room.hand.freeLead) {
          skipFreeLeadTurn(room);
        } else {
          advanceTurn(room);
        }
      }
      if (room.hand.active.length <= 1) {
        return finalizeHand(room);
      }
      closeRingIfNeeded(room);
    }
    return ok({ room: publicRoom(room) });
  }

  function abortHand(room, reason) {
    room.hand = null;
    room.phase = room.seats.length === 0 ? 'idle' : 'waiting';
    if (room.seats.length === 0) {
      Object.assign(room, emptyRoom(room.id));
    }
    return ok({
      room: publicRoom(room),
      aborted: true,
      abortReason: reason,
    });
  }

  function start(pccuid) {
    const roomId = playerIndex.get(pccuid);
    if (roomId == null) return err('NOT_IN_ROOM', 'Bạn chưa chọn phòng để chơi');
    const room = rooms.get(roomId);
    if (room.hostPccuid !== pccuid) return err('NOT_HOST', 'Chỉ chủ phòng mới có thể bắt đầu');
    if (room.phase !== 'waiting' && room.phase !== 'idle') {
      return err('BAD_PHASE', 'Không thể bắt đầu bây giờ');
    }
    if (room.seats.length < 2 || room.seats.length > 4) {
      return err('BAD_COUNT', 'Cần 2–4 người chơi');
    }

    const { hands } = deal(room.seats.length, random);
    const handMap = {};
    const active = [];
    room.seats.forEach((seat, i) => {
      handMap[seat.pccuid] = hands[i];
      active.push(seat.pccuid);
    });

    let openingCardId = Infinity;
    let opener = active[0];
    for (const id of active) {
      for (const c of handMap[id]) {
        if (c < openingCardId) {
          openingCardId = c;
          opener = id;
        }
      }
    }

    room.phase = 'playing';
    room.hand = {
      hands: handMap,
      active: [...active],
      finishOrder: [],
      currentTurn: opener,
      openerPccuid: opener,
      lastCombo: null,
      lastPlayer: null,
      freeLead: true,
      openingCardId,
      mustIncludeOpening: true,
      ringPassed: new Set(),
      turnDeadline: Date.now() + turnTimeoutMs + dealGraceMs,
    };

    return ok({
      room: publicRoom(room),
      dealt: Object.fromEntries(active.map((id) => [id, [...handMap[id]]])),
    });
  }

  function play(pccuid, cardIds) {
    const room = requirePlayerPlaying(pccuid);
    if (room.error) return room;
    const { hand } = room;
    if (hand.currentTurn !== pccuid) return err('NOT_YOUR_TURN', 'Không phải lượt của bạn');

    const cards = Array.isArray(cardIds) ? cardIds.map(Number) : [];
    const held = hand.hands[pccuid];
    if (!cards.every((c) => held.includes(c)) || new Set(cards).size !== cards.length) {
      return err('CARDS_NOT_HELD', 'Không giữ quân bài này');
    }

    const result = validatePlay(cards, {
      lastCombo: hand.freeLead ? null : hand.lastCombo,
      freeLead: hand.freeLead,
      mustIncludeCardId:
        hand.mustIncludeOpening &&
        hand.freeLead &&
        hand.currentTurn === hand.openerPccuid
          ? hand.openingCardId
          : null,
    });
    if (!result.ok) return err(result.code, result.message);

    hand.hands[pccuid] = held.filter((c) => !cards.includes(c));
    hand.lastCombo = result.combo;
    hand.lastPlayer = pccuid;
    hand.freeLead = false;
    hand.mustIncludeOpening = false;
    hand.ringPassed = new Set();
    hand.turnDeadline = Date.now() + turnTimeoutMs;

    const emptied = hand.hands[pccuid].length === 0;
    if (emptied) {
      hand.finishOrder.push(pccuid);
      hand.active = hand.active.filter((id) => id !== pccuid);
      if (hand.active.length <= 1) {
        return finalizeHand(room);
      }
    }

    advanceTurn(room);
    return ok({ room: publicRoom(room), emptied });
  }

  function pass(pccuid) {
    const room = requirePlayerPlaying(pccuid);
    if (room.error) return room;
    const { hand } = room;
    if (hand.currentTurn !== pccuid) return err('NOT_YOUR_TURN', 'Không phải lượt của bạn');
    if (hand.freeLead) return err('CANNOT_PASS', 'Không thể bỏ lượt khi mở bài');

    hand.ringPassed.add(pccuid);
    if (closeRingIfNeeded(room)) {
      return ok({ room: publicRoom(room), ringWonBy: hand.currentTurn });
    }

    advanceTurn(room);
    return ok({ room: publicRoom(room) });
  }

  function closeRingIfNeeded(room) {
    const { hand } = room;
    if (!hand || hand.freeLead) return false;
    const need = hand.active.length - 1;
    if (need < 1 || hand.ringPassed.size < need) return false;
    let winner = hand.lastPlayer;
    if (!winner || !hand.active.includes(winner)) {
      winner = nextActive(hand, hand.currentTurn);
    }
    hand.lastCombo = null;
    hand.lastPlayer = null;
    hand.freeLead = true;
    hand.ringPassed = new Set();
    hand.currentTurn = winner;
    hand.turnDeadline = Date.now() + turnTimeoutMs;
    return true;
  }

  function disconnect(pccuid, now = Date.now()) {
    const roomId = playerIndex.get(pccuid);
    if (roomId == null) return err('NOT_IN_ROOM', 'Chưa chọn phòng chơi');
    const room = rooms.get(roomId);
    const seat = room.seats.find((s) => s.pccuid === pccuid);
    if (!seat) return err('NOT_IN_ROOM', 'Chưa vào phòng chơi');
    seat.connected = false;
    seat.socketId = null;
    seat.disconnectedUntil = now + reconnectMs;
    return ok({ room: publicRoom(room) });
  }

  function reconnect(player, now = Date.now()) {
    const roomId = playerIndex.get(player.pccuid);
    if (roomId == null) return err('NOT_IN_ROOM', 'Chưa chọn phòng chơi');
    const room = rooms.get(roomId);
    const seat = room.seats.find((s) => s.pccuid === player.pccuid);
    if (!seat) return err('NOT_IN_ROOM', 'Chưa chọn phòng chơi');
    if (!seat.connected && seat.disconnectedUntil != null && now > seat.disconnectedUntil) {
      return leave(player.pccuid);
    }
    seat.connected = true;
    seat.socketId = player.socketId || seat.socketId;
    seat.disconnectedUntil = null;
    seat.displayName = player.displayName || seat.displayName;
    return ok({
      room: publicRoom(room),
      privateHand: room.hand ? [...(room.hand.hands[player.pccuid] || [])] : null,
    });
  }

  function tick(now = Date.now()) {
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
      if (room.phase === 'playing' && room.hand && now >= room.hand.turnDeadline) {
        const turn = room.hand.currentTurn;
        if (room.hand.freeLead) {
          const r = skipFreeLead(turn);
          events.push({ type: 'free-lead-skip', pccuid: turn, result: r });
        } else {
          const r = pass(turn);
          events.push({ type: 'auto-pass', pccuid: turn, result: r });
        }
      }
    }
    return events;
  }

  function skipFreeLead(pccuid) {
    const room = requirePlayerPlaying(pccuid);
    if (room.error) return room;
    const { hand } = room;
    if (hand.currentTurn !== pccuid) return err('NOT_YOUR_TURN', 'Không phải lượt của bạn');
    if (!hand.freeLead) return err('BAD_PHASE', 'Chỉ bỏ free lead khi mở bài');
    skipFreeLeadTurn(room);
    return ok({ room: publicRoom(room), freeLeadSkipped: true });
  }

  function skipFreeLeadTurn(room) {
    const { hand } = room;
    if (hand.mustIncludeOpening && hand.currentTurn === hand.openerPccuid) {
      hand.mustIncludeOpening = false;
    }
    hand.currentTurn = nextActive(hand, hand.currentTurn);
    hand.turnDeadline = Date.now() + turnTimeoutMs;
  }

  function getPrivateHand(pccuid) {
    const roomId = playerIndex.get(pccuid);
    if (roomId == null) return null;
    const room = rooms.get(roomId);
    if (!room.hand) return null;
    return room.hand.hands[pccuid] ? [...room.hand.hands[pccuid]] : null;
  }

  function requirePlayerPlaying(pccuid) {
    const roomId = playerIndex.get(pccuid);
    if (roomId == null) return err('NOT_IN_ROOM', 'Chưa vào phòng chơi');
    const room = rooms.get(roomId);
    if (room.phase !== 'playing' || !room.hand) return err('BAD_PHASE', 'Không có ván bài đang diễn ra');
    return room;
  }

  function advanceTurn(room) {
    const { hand } = room;
    hand.currentTurn = nextActive(hand, hand.currentTurn);
    hand.turnDeadline = Date.now() + turnTimeoutMs;
  }

  function nextActive(hand, fromPccuid) {
    const order = hand.active;
    if (order.length === 0) return null;
    const idx = order.indexOf(fromPccuid);
    const start = idx === -1 ? 0 : (idx + 1) % order.length;
    for (let i = 0; i < order.length; i += 1) {
      const candidate = order[(start + i) % order.length];
      if (!hand.ringPassed.has(candidate)) return candidate;
    }
    return order[start];
  }

  function reassignHost(room) {
    if (room.seats.length === 0) {
      room.hostPccuid = null;
      return;
    }
    if (!room.seats.some((s) => s.pccuid === room.hostPccuid)) {
      room.hostPccuid = room.seats[0].pccuid;
    }
  }

  function finalizeHand(room) {
    const { hand } = room;
    const remaining = hand.active.filter((id) => (hand.hands[id] || []).length > 0);
    for (const id of remaining) {
      if (!hand.finishOrder.includes(id)) hand.finishOrder.push(id);
    }
    const playerCount = hand.finishOrder.length;
    const deltas = pointsForFinish(hand.finishOrder, playerCount);
    const payload = {
      finishOrder: [...hand.finishOrder],
      pointsDelta: deltas,
    };
    Promise.resolve(onSettle(payload)).catch(() => { });
    room.hand = null;
    room.phase = room.seats.length === 0 ? 'idle' : 'waiting';
    return ok({ room: publicRoom(room), finished: payload });
  }

  function publicRoom(room) {
    const hand = room.hand;
    return {
      id: room.id,
      phase: room.phase,
      hostPccuid: room.hostPccuid,
      seats: room.seats.map((s) => ({
        pccuid: s.pccuid,
        displayName: s.displayName,
        connected: s.connected,
      })),
      hand: hand
        ? {
          currentTurn: hand.currentTurn,
          freeLead: hand.freeLead,
          openingCardId: hand.openingCardId,
          openerPccuid: hand.openerPccuid,
          mustIncludeOpening:
            hand.mustIncludeOpening && hand.currentTurn === hand.openerPccuid,
          lastCombo: hand.lastCombo
            ? { type: hand.lastCombo.type, cards: hand.lastCombo.cards, topCard: hand.lastCombo.topCard, length: hand.lastCombo.length, pairCount: hand.lastCombo.pairCount }
            : null,
          ringPassed: [...hand.ringPassed],
          finishOrder: [...hand.finishOrder],
          cardCounts: Object.fromEntries(
            Object.entries(hand.hands).map(([id, cards]) => [id, cards.length])
          ),
          turnDeadline: hand.turnDeadline,
          active: [...hand.active],
        }
        : null,
    };
  }

  return {
    list,
    join,
    leave,
    start,
    play,
    pass,
    disconnect,
    reconnect,
    tick,
    getPrivateHand,
    findPlayerRoom,
    ROOM_IDS,
  };
}

function ok(data) {
  return { ok: true, ...data };
}

function err(code, message) {
  return { ok: false, error: { code, message } };
}

module.exports = { createRoomTable, ROOM_IDS, MAX_SEATS };
