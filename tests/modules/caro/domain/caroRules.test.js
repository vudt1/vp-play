'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  BOARD_SIZE,
  createEmptyBoard,
  isValidMove,
  checkWin,
  findWinLine,
  isBoardFull,
} = require('../../../../src/modules/caro/domain/caroRules');

function placeLine(board, cells, val) {
  for (const [r, c] of cells) board[r][c] = val;
}

describe('caroRules', () => {
  it('BOARD_SIZE is 15 and empty board is zeros', () => {
    assert.equal(BOARD_SIZE, 15);
    const b = createEmptyBoard();
    assert.equal(b.length, 15);
    assert.equal(b[0].length, 15);
    assert.equal(b[0][0], 0);
  });

  it('5 horizontal win true', () => {
    const b = createEmptyBoard();
    placeLine(b, [
      [7, 3],
      [7, 4],
      [7, 5],
      [7, 6],
      [7, 7],
    ], 1);
    assert.equal(checkWin(b, 7, 5, 1), true);
  });

  it('blocked both ends by opponent false', () => {
    const b = createEmptyBoard();
    placeLine(b, [
      [5, 2],
      [5, 3],
      [5, 4],
      [5, 5],
      [5, 6],
    ], 1);
    b[5][1] = 2;
    b[5][7] = 2;
    assert.equal(checkWin(b, 5, 4, 1), false);
  });

  it('blocked one end true', () => {
    const b = createEmptyBoard();
    placeLine(b, [
      [5, 2],
      [5, 3],
      [5, 4],
      [5, 5],
      [5, 6],
    ], 1);
    b[5][1] = 2;
    assert.equal(checkWin(b, 5, 4, 1), true);
  });

  it('edge of board does NOT count as block', () => {
    const b = createEmptyBoard();
    placeLine(b, [
      [0, 0],
      [0, 1],
      [0, 2],
      [0, 3],
      [0, 4],
    ], 1);
    assert.equal(checkWin(b, 0, 2, 1), true);
  });

  it('vertical win', () => {
    const b = createEmptyBoard();
    placeLine(b, [
      [2, 8],
      [3, 8],
      [4, 8],
      [5, 8],
      [6, 8],
    ], 2);
    assert.equal(checkWin(b, 4, 8, 2), true);
  });

  it('diagonal win', () => {
    const b = createEmptyBoard();
    placeLine(b, [
      [1, 1],
      [2, 2],
      [3, 3],
      [4, 4],
      [5, 5],
    ], 1);
    assert.equal(checkWin(b, 3, 3, 1), true);
  });

  it('findWinLine returns ordered cells for horizontal win', () => {
    const b = createEmptyBoard();
    placeLine(b, [
      [7, 3],
      [7, 4],
      [7, 5],
      [7, 6],
      [7, 7],
    ], 1);
    const line = findWinLine(b, 7, 5, 1);
    assert.ok(line);
    assert.equal(line.cells.length, 5);
    assert.deepEqual(line.cells[0], [7, 3]);
    assert.deepEqual(line.cells[4], [7, 7]);
  });

  it('isValidMove basic', () => {
    const b = createEmptyBoard();
    assert.equal(isValidMove(b, 0, 0), true);
    b[0][0] = 1;
    assert.equal(isValidMove(b, 0, 0), false);
    assert.equal(isValidMove(b, -1, 0), false);
    assert.equal(isValidMove(b, 0, 15), false);
  });

  it('isBoardFull basic', () => {
    const b = createEmptyBoard();
    assert.equal(isBoardFull(b), false);
    for (let r = 0; r < BOARD_SIZE; r++) {
      for (let c = 0; c < BOARD_SIZE; c++) {
        b[r][c] = ((r + c) % 2) + 1;
      }
    }
    assert.equal(isBoardFull(b), true);
  });
});
