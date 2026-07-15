'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { createRoomTable } = require('../../../../src/modules/tienlen/rooms/roomTable');
const { THREE_SPADES } = require('../../../../src/modules/tienlen/domain/card');

function players(n) {
  return Array.from({ length: n }, (_, i) => ({
    pccuid: `p${i + 1}`,
    displayName: `P${i + 1}`,
    socketId: `s${i + 1}`,
  }));
}

describe('roomTable', () => {
  it('lists 3 fixed rooms', () => {
    const table = createRoomTable();
    assert.equal(table.list().length, 3);
  });

  it('join and host assignment', () => {
    const table = createRoomTable();
    const [a, b] = players(2);
    assert.equal(table.join(a, 1).ok, true);
    assert.equal(table.join(b, 1).ok, true);
    const room = table.list().find((r) => r.id === 1);
    assert.equal(room.hostPccuid, 'p1');
    assert.equal(room.seats.length, 2);
  });

  it('rejects second room while seated', () => {
    const table = createRoomTable();
    const [a] = players(1);
    table.join(a, 1);
    const r = table.join(a, 2);
    assert.equal(r.ok, false);
    assert.equal(r.error.code, 'ALREADY_IN_ROOM');
  });

  it('host starts and deals; holder of min card id leads', () => {
    const table = createRoomTable({ random: () => 0.42 });
    const ps = players(2);
    table.join(ps[0], 1);
    table.join(ps[1], 1);
    const start = table.start('p1');
    assert.equal(start.ok, true);
    assert.equal(start.room.phase, 'playing');
    assert.ok(start.dealt.p1.length === 13);
    assert.ok(start.dealt.p2.length === 13);
    const opener = start.room.hand.currentTurn;
    const openingCardId = start.room.hand.openingCardId;
    assert.equal(start.room.hand.mustIncludeOpening, true);
    assert.ok(start.dealt[opener].includes(openingCardId));
    const all = [...start.dealt.p1, ...start.dealt.p2];
    assert.equal(openingCardId, Math.min(...all));
  });

  it('4 players opening card is 3♠', () => {
    const table = createRoomTable({ random: () => 0.3 });
    const ps = players(4);
    for (const p of ps) table.join(p, 1);
    const start = table.start('p1');
    assert.equal(start.ok, true);
    assert.equal(start.room.hand.openingCardId, THREE_SPADES);
    assert.ok(start.dealt[start.room.hand.currentTurn].includes(THREE_SPADES));
  });

  it('non-host cannot start', () => {
    const table = createRoomTable();
    const ps = players(2);
    table.join(ps[0], 1);
    table.join(ps[1], 1);
    const r = table.start('p2');
    assert.equal(r.ok, false);
    assert.equal(r.error.code, 'NOT_HOST');
  });

  it('host migrates on leave', () => {
    const table = createRoomTable();
    const ps = players(2);
    table.join(ps[0], 1);
    table.join(ps[1], 1);
    table.leave('p1');
    const room = table.list().find((r) => r.id === 1);
    assert.equal(room.hostPccuid, 'p2');
  });

  it('play requires opening card on first free lead', () => {
    let seq = 0;
    const random = () => {
      seq += 1;
      return (seq % 100) / 100;
    };
    const table = createRoomTable({ random });
    const ps = players(2);
    table.join(ps[0], 1);
    table.join(ps[1], 1);
    const start = table.start('p1');
    const opener = start.room.hand.currentTurn;
    const opening = start.room.hand.openingCardId;
    const other = start.dealt[opener].find((c) => c !== opening);
    if (other != null) {
      const bad = table.play(opener, [other]);
      assert.equal(bad.ok, false);
      assert.equal(bad.error.code, 'MUST_INCLUDE_OPENING');
    }
    const good = table.play(opener, [opening]);
    assert.equal(good.ok, true);
    assert.equal(good.room.hand.mustIncludeOpening, false);
  });

  it('cannot pass on free lead', () => {
    const table = createRoomTable({ random: () => 0.42 });
    const ps = players(2);
    table.join(ps[0], 1);
    table.join(ps[1], 1);
    const start = table.start('p1');
    const turn = start.room.hand.currentTurn;
    const r = table.pass(turn);
    assert.equal(r.ok, false);
    assert.equal(r.error.code, 'CANNOT_PASS');
  });

  it('first turnDeadline includes deal grace; later turns do not', () => {
    const before = Date.now();
    const table = createRoomTable({
      random: () => 0.42,
      turnTimeoutMs: 1000,
      dealGraceMs: 8000,
    });
    const ps = players(2);
    table.join(ps[0], 1);
    table.join(ps[1], 1);
    const start = table.start('p1');
    const firstDeadline = start.room.hand.turnDeadline;
    assert.ok(firstDeadline >= before + 1000 + 8000 - 50);
    assert.ok(firstDeadline <= Date.now() + 1000 + 8000 + 50);
    assert.equal(table.tick(before + 2000).length, 0);
    const opener = start.room.hand.currentTurn;
    const opening = start.room.hand.openingCardId;
    assert.equal(table.play(opener, [opening]).ok, true);
    const afterPlay = table.list().find((r) => r.id === 1).hand.turnDeadline;
    const now = Date.now();
    assert.ok(afterPlay >= now + 1000 - 50);
    assert.ok(afterPlay <= now + 1000 + 50);
  });

  it('timeout free lead skips to next player without playing cards', () => {
    const table = createRoomTable({
      random: () => 0.42,
      turnTimeoutMs: 1000,
      dealGraceMs: 0,
    });
    const ps = players(2);
    table.join(ps[0], 1);
    table.join(ps[1], 1);
    const start = table.start('p1');
    const opener = start.room.hand.currentTurn;
    const other = opener === 'p1' ? 'p2' : 'p1';
    const openerCount = start.dealt[opener].length;
    const events = table.tick(Date.now() + 2000);
    assert.ok(events.some((e) => e.type === 'free-lead-skip'));
    const room = table.list().find((r) => r.id === 1);
    assert.equal(room.hand.currentTurn, other);
    assert.equal(room.hand.freeLead, true);
    assert.equal(room.hand.mustIncludeOpening, false);
    assert.equal(table.getPrivateHand(opener).length, openerCount);
  });

  it('timeout non-free-lead auto-passes into ringPassed', () => {
    const table = createRoomTable({
      random: () => 0.42,
      turnTimeoutMs: 1000,
      dealGraceMs: 0,
    });
    const ps = players(2);
    table.join(ps[0], 1);
    table.join(ps[1], 1);
    const start = table.start('p1');
    const opener = start.room.hand.currentTurn;
    const opening = start.room.hand.openingCardId;
    assert.equal(table.play(opener, [opening]).ok, true);
    const turn = table.list().find((r) => r.id === 1).hand.currentTurn;
    const events = table.tick(Date.now() + 2000);
    assert.ok(events.some((e) => e.type === 'auto-pass'));
    const room = table.list().find((r) => r.id === 1);
    assert.ok(room.hand.ringPassed.includes(turn) || room.hand.freeLead);
  });

  it('mid-hand leave with one seat aborts without points', () => {
    const settles = [];
    const table = createRoomTable({
      random: () => 0.42,
      onSettle: async (p) => settles.push(p),
    });
    const ps = players(2);
    table.join(ps[0], 1);
    table.join(ps[1], 1);
    table.start('p1');
    const leave = table.leave('p2');
    assert.equal(leave.ok, true);
    assert.equal(leave.aborted, true);
    assert.equal(leave.abortReason, 'solo');
    assert.equal(leave.room.phase, 'waiting');
    assert.equal(leave.room.hand, null);
    assert.equal(settles.length, 0);
  });

  it('pass removes play rights for rest of ring', () => {
    const table = createRoomTable({ random: () => 0.42 });
    const ps = players(3);
    for (const p of ps) table.join(p, 1);
    const start = table.start('p1');
    const opener = start.room.hand.currentTurn;
    const opening = start.room.hand.openingCardId;
    table.play(opener, [opening]);
    let room = table.list().find((r) => r.id === 1);
    const first = room.hand.currentTurn;
    assert.equal(table.pass(first).ok, true);
    room = table.list().find((r) => r.id === 1);
    assert.ok(room.hand.ringPassed.includes(first));
    assert.notEqual(room.hand.currentTurn, first);
  });

  it('mid-hand leave closes ring when remaining all passed', () => {
    const table = createRoomTable({ random: () => 0.42 });
    const ps = players(3);
    for (const p of ps) table.join(p, 1);
    const start = table.start('p1');
    const opener = start.room.hand.currentTurn;
    const opening = start.room.hand.openingCardId;
    table.play(opener, [opening]);
    let room = table.list().find((r) => r.id === 1);
    const passer = room.hand.currentTurn;
    assert.equal(table.pass(passer).ok, true);
    room = table.list().find((r) => r.id === 1);
    const third = room.hand.currentTurn;
    assert.notEqual(third, opener);
    assert.notEqual(third, passer);
    const leave = table.leave(third);
    assert.equal(leave.ok, true);
    assert.equal(leave.aborted, undefined);
    room = leave.room;
    assert.equal(room.hand.freeLead, true);
    assert.equal(room.hand.currentTurn, opener);
    assert.equal(room.hand.lastCombo, null);
  });

  it('leave with seats still >=2 continues hand (no abort)', () => {
    const settles = [];
    const table = createRoomTable({
      random: () => 0.42,
      onSettle: async (p) => settles.push(p),
    });
    const ps = players(3);
    for (const p of ps) table.join(p, 1);
    const start = table.start('p1');
    const opener = start.room.hand.currentTurn;
    const opening = start.room.hand.openingCardId;
    table.play(opener, [opening]);
    const leaver = start.room.hand.active.find((id) => id !== opener);
    const leave = table.leave(leaver);
    assert.equal(leave.ok, true);
    assert.equal(leave.aborted, undefined);
    assert.equal(leave.finished, undefined);
    assert.equal(leave.room.phase, 'playing');
    assert.equal(leave.room.seats.length, 2);
    assert.equal(leave.room.hand.active.length, 2);
    assert.equal(settles.length, 0);
  });
});
