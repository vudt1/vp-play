'use strict';

const { THREE_SPADES } = require('../domain/card');
const { validatePlay } = require('../domain/playRules');
const { deal } = require('../domain/deal');
const { pointsForFinish } = require('../domain/scoring');

const ROOM_IDS = [1, 2, 3];
const MAX_SEATS = 4;

function createRoomTable(options = {}) {
  const turnTimeoutMs = options.turnTimeoutMs ?? 15_000;
  const reconnectMs = options.reconnectMs ?? 60_000;
  const random = options.random ?? Math.random;
  const onSettle = options.onSettle ?? (async () => {});

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
    if (!room) return err('ROOM_NOT_FOUND', 'Room not found');
    if (playerIndex.has(player.pccuid)) {
      const current = playerIndex.get(player.pccuid);
      if (current === roomId) return ok({ room: publicRoom(room) });
      return err('ALREADY_IN_ROOM', 'Already seated in another room');
    }
    if (room.phase === 'playing' || room.phase === 'settling') {
      return err('ROOM_BUSY', 'Hand in progress');
    }
    if (room.seats.length >= MAX_SEATS) return err('ROOM_FULL', 'Room is full');

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
    if (roomId == null) return err('NOT_IN_ROOM', 'Not in a room');
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
    if (!seat) return err('NOT_IN_ROOM', 'Not in a room');

    seat.connected = false;
    seat.disconnectedUntil = 0;
    playerIndex.delete(pccuid);

    room.seats = room.seats.filter((s) => s.pccuid !== pccuid);
    reassignHost(room);

    if (room.seats.length < 2) {
      room.hand = null;
      room.phase = room.seats.length === 0 ? 'idle' : 'waiting';
      if (room.seats.length === 0) {
        Object.assign(room, emptyRoom(room.id));
      }
      return ok({ room: publicRoom(room), aborted: true });
    }

    if (room.hand) {
      delete room.hand.hands[pccuid];
      room.hand.finishOrder = room.hand.finishOrder.filter((id) => id !== pccuid);
      room.hand.active = room.hand.active.filter((id) => id !== pccuid);
      if (room.hand.currentTurn === pccuid) {
        advanceTurn(room);
      }
      if (room.hand.active.length <= 1) {
        return finalizeHand(room);
      }
    }
    return ok({ room: publicRoom(room) });
  }

  function start(pccuid) {
    const roomId = playerIndex.get(pccuid);
    if (roomId == null) return err('NOT_IN_ROOM', 'Not in a room');
    const room = rooms.get(roomId);
    if (room.hostPccuid !== pccuid) return err('NOT_HOST', 'Only host can start');
    if (room.phase !== 'waiting' && room.phase !== 'idle') {
      return err('BAD_PHASE', 'Cannot start now');
    }
    if (room.seats.length < 2 || room.seats.length > 4) {
      return err('BAD_COUNT', 'Need 2–4 players');
    }

    const { hands } = deal(room.seats.length, random);
    const handMap = {};
    const active = [];
    room.seats.forEach((seat, i) => {
      handMap[seat.pccuid] = hands[i];
      active.push(seat.pccuid);
    });

    let opener = active.find((id) => handMap[id].includes(THREE_SPADES));
    if (!opener) opener = active[0];

    room.phase = 'playing';
    room.hand = {
      hands: handMap,
      active: [...active],
      finishOrder: [],
      currentTurn: opener,
      lastCombo: null,
      lastPlayer: null,
      freeLead: true,
      mustInclude3s: true,
      ringPassed: new Set(),
      turnDeadline: Date.now() + turnTimeoutMs,
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
    if (hand.currentTurn !== pccuid) return err('NOT_YOUR_TURN', 'Not your turn');

    const cards = Array.isArray(cardIds) ? cardIds.map(Number) : [];
    const held = hand.hands[pccuid];
    if (!cards.every((c) => held.includes(c)) || new Set(cards).size !== cards.length) {
      return err('CARDS_NOT_HELD', 'You do not hold those cards');
    }

    const result = validatePlay(cards, {
      lastCombo: hand.freeLead ? null : hand.lastCombo,
      freeLead: hand.freeLead,
      mustInclude3s: hand.mustInclude3s && hand.freeLead,
    });
    if (!result.ok) return err(result.code, result.message);

    hand.hands[pccuid] = held.filter((c) => !cards.includes(c));
    hand.lastCombo = result.combo;
    hand.lastPlayer = pccuid;
    hand.freeLead = false;
    hand.mustInclude3s = false;
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
    if (hand.currentTurn !== pccuid) return err('NOT_YOUR_TURN', 'Not your turn');
    if (hand.freeLead) return err('CANNOT_PASS', 'Cannot pass on free lead');

    hand.ringPassed.add(pccuid);
    const need = hand.active.length - 1;
    if (hand.ringPassed.size >= need) {
      let winner = hand.lastPlayer;
      if (!winner || !hand.active.includes(winner)) {
        winner = nextActive(hand, pccuid);
      }
      hand.lastCombo = null;
      hand.lastPlayer = null;
      hand.freeLead = true;
      hand.ringPassed = new Set();
      hand.currentTurn = winner;
      hand.turnDeadline = Date.now() + turnTimeoutMs;
      return ok({ room: publicRoom(room), ringWonBy: hand.currentTurn });
    }

    advanceTurn(room);
    return ok({ room: publicRoom(room) });
  }

  function disconnect(pccuid, now = Date.now()) {
    const roomId = playerIndex.get(pccuid);
    if (roomId == null) return err('NOT_IN_ROOM', 'Not in a room');
    const room = rooms.get(roomId);
    const seat = room.seats.find((s) => s.pccuid === pccuid);
    if (!seat) return err('NOT_IN_ROOM', 'Not in a room');
    seat.connected = false;
    seat.socketId = null;
    seat.disconnectedUntil = now + reconnectMs;
    return ok({ room: publicRoom(room) });
  }

  function reconnect(player, now = Date.now()) {
    const roomId = playerIndex.get(player.pccuid);
    if (roomId == null) return err('NOT_IN_ROOM', 'Not in a room');
    const room = rooms.get(roomId);
    const seat = room.seats.find((s) => s.pccuid === player.pccuid);
    if (!seat) return err('NOT_IN_ROOM', 'Not in a room');
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
          autoLeadLowest(room);
          events.push({ type: 'auto-lead', pccuid: turn, room: publicRoom(room) });
        } else {
          const r = pass(turn);
          events.push({ type: 'auto-pass', pccuid: turn, result: r });
        }
      }
    }
    return events;
  }

  function autoLeadLowest(room) {
    const { hand } = room;
    const cards = hand.hands[hand.currentTurn];
    if (!cards || cards.length === 0) return;
    let pick = [cards[0]];
    if (hand.mustInclude3s && cards.includes(THREE_SPADES)) {
      pick = [THREE_SPADES];
    }
    play(hand.currentTurn, pick);
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
    if (roomId == null) return err('NOT_IN_ROOM', 'Not in a room');
    const room = rooms.get(roomId);
    if (room.phase !== 'playing' || !room.hand) return err('BAD_PHASE', 'No hand in progress');
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
    Promise.resolve(onSettle(payload)).catch(() => {});
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
            mustInclude3s: hand.mustInclude3s,
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
