'use strict';

const { rankOf, isTwo, compareCards } = require('./card');

const TYPES = {
  SINGLE: 'single',
  PAIR: 'pair',
  TRIPLE: 'triple',
  QUAD: 'quad',
  STRAIGHT: 'straight',
  PAIR_RUN: 'pair_run',
};

function sortCards(ids) {
  return [...ids].sort(compareCards);
}

function ranksOf(ids) {
  return ids.map(rankOf);
}

function classify(cardIds) {
  if (!Array.isArray(cardIds) || cardIds.length === 0) return null;
  const cards = sortCards(cardIds);
  if (new Set(cards).size !== cards.length) return null;

  const n = cards.length;
  const ranks = ranksOf(cards);
  const topCard = cards[n - 1];

  if (n === 1) {
    return { type: TYPES.SINGLE, length: 1, ranks, cards, topCard };
  }

  if (n === 2 && ranks[0] === ranks[1]) {
    return { type: TYPES.PAIR, length: 2, ranks, cards, topCard };
  }

  if (n === 3 && ranks[0] === ranks[1] && ranks[1] === ranks[2]) {
    return { type: TYPES.TRIPLE, length: 3, ranks, cards, topCard };
  }

  if (n === 4 && ranks.every((r) => r === ranks[0])) {
    return { type: TYPES.QUAD, length: 4, ranks, cards, topCard };
  }

  if (n >= 3 && isStrictStraight(ranks)) {
    return { type: TYPES.STRAIGHT, length: n, ranks, cards, topCard };
  }

  if ((n === 6 || n === 8) && isPairRun(ranks)) {
    return {
      type: TYPES.PAIR_RUN,
      length: n,
      pairCount: n / 2,
      ranks,
      cards,
      topCard,
    };
  }

  return null;
}

function isStrictStraight(ranks) {
  if (ranks.some((r) => r === 12)) return false;
  for (let i = 1; i < ranks.length; i += 1) {
    if (ranks[i] !== ranks[i - 1] + 1) return false;
  }
  return true;
}

function isPairRun(ranks) {
  if (ranks.length % 2 !== 0) return false;
  if (ranks.some((r) => r === 12)) return false;
  const pairCount = ranks.length / 2;
  if (pairCount < 3) return false;
  for (let i = 0; i < pairCount; i += 1) {
    const a = ranks[i * 2];
    const b = ranks[i * 2 + 1];
    if (a !== b) return false;
    if (i > 0 && a !== ranks[(i - 1) * 2] + 1) return false;
  }
  return true;
}

function containsCard(combo, cardId) {
  return combo && combo.cards.includes(cardId);
}

module.exports = {
  TYPES,
  classify,
  sortCards,
  containsCard,
  isTwo,
};
