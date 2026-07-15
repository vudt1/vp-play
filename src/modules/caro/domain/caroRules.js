'use strict';

const BOARD_SIZE = 15;

function createEmptyBoard() {
  return Array.from({ length: BOARD_SIZE }, () => Array(BOARD_SIZE).fill(0));
}

function inBounds(r, c) {
  return r >= 0 && r < BOARD_SIZE && c >= 0 && c < BOARD_SIZE;
}

function isValidMove(board, r, c) {
  if (!Number.isInteger(r) || !Number.isInteger(c)) return false;
  if (!inBounds(r, c)) return false;
  return board[r][c] === 0;
}

function isBoardFull(board) {
  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      if (board[r][c] === 0) return false;
    }
  }
  return true;
}

function countDir(board, r, c, dr, dc, playerVal) {
  let n = 0;
  let rr = r + dr;
  let cc = c + dc;
  while (inBounds(rr, cc) && board[rr][cc] === playerVal) {
    n += 1;
    rr += dr;
    cc += dc;
  }
  return n;
}

function endBlocked(board, r, c, dr, dc, steps, opponent) {
  const rr = r + dr * steps;
  const cc = c + dc * steps;
  if (!inBounds(rr, cc)) return false;
  return board[rr][cc] === opponent;
}

function checkWin(board, r, c, playerVal) {
  const opponent = playerVal === 1 ? 2 : 1;
  const dirs = [
    [0, 1],
    [1, 0],
    [1, 1],
    [1, -1],
  ];

  for (const [dr, dc] of dirs) {
    const back = countDir(board, r, c, -dr, -dc, playerVal);
    const fwd = countDir(board, r, c, dr, dc, playerVal);
    const total = 1 + back + fwd;
    if (total < 5) continue;

    const blockedBack = endBlocked(board, r, c, -dr, -dc, back + 1, opponent);
    const blockedFwd = endBlocked(board, r, c, dr, dc, fwd + 1, opponent);
    if (blockedBack && blockedFwd) continue;
    return true;
  }
  return false;
}

module.exports = {
  BOARD_SIZE,
  createEmptyBoard,
  isValidMove,
  checkWin,
  isBoardFull,
};
