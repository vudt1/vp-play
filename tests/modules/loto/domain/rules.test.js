'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  checkRowKinh,
  hasKinhWin,
  verifyKinh,
  pickRandomTickets,
  createNumberBag,
  drawNextNumber,
  rowNumbers,
} = require('../../../../src/modules/loto/domain/rules');

const sampleTicket = {
  ticketId: 'TK_TEST',
  theme: '#F4D03F',
  allNumbers: [1, 2, 3, 4, 5, 10, 20, 30, 40, 50],
  matrices: [
    {
      matrixId: 'M1',
      rows: [
        [1, 2, 3, 4, 5, null, null, null, null],
        [null, 10, null, 20, null, 30, null, 40, 50],
        [null, null, null, null, null, null, null, null, null],
      ],
    },
    { matrixId: 'M2', rows: [[null, null, null, null, null, null, null, null, null], [null, null, null, null, null, null, null, null, null], [null, null, null, null, null, null, null, null, null]] },
    { matrixId: 'M3', rows: [[null, null, null, null, null, null, null, null, null], [null, null, null, null, null, null, null, null, null], [null, null, null, null, null, null, null, null, null]] },
  ],
};

describe('loto rules', () => {
  it('rowNumbers filters nulls', () => {
    assert.deepEqual(rowNumbers([null, 1, null, 2, 3, 4, 5, null, null]), [1, 2, 3, 4, 5]);
  });

  it('checkRowKinh true when all 5 drawn', () => {
    assert.equal(checkRowKinh([1, 2, 3, 4, 5, 99], [1, 2, 3, 4, 5, null, null, null, null]), true);
  });

  it('checkRowKinh false when missing one', () => {
    assert.equal(checkRowKinh([1, 2, 3, 4], [1, 2, 3, 4, 5, null, null, null, null]), false);
  });

  it('hasKinhWin on first matrix row', () => {
    assert.equal(hasKinhWin([1, 2, 3, 4, 5], sampleTicket), true);
    assert.equal(hasKinhWin([1, 2, 3, 4], sampleTicket), false);
  });

  it('verifyKinh returns win or INVALID_KINH', () => {
    const ok = verifyKinh([1, 2, 3, 4, 5], sampleTicket);
    assert.equal(ok.win, true);
    assert.ok(ok.winningRows.length >= 1);

    const bad = verifyKinh([1, 2, 3], sampleTicket);
    assert.equal(bad.win, false);
    assert.equal(bad.code, 'INVALID_KINH');
  });

  it('pickRandomTickets returns unique count', () => {
    const ds = [
      { ticketId: 'A', theme: '#000', allNumbers: [], matrices: [] },
      { ticketId: 'B', theme: '#000', allNumbers: [], matrices: [] },
      { ticketId: 'C', theme: '#000', allNumbers: [], matrices: [] },
    ];
    const picked = pickRandomTickets(ds, 2, () => 0);
    assert.equal(picked.length, 2);
    assert.ok(picked.every((t) => t.ticketId));
  });

  it('drawNextNumber empties bag without duplicates', () => {
    const bag = createNumberBag(5);
    const seen = new Set();
    while (bag.length) {
      const n = drawNextNumber(bag, () => 0);
      assert.ok(n >= 1 && n <= 5);
      assert.equal(seen.has(n), false);
      seen.add(n);
    }
    assert.equal(drawNextNumber(bag), null);
  });
});
