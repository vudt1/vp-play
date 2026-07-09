'use strict';

const TABLES = {
  2: [1, -1],
  3: [2, 0, -1],
  4: [3, 1, 0, -1],
};

function pointsForFinish(finishOrder, playerCount) {
  const table = TABLES[playerCount];
  if (!table) throw new Error('playerCount must be 2–4');
  if (!Array.isArray(finishOrder) || finishOrder.length !== playerCount) {
    throw new Error('finishOrder length must equal playerCount');
  }
  const deltas = {};
  finishOrder.forEach((playerId, index) => {
    deltas[playerId] = table[index];
  });
  return deltas;
}

module.exports = { pointsForFinish, TABLES };
