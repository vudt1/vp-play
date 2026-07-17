window.Loto = window.Loto || {};

Loto.CONST = {
  BASE_W: 1920,
  BASE_H: 1080,
  TICKET_W: 1180,
  TICKET_H: 820,
  CELL_W: 118,
  CELL_H: 62,
  MATRIX_GAP: 28,
  TICKET_PAD_X: 48,
  TICKET_PAD_Y: 36,
  CHECK_SCALE: 0.3,
  COLOR: {
    bg: 0x12161f,
    cream: 0xf4f4f4,
    panel: 0x1a2030,
    text: 0xe7ecf3,
    muted: 0x9aa3b2,
    btn: 0x2a3344,
    btnHover: 0x3a465c,
    accent: 0xe74c3c,
    gold: 0xf4d03f,
    white: 0xffffff,
    line: 0x999999,
  },
  PHASE: {
    IDLE: 'idle',
    WAITING: 'waiting',
    PLAYING: 'playing',
    SETTLING: 'settling',
  },
};
