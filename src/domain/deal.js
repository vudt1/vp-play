'use strict';

const { fullDeck } = require('./card');

function shuffle(deck, random = Math.random) {
  const out = [...deck];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function deal(playerCount, random = Math.random) {
  if (playerCount < 2 || playerCount > 4) {
    throw new Error('playerCount must be 2–4');
  }
  const deck = shuffle(fullDeck(), random);
  const hands = [];
  for (let p = 0; p < playerCount; p += 1) {
    hands.push(deck.slice(p * 13, p * 13 + 13).sort((a, b) => a - b));
  }
  return { hands, leftover: deck.slice(playerCount * 13) };
}

module.exports = { shuffle, deal };
