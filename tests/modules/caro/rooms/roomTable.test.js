'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { createRoomTable, ROOM_IDS, MAX_SEATS } = require('../../../../src/modules/caro/rooms/roomTable');
const { BOARD_SIZE } = require('../../../../src/modules/caro/domain/caroRules');

function players(n) {
  return Array.from({ length: n }, (_, i) => ({
    pccuid: `p${i + 1}`,
    displayName: `P${i + 1}`,
    socketId: `s${i + 1}`,
  }));
}

function joinTwo(table) {
  const [a, b] = players(2);
  assert.equal(table.join(a, 1).ok, true);
  assert.equal(table.join(b, 1).ok, true);
  return [a, b];
}

describe('caro roomTable', () => {
  it('lists 3 fixed rooms', () => {
    const table = createRoomTable();
    assert.equal(table.list().length, 3);
    assert.deepEqual(ROOM_IDS, [1, 2, 3]);
    assert.equal(MAX_SEATS, 2);
  });

  it('join host, second player, full reject', () => {
    const table = createRoomTable();
    const [a, b, c] = players(3);
    const j1 = table.join(a, 1);
    assert.equal(j1.ok, true);
    assert.equal(j1.room.hostPccuid, 'p1');
    assert.equal(j1.room.phase, 'waiting');
    assert.equal(table.join(b, 1).ok, true);
    const full = table.join(c, 1);
    assert.equal(full.ok, false);
    assert.equal(full.error.code, 'ROOM_FULL');
  });

  it('rejects second room while seated', () => {
    const table = createRoomTable();
    const [a] = players(1);
    table.join(a, 1);
    const r = table.join(a, 2);
    assert.equal(r.ok, false);
    assert.equal(r.error.code, 'ALREADY_IN_ROOM');
  });

  it('start not host reject; start with 2 ok; marks X/O', () => {
    const table = createRoomTable();
    joinTwo(table);
    const bad = table.start('p2');
    assert.equal(bad.ok, false);
    assert.equal(bad.error.code, 'NOT_HOST');
    const start = table.start('p1');
    assert.equal(start.ok, true);
    assert.equal(start.room.phase, 'playing');
    assert.equal(start.room.match.currentTurn, 'p1');
    assert.equal(start.room.match.marks.p1, 'X');
    assert.equal(start.room.match.marks.p2, 'O');
    const hostSeat = start.room.seats.find((s) => s.pccuid === 'p1');
    const guestSeat = start.room.seats.find((s) => s.pccuid === 'p2');
    assert.equal(hostSeat.mark, 'X');
    assert.equal(guestSeat.mark, 'O');
    assert.equal(start.room.match.board.length, BOARD_SIZE);
  });

  it('move invalid / wrong turn reject', () => {
    const table = createRoomTable();
    joinTwo(table);
    table.start('p1');
    const wrong = table.move('p2', 0, 0);
    assert.equal(wrong.ok, false);
    assert.equal(wrong.error.code, 'NOT_YOUR_TURN');
    assert.equal(table.move('p1', 0, 0).ok, true);
    const occupied = table.move('p2', 0, 0);
    assert.equal(occupied.ok, false);
    assert.equal(occupied.error.code, 'INVALID_MOVE');
    const oob = table.move('p2', -1, 0);
    assert.equal(oob.ok, false);
    assert.equal(oob.error.code, 'INVALID_MOVE');
  });

  it('win applies onSettle once with +1/-1', async () => {
    const settles = [];
    const table = createRoomTable({
      onSettle: async (payload) => {
        settles.push(payload);
      },
    });
    joinTwo(table);
    table.start('p1');
    for (let i = 0; i < 4; i++) {
      assert.equal(table.move('p1', 7, i).ok, true);
      assert.equal(table.move('p2', 8, i).ok, true);
    }
    const win = table.move('p1', 7, 4);
    assert.equal(win.ok, true);
    assert.equal(win.finished.result, 'win');
    assert.equal(win.finished.winnerId, 'p1');
    assert.deepEqual(win.finished.pointsDelta, { p1: 1, p2: -1 });
    assert.equal(win.room.phase, 'waiting');
    assert.equal(win.room.match, null);
    assert.ok(win.finished.board);
    assert.equal(win.finished.board[7][4], 1);
    assert.ok(Array.isArray(win.finished.winLine));
    assert.equal(win.finished.winLine.length, 5);
    assert.ok(win.room.lastResult);
    assert.equal(win.room.lastResult.winnerId, 'p1');
    assert.equal(win.room.lastResult.board[7][4], 1);
    await new Promise((r) => setImmediate(r));
    assert.equal(settles.length, 1);
    assert.equal(settles[0].winnerId, 'p1');
    assert.deepEqual(settles[0].pointsDelta, { p1: 1, p2: -1 });
  });

  it('after win host leave migrates host and keeps lastResult for remaining', () => {
    const table = createRoomTable();
    joinTwo(table);
    table.start('p1');
    for (let i = 0; i < 4; i++) {
      table.move('p1', 7, i);
      table.move('p2', 8, i);
    }
    const win = table.move('p1', 7, 4);
    assert.equal(win.ok, true);
    const leave = table.leave('p1');
    assert.equal(leave.ok, true);
    assert.equal(leave.aborted, undefined);
    assert.equal(leave.room.hostPccuid, 'p2');
    assert.equal(leave.room.seats.length, 1);
    assert.equal(leave.room.phase, 'waiting');
    assert.ok(leave.room.lastResult);
    assert.equal(leave.room.lastResult.winnerId, 'p1');
  });

  it('board full draw no onSettle', async () => {
    const caroRules = require('../../../../src/modules/caro/domain/caroRules');
    const settles = [];
    const table = createRoomTable({
      onSettle: async (payload) => {
        settles.push(payload);
      },
    });
    joinTwo(table);
    table.start('p1');

    const origFull = caroRules.isBoardFull;
    const origWin = caroRules.checkWin;
    caroRules.checkWin = () => false;
    caroRules.isBoardFull = () => true;
    try {
      const res = table.move('p1', 0, 0);
      assert.equal(res.ok, true);
      assert.equal(res.finished.result, 'draw');
      assert.deepEqual(res.finished.pointsDelta, {});
      assert.equal(res.room.phase, 'waiting');
      assert.equal(res.room.match, null);
    } finally {
      caroRules.isBoardFull = origFull;
      caroRules.checkWin = origWin;
    }
    await new Promise((x) => setImmediate(x));
    assert.equal(settles.length, 0);
  });

  it('leave mid-match abort no onSettle', async () => {
    const settles = [];
    const table = createRoomTable({
      onSettle: async (payload) => {
        settles.push(payload);
      },
    });
    joinTwo(table);
    table.start('p1');
    table.move('p1', 0, 0);
    const left = table.leave('p1');
    assert.equal(left.ok, true);
    assert.equal(left.aborted, true);
    assert.ok(['leave', 'solo'].includes(left.abortReason));
    assert.equal(left.room.match, null);
    assert.equal(left.room.phase, 'waiting');
    assert.equal(left.room.seats.length, 1);
    assert.equal(left.room.hostPccuid, 'p2');
    await new Promise((r) => setImmediate(r));
    assert.equal(settles.length, 0);
  });

  it('disconnect mid-match abort', async () => {
    const settles = [];
    const table = createRoomTable({
      onSettle: async (payload) => {
        settles.push(payload);
      },
    });
    joinTwo(table);
    table.start('p1');
    const d = table.disconnect('p2');
    assert.equal(d.ok, true);
    assert.equal(d.aborted, true);
    assert.ok(['disconnect', 'solo'].includes(d.abortReason));
    assert.equal(d.room.match, null);
    assert.equal(d.room.phase, 'waiting');
    assert.equal(d.room.seats.length, 1);
    await new Promise((r) => setImmediate(r));
    assert.equal(settles.length, 0);
  });

  it('host leave waiting → remaining becomes host', () => {
    const table = createRoomTable();
    joinTwo(table);
    const left = table.leave('p1');
    assert.equal(left.ok, true);
    assert.equal(left.room.hostPccuid, 'p2');
    assert.equal(left.room.seats.length, 1);
    assert.equal(left.room.phase, 'waiting');
  });

  it('disconnect while waiting leaves seat', () => {
    const table = createRoomTable();
    joinTwo(table);
    const d = table.disconnect('p2');
    assert.equal(d.ok, true);
    assert.equal(d.aborted, undefined);
    assert.equal(d.room.seats.length, 1);
    assert.equal(d.room.hostPccuid, 'p1');
  });
});
