'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { cardId, THREE_SPADES, rankOf } = require('../../../../src/modules/tienlen/domain/card');
const { classify, TYPES } = require('../../../../src/modules/tienlen/domain/combination');
const { canBeat, canLead, validatePlay } = require('../../../../src/modules/tienlen/domain/playRules');
const { pointsForFinish } = require('../../../../src/modules/tienlen/domain/scoring');
const { deal } = require('../../../../src/modules/tienlen/domain/deal');

describe('combination', () => {
  it('classifies single pair triple quad', () => {
    assert.equal(classify([0]).type, TYPES.SINGLE);
    assert.equal(classify([0, 1]).type, TYPES.PAIR);
    assert.equal(classify([0, 1, 2]).type, TYPES.TRIPLE);
    assert.equal(classify([0, 1, 2, 3]).type, TYPES.QUAD);
  });

  it('classifies straight without 2s', () => {
    const s = classify([0, 4, 8]);
    assert.equal(s.type, TYPES.STRAIGHT);
    assert.equal(s.length, 3);
    assert.equal(classify([40, 44, 48]), null);
  });

  it('classifies 3 and 4 consecutive pairs', () => {
    const three = classify([0, 1, 4, 5, 8, 9]);
    assert.equal(three.type, TYPES.PAIR_RUN);
    assert.equal(three.pairCount, 3);
    const four = classify([0, 1, 4, 5, 8, 9, 12, 13]);
    assert.equal(four.pairCount, 4);
  });
});

describe('playRules', () => {
  it('requires opening card on first lead', () => {
    const bad = canLead([4], { mustIncludeCardId: 0 });
    assert.equal(bad.ok, false);
    assert.equal(bad.code, 'MUST_INCLUDE_OPENING');
    const good = canLead([0, 1], { mustIncludeCardId: 0 });
    assert.equal(good.ok, true);
    const other = canLead([5], { mustIncludeCardId: 5 });
    assert.equal(other.ok, true);
  });

  it('same shape beat by higher top', () => {
    const prev = classify([4]);
    const ok = canBeat(prev, [8]);
    assert.equal(ok.ok, true);
    const no = canBeat(prev, [0]);
    assert.equal(no.ok, false);
  });

  it('quad and pair runs beat single 2', () => {
    const two = classify([cardId(12, 0)]);
    assert.equal(canBeat(two, [0, 1, 2, 3]).ok, true);
    assert.equal(canBeat(two, [0, 1, 4, 5, 8, 9]).ok, true);
  });

  it('four pair run beats pair of 2s and quad', () => {
    const pair2 = classify([cardId(12, 0), cardId(12, 1)]);
    const fourRun = [0, 1, 4, 5, 8, 9, 12, 13];
    assert.equal(canBeat(pair2, fourRun).ok, true);
    const quad = classify([20, 21, 22, 23]);
    assert.equal(canBeat(quad, fourRun).ok, true);
  });

  it('validatePlay free lead', () => {
    const r = validatePlay([8], { freeLead: true });
    assert.equal(r.ok, true);
  });
});

describe('scoring', () => {
  it('maps finish order for 4 players', () => {
    const d = pointsForFinish(['a', 'b', 'c', 'd'], 4);
    assert.deepEqual(d, { a: 3, b: 1, c: 0, d: -1 });
  });
});

describe('deal', () => {
  it('deals 13 cards each', () => {
    const { hands, leftover } = deal(3, () => 0.5);
    assert.equal(hands.length, 3);
    hands.forEach((h) => assert.equal(h.length, 13));
    assert.equal(leftover.length, 13);
  });

  it('3s is somewhere when full 4', () => {
    const { hands } = deal(4, () => 0.1);
    const all = hands.flat();
    assert.ok(all.includes(THREE_SPADES));
    assert.equal(new Set(all).size, 52);
  });
});

describe('card', () => {
  it('3s is 0', () => {
    assert.equal(THREE_SPADES, 0);
    assert.equal(rankOf(0), 0);
  });

  it('maps cardId to assetName accurately', () => {
    const { assetName } = require('../../../../src/modules/tienlen/domain/card');
    assert.equal(assetName(0), 'S3');
    assert.equal(assetName(48), 'S2');
    assert.equal(assetName(49), 'C2');
    assert.equal(assetName(50), 'D2');
    assert.equal(assetName(51), 'H2');
  });
});

