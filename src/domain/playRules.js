'use strict';

const { THREE_SPADES } = require('./card');
const { TYPES, classify } = require('./combination');

function canLead(cardIds, { mustInclude3s = false } = {}) {
  const combo = classify(cardIds);
  if (!combo) return { ok: false, code: 'INVALID_COMBO', message: 'Not a legal combination' };
  if (mustInclude3s && !combo.cards.includes(THREE_SPADES)) {
    return { ok: false, code: 'MUST_INCLUDE_3S', message: 'First lead must include 3♠' };
  }
  return { ok: true, combo };
}

function canBeat(prevCombo, cardIds) {
  const attempt = classify(cardIds);
  if (!attempt) return { ok: false, code: 'INVALID_COMBO', message: 'Not a legal combination' };
  if (!prevCombo) return { ok: true, combo: attempt };

  if (sameShapeBeat(prevCombo, attempt)) {
    return { ok: true, combo: attempt };
  }

  if (isSpecialBeat(prevCombo, attempt)) {
    return { ok: true, combo: attempt, special: true };
  }

  return { ok: false, code: 'CANNOT_BEAT', message: 'Cannot beat previous play' };
}

function sameShapeBeat(prev, next) {
  if (prev.type !== next.type) return false;
  if (prev.type === TYPES.STRAIGHT || prev.type === TYPES.PAIR_RUN) {
    if (prev.length !== next.length) return false;
  }
  return next.topCard > prev.topCard;
}

function isSpecialBeat(prev, next) {
  if (prev.type === TYPES.SINGLE && rankIsTwo(prev)) {
    if (next.type === TYPES.QUAD) return true;
    if (next.type === TYPES.PAIR_RUN && next.pairCount === 3) return true;
    if (next.type === TYPES.PAIR_RUN && next.pairCount === 4) return true;
  }

  if (prev.type === TYPES.PAIR && rankIsTwo(prev)) {
    if (next.type === TYPES.PAIR_RUN && next.pairCount === 4) return true;
  }

  if (prev.type === TYPES.QUAD) {
    if (next.type === TYPES.PAIR_RUN && next.pairCount === 4) return true;
  }

  return false;
}

function rankIsTwo(combo) {
  return Math.floor(combo.topCard / 4) === 12;
}

function validatePlay(cardIds, { lastCombo = null, freeLead = false, mustInclude3s = false } = {}) {
  if (freeLead || !lastCombo) {
    return canLead(cardIds, { mustInclude3s });
  }
  return canBeat(lastCombo, cardIds);
}

module.exports = {
  canLead,
  canBeat,
  validatePlay,
  isSpecialBeat,
  sameShapeBeat,
};
