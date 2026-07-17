'use strict';

function rowNumbers(row) {
  if (!Array.isArray(row)) return [];
  return row.filter((n) => n != null && Number.isFinite(Number(n))).map(Number);
}

function checkRowKinh(drawnNumbers, row) {
  const nums = rowNumbers(row);
  if (nums.length !== 5) return false;
  const drawn = new Set((drawnNumbers || []).map(Number));
  return nums.every((n) => drawn.has(n));
}

function ticketMatricesRows(ticket) {
  if (!ticket) return [];
  const matrices = ticket.matrices || [];
  const rows = [];
  for (const matrix of matrices) {
    const matrixRows = matrix?.rows || matrix;
    if (!Array.isArray(matrixRows)) continue;
    for (const row of matrixRows) {
      if (Array.isArray(row)) rows.push(row);
    }
  }
  return rows;
}

function findWinningRows(drawnNumbers, ticket) {
  const wins = [];
  const rows = ticketMatricesRows(ticket);
  rows.forEach((row, index) => {
    if (checkRowKinh(drawnNumbers, row)) {
      wins.push({ rowIndex: index, numbers: rowNumbers(row) });
    }
  });
  return wins;
}

function hasKinhWin(drawnNumbers, ticket) {
  return findWinningRows(drawnNumbers, ticket).length > 0;
}

function verifyKinh(drawnNumbers, ticket) {
  const winningRows = findWinningRows(drawnNumbers, ticket);
  if (winningRows.length > 0) {
    return { win: true, winningRows };
  }
  return {
    win: false,
    code: 'INVALID_KINH',
    message: 'Chưa có hàng nào đủ 5 số đã rao',
  };
}

function pickRandomTickets(dataset, count, rng = Math.random) {
  const list = Array.isArray(dataset) ? dataset.slice() : [];
  const n = Math.min(Math.max(0, count | 0), list.length);
  for (let i = list.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = list[i];
    list[i] = list[j];
    list[j] = tmp;
  }
  return list.slice(0, n).map((t) => ({
    ticketId: t.ticketId,
    theme: t.theme,
    allNumbers: Array.isArray(t.allNumbers) ? t.allNumbers.slice() : [],
    matrices: t.matrices,
  }));
}

function createNumberBag(max = 90) {
  const bag = [];
  for (let i = 1; i <= max; i += 1) bag.push(i);
  return bag;
}

function drawNextNumber(bag, rng = Math.random) {
  if (!bag || bag.length === 0) return null;
  const idx = Math.floor(rng() * bag.length);
  const [num] = bag.splice(idx, 1);
  return num;
}

function publicTicketSummary(ticket) {
  if (!ticket) return null;
  return {
    ticketId: ticket.ticketId,
    theme: ticket.theme,
  };
}

function publicTicketFull(ticket) {
  if (!ticket) return null;
  return {
    ticketId: ticket.ticketId,
    theme: ticket.theme,
    allNumbers: Array.isArray(ticket.allNumbers) ? ticket.allNumbers.slice() : [],
    matrices: ticket.matrices,
  };
}

module.exports = {
  checkRowKinh,
  findWinningRows,
  hasKinhWin,
  verifyKinh,
  pickRandomTickets,
  createNumberBag,
  drawNextNumber,
  rowNumbers,
  ticketMatricesRows,
  publicTicketSummary,
  publicTicketFull,
};
