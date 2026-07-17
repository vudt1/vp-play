'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { createRoomTable, ROOM_IDS, MAX_SEATS } = require('../../../../src/modules/loto/rooms/roomTable');

function miniDataset() {
  const tickets = [];
  for (let i = 1; i <= 50; i += 1) {
    tickets.push({
      ticketId: `T${i}`,
      theme: '#F4D03F',
      allNumbers: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
      matrices: [
        {
          matrixId: 'M1',
          rows: [
            [1, 2, 3, 4, 5, null, null, null, null],
            [6, 7, 8, 9, 10, null, null, null, null],
            [null, null, null, null, null, null, null, null, null],
          ],
        },
        { matrixId: 'M2', rows: [[null, null, null, null, null, null, null, null, null], [null, null, null, null, null, null, null, null, null], [null, null, null, null, null, null, null, null, null]] },
        { matrixId: 'M3', rows: [[null, null, null, null, null, null, null, null, null], [null, null, null, null, null, null, null, null, null], [null, null, null, null, null, null, null, null, null]] },
      ],
    });
  }
  return tickets;
}

function player(id, name) {
  return { pccuid: id, displayName: name || id, socketId: `s-${id}` };
}

function setupTwo() {
  let now = 1_000_000;
  const settles = [];
  const table = createRoomTable({
    dataset: miniDataset(),
    drawMs: 1000,
    kinhCooldownMs: 30_000,
    reconnectMs: 60_000,
    now: () => now,
    rng: () => 0.1,
    onSettle: (p) => settles.push(p),
  });
  return {
    table,
    settles,
    advance(ms) {
      now += ms;
    },
    get now() {
      return now;
    },
  };
}

describe('loto roomTable', () => {
  it('has 2 rooms and max 20 seats', () => {
    assert.deepEqual(ROOM_IDS, [1, 2]);
    assert.equal(MAX_SEATS, 20);
  });

  it('join → waiting at 2 players; host is first', () => {
    const { table } = setupTwo();
    const a = table.join(player('a', 'A'), 1);
    assert.equal(a.ok, true);
    assert.equal(a.room.phase, 'idle');
    const b = table.join(player('b', 'B'), 1);
    assert.equal(b.ok, true);
    assert.equal(b.room.phase, 'waiting');
    assert.equal(b.room.hostPccuid, 'a');
  });

  it('prepare 40 tickets; unique select; start requires all tickets', () => {
    const { table } = setupTwo();
    table.join(player('a'), 1);
    table.join(player('b'), 1);
    const prep = table.prepareTickets('a');
    assert.equal(prep.ok, true);
    assert.equal(prep.room.ticketPool.length, 40);

    const t0 = prep.room.ticketPool[0].ticketId;
    const t1 = prep.room.ticketPool[1].ticketId;
    assert.equal(table.selectTicket('a', t0).ok, true);
    assert.equal(table.selectTicket('b', t0).error.code, 'TICKET_TAKEN');
    assert.equal(table.selectTicket('b', t1).ok, true);

    const early = table.start('a');
    assert.equal(early.ok, true);
    assert.equal(early.room.phase, 'playing');
  });

  it('start rejects incomplete tickets', () => {
    const { table } = setupTwo();
    table.join(player('a'), 1);
    table.join(player('b'), 1);
    const prep = table.prepareTickets('a');
    table.selectTicket('a', prep.room.ticketPool[0].ticketId);
    const r = table.start('a');
    assert.equal(r.ok, false);
    assert.equal(r.error.code, 'TICKETS_INCOMPLETE');
  });

  it('Kinh win when drawn covers a row', () => {
    let now = 1000;
    const settles = [];
    const table = createRoomTable({
      dataset: miniDataset(),
      drawMs: 10,
      now: () => now,
      rng: () => 0, // always pick index 0 → sequential 1,2,3...
      onSettle: (p) => settles.push(p),
    });
    table.join(player('a'), 1);
    table.join(player('b'), 1);
    const prep = table.prepareTickets('a');
    const t0 = prep.room.ticketPool[0].ticketId;
    const t1 = prep.room.ticketPool[1].ticketId;
    table.selectTicket('a', t0);
    table.selectTicket('b', t1);
    table.start('a');

    for (let i = 0; i < 5; i += 1) {
      now += 20;
      table.tick(now);
    }
    const forA = table.publicRoom(1, 'a');
    assert.ok(forA.drawnNumbers.length >= 5);
    assert.deepEqual(forA.drawnNumbers.slice(0, 5), [1, 2, 3, 4, 5]);

    const kinh = table.submitKinh('a', now);
    assert.equal(kinh.ok, true);
    assert.equal(kinh.finished.result, 'win');
    assert.equal(kinh.finished.pointsDelta.a, 10);
    assert.equal(kinh.room.phase, 'waiting');
    assert.equal(kinh.room.seats.find((s) => s.pccuid === 'a').ticketId, t0);
    assert.equal(settles.length, 1);
  });

  it('invalid Kinh sets cooldown and resumes playing', () => {
    let now = 1000;
    const table = createRoomTable({
      dataset: miniDataset(),
      drawMs: 1000,
      kinhCooldownMs: 30_000,
      now: () => now,
      rng: () => 0,
    });
    table.join(player('a'), 1);
    table.join(player('b'), 1);
    const prep = table.prepareTickets('a');
    table.selectTicket('a', prep.room.ticketPool[0].ticketId);
    table.selectTicket('b', prep.room.ticketPool[1].ticketId);
    table.start('a');

    const bad = table.submitKinh('a', now);
    assert.equal(bad.ok, false);
    assert.equal(bad.error.code, 'INVALID_KINH');
    assert.equal(bad.room.phase, 'playing');
    assert.ok(bad.error.cooldownUntil > now);

    const again = table.submitKinh('a', now + 1000);
    assert.equal(again.error.code, 'KINH_COOLDOWN');
  });

  it('full bag aborts with no points', () => {
    let now = 1000;
    const table = createRoomTable({
      dataset: miniDataset(),
      drawMs: 1,
      now: () => now,
      rng: () => 0,
    });
    table.join(player('a'), 1);
    table.join(player('b'), 1);
    const prep = table.prepareTickets('a');
    table.selectTicket('a', prep.room.ticketPool[0].ticketId);
    table.selectTicket('b', prep.room.ticketPool[1].ticketId);
    table.start('a');

    let aborted = null;
    for (let i = 0; i < 120; i += 1) {
      now += 5;
      const events = table.tick(now);
      const ab = events.find((e) => e.type === 'aborted');
      if (ab) {
        aborted = ab;
        break;
      }
    }
    assert.ok(aborted);
    assert.equal(aborted.result.abortReason, 'full_bag');
    assert.equal(aborted.result.room.phase, 'waiting');
    assert.deepEqual(aborted.result.room.lastResult.pointsDelta, {});
  });

  it('leave mid-round with one seat aborts', () => {
    let now = 1000;
    const table = createRoomTable({
      dataset: miniDataset(),
      drawMs: 5000,
      now: () => now,
      rng: () => 0,
    });
    table.join(player('a'), 1);
    table.join(player('b'), 1);
    const prep = table.prepareTickets('a');
    table.selectTicket('a', prep.room.ticketPool[0].ticketId);
    table.selectTicket('b', prep.room.ticketPool[1].ticketId);
    table.start('a');
    const left = table.leave('b');
    assert.equal(left.aborted, true);
    assert.ok(left.room.phase === 'idle' || left.room.phase === 'waiting');
  });

  it('soft disconnect holds then expire leaves', () => {
    let now = 1000;
    const table = createRoomTable({
      dataset: miniDataset(),
      reconnectMs: 1000,
      drawMs: 10_000,
      now: () => now,
      rng: () => 0,
    });
    table.join(player('a'), 1);
    table.join(player('b'), 1);
    table.disconnect('b', now);
    assert.equal(table.list()[0].seats.length, 2);
    assert.equal(table.list()[0].seats.find((s) => s.pccuid === 'b').connected, false);

    now += 2000;
    const events = table.tick(now);
    assert.ok(events.some((e) => e.type === 'leave'));
    assert.equal(table.list()[0].seats.some((s) => s.pccuid === 'b'), false);
  });

  it('host migrates on leave', () => {
    const { table } = setupTwo();
    table.join(player('a'), 1);
    table.join(player('b'), 1);
    table.leave('a');
    assert.equal(table.list()[0].hostPccuid, 'b');
  });

  it('start requires 2 connected seats', () => {
    let now = 1000;
    const table = createRoomTable({
      dataset: miniDataset(),
      drawMs: 5000,
      now: () => now,
      rng: () => 0,
    });
    table.join(player('a'), 1);
    table.join(player('b'), 1);
    const prep = table.prepareTickets('a');
    table.selectTicket('a', prep.room.ticketPool[0].ticketId);
    table.selectTicket('b', prep.room.ticketPool[1].ticketId);
    table.disconnect('b', now);
    const r = table.start('a', now);
    assert.equal(r.ok, false);
    assert.equal(r.error.code, 'NEED_CONNECTED');
  });

  it('reconnect after hold expiry returns SEAT_EXPIRED', () => {
    let now = 1000;
    const table = createRoomTable({
      dataset: miniDataset(),
      reconnectMs: 500,
      now: () => now,
      rng: () => 0,
    });
    table.join(player('a'), 1);
    table.join(player('b'), 1);
    table.disconnect('b', now);
    now += 1000;
    const r = table.reconnect(player('b'), now);
    assert.equal(r.ok, false);
    assert.equal(r.error.code, 'SEAT_EXPIRED');
    assert.equal(table.list()[0].seats.some((s) => s.pccuid === 'b'), false);
  });

  it('same-room join restores connected after soft disconnect', () => {
    let now = 1000;
    const table = createRoomTable({
      dataset: miniDataset(),
      reconnectMs: 60_000,
      now: () => now,
      rng: () => 0,
    });
    table.join(player('a'), 1);
    table.join(player('b'), 1);
    table.disconnect('b', now);
    const r = table.join(player('b', 'B2'), 1);
    assert.equal(r.ok, true);
    assert.equal(r.room.seats.find((s) => s.pccuid === 'b').connected, true);
  });

  it('lobby list omits ticket matrices; playing exposes only myTicket', () => {
    let now = 1000;
    const table = createRoomTable({
      dataset: miniDataset(),
      drawMs: 1000,
      now: () => now,
      rng: () => 0,
    });
    table.join(player('a'), 1);
    table.join(player('b'), 1);
    const prep = table.prepareTickets('a');
    assert.ok(prep.room.ticketPool.length > 0);
    assert.equal(table.list()[0].ticketPool.length, 0);

    table.selectTicket('a', prep.room.ticketPool[0].ticketId);
    table.selectTicket('b', prep.room.ticketPool[1].ticketId);
    table.start('a', now);
    const forA = table.publicRoom(1, 'a');
    const forB = table.publicRoom(1, 'b');
    assert.equal(forA.ticketPool.length, 0);
    assert.ok(forA.myTicket);
    assert.equal(forA.myTicket.ticketId, prep.room.ticketPool[0].ticketId);
    assert.equal(forB.myTicket.ticketId, prep.room.ticketPool[1].ticketId);
    assert.notEqual(forA.myTicket.ticketId, forB.myTicket.ticketId);
  });
});
