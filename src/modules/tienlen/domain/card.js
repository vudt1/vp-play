'use strict';

const THREE_SPADES = 0;
const RANK_COUNT = 13;
const SUIT_COUNT = 4;
const DECK_SIZE = 52;

const RANK_NAMES = ['3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A', '2'];
const SUIT_NAMES = ['S', 'C', 'D', 'H'];

function rankOf(id) {
  return Math.floor(id / SUIT_COUNT);
}

function suitOf(id) {
  return id % SUIT_COUNT;
}

function cardId(rank, suit) {
  return rank * SUIT_COUNT + suit;
}

function compareCards(a, b) {
  return a - b;
}

function isTwo(id) {
  return rankOf(id) === 12;
}

function fullDeck() {
  const deck = [];
  for (let i = 0; i < DECK_SIZE; i += 1) deck.push(i);
  return deck;
}

function assetName(id) {
  return `${SUIT_NAMES[suitOf(id)]}${RANK_NAMES[rankOf(id)]}`;
}

module.exports = {
  THREE_SPADES,
  RANK_COUNT,
  SUIT_COUNT,
  DECK_SIZE,
  RANK_NAMES,
  SUIT_NAMES,
  rankOf,
  suitOf,
  cardId,
  compareCards,
  isTwo,
  fullDeck,
  assetName,
};
