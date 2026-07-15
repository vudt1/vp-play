window.Caro = window.Caro || {};

Caro.CONST = {
  BASE_W: 1920,
  BASE_H: 1080,
  BOARD_SIZE: 15,
  CELL: 62,
  MARK_PAD: 4,
  HEADER_CLEAR: 128,
  COLOR: {
    cream: 0xfef9e7,
    grid: 0x000000,
    host: 0xe53935,
    guest: 0x43a047,
    text: 0xe7ecf3,
    muted: 0x9aa3b2,
    panel: 0x12161f,
    btn: 0x2a3344,
    btnHover: 0x3a465c,
    turnRing: 0xffe082,
    turnGlow: 0xffd54f,
  },
  MARK: { X: 1, O: 2, 1: 'X', 2: 'O' },
};

Object.defineProperty(Caro.CONST, 'BOARD_PX', {
  get() {
    return Caro.CONST.BOARD_SIZE * Caro.CONST.CELL;
  },
});
