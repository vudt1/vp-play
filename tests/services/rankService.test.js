'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { avatarInitial, avatarBg, getTopBoard } = require('../../src/services/rankService');

describe('rankService board helpers', () => {
  it('avatarInitial uses first letter uppercased vi', () => {
    assert.equal(avatarInitial('nguyễn', 'x'), 'N');
    assert.equal(avatarInitial('', 'abc'), 'A');
    assert.equal(avatarInitial('', ''), '?');
  });

  it('avatarBg is deterministic', () => {
    assert.equal(avatarBg('player1'), avatarBg('player1'));
    assert.match(avatarBg('player1'), /^#[0-9a-f]{6}$/i);
  });

  it('getTopBoard always returns 10 rows with sequential ranks', () => {
    const board = getTopBoard(10);
    assert.equal(board.length, 10);
    assert.ok(board.every((r, i) => r.rank === i + 1));

    const reals = board.filter((r) => !r.placeholder);
    const pads = board.filter((r) => r.placeholder);

    reals.forEach((r) => {
      assert.equal(typeof r.pccuid, 'string');
      assert.equal(typeof r.displayName, 'string');
      assert.equal(typeof r.totalPoints, 'number');
      assert.equal(typeof r.initial, 'string');
      assert.match(r.avatarBg, /^#[0-9a-f]{6}$/i);
    });

    pads.forEach((r) => {
      assert.equal(r.pccuid, null);
      assert.equal(r.displayName, 'Unknown user');
      assert.equal(r.totalPoints, null);
      assert.equal(r.initial, null);
      assert.equal(r.avatarBg, null);
    });

    assert.equal(reals.length + pads.length, 10);
  });
});
