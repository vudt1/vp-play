window.Caro = window.Caro || {};

Caro.createBoardView = function createBoardView(opts) {
  const { layers, onCellTap } = opts;
  const { BOARD_SIZE, CELL, BOARD_PX, MARK_PAD, COLOR, BASE_W, BASE_H, HEADER_CLEAR } =
    Caro.CONST;

  const markSprites = new Map();
  const centeredY = Math.round((BASE_H - BOARD_PX) / 2);
  const origin = {
    x: Math.round((BASE_W - BOARD_PX) / 2),
    y: Math.max(HEADER_CLEAR || 128, centeredY),
  };

  function cellCenter(row, col) {
    return {
      x: col * CELL + CELL / 2,
      y: row * CELL + CELL / 2,
    };
  }

  function markKey(row, col) {
    return `${row},${col}`;
  }

  function drawBoard() {
    const g = new PIXI.Graphics();
    g.rect(0, 0, BOARD_PX, BOARD_PX);
    g.fill({ color: COLOR.cream });
    g.stroke({ width: 3, color: COLOR.grid });

    for (let i = 1; i < BOARD_SIZE; i++) {
      const p = i * CELL;
      g.moveTo(p, 0);
      g.lineTo(p, BOARD_PX);
      g.moveTo(0, p);
      g.lineTo(BOARD_PX, p);
    }
    g.stroke({ width: 1, color: COLOR.grid, alpha: 0.85 });

    g.eventMode = 'static';
    g.cursor = 'pointer';
    g.hitArea = new PIXI.Rectangle(0, 0, BOARD_PX, BOARD_PX);
    g.on('pointertap', (ev) => {
      const local = ev.getLocalPosition(layers.board);
      const col = Math.floor(local.x / CELL);
      const row = Math.floor(local.y / CELL);
      if (row < 0 || col < 0 || row >= BOARD_SIZE || col >= BOARD_SIZE) return;
      onCellTap?.(row, col);
    });

    layers.board.removeChildren();
    layers.board.addChild(g);
    layers.board.x = origin.x;
    layers.board.y = origin.y;
    layers.marks.x = origin.x;
    layers.marks.y = origin.y;
  }

  function placeMark(row, col, markVal, { animate = true } = {}) {
    const key = markKey(row, col);
    if (markSprites.has(key)) return;

    const letter = markVal === 1 || markVal === 'X' ? 'X' : 'O';
    const tex = PIXI.Texture.from(letter === 'X' ? 'mark-x' : 'mark-o');
    const spr = new PIXI.Sprite(tex);
    spr.anchor.set(0.5);
    const size = CELL - MARK_PAD * 2;
    spr.width = size;
    spr.height = size;
    const targetScale = spr.scale.x;
    const { x, y } = cellCenter(row, col);
    spr.x = x;
    spr.y = y;
    layers.marks.addChild(spr);
    markSprites.set(key, spr);

    if (animate && typeof gsap !== 'undefined') {
      spr.scale.set(0);
      gsap.to(spr.scale, {
        x: targetScale,
        y: targetScale,
        duration: 0.22,
        ease: 'back.out(2)',
      });
    }
  }

  function clearMarks() {
    for (const spr of markSprites.values()) {
      try {
        if (typeof gsap !== 'undefined') gsap.killTweensOf(spr.scale);
      } catch (_) {
        /* ignore */
      }
      spr.destroy();
    }
    markSprites.clear();
    layers.marks.removeChildren();
  }

  function syncFromMatch(match, { animateNew = false } = {}) {
    if (!match?.board) {
      clearMarks();
      return;
    }
    const seen = new Set();
    for (let r = 0; r < BOARD_SIZE; r++) {
      for (let c = 0; c < BOARD_SIZE; c++) {
        const v = match.board[r][c];
        if (!v) continue;
        const key = markKey(r, c);
        seen.add(key);
        if (!markSprites.has(key)) {
          placeMark(r, c, v, { animate: animateNew });
        }
      }
    }
    for (const key of [...markSprites.keys()]) {
      if (seen.has(key)) continue;
      const spr = markSprites.get(key);
      markSprites.delete(key);
      try {
        if (typeof gsap !== 'undefined') gsap.killTweensOf(spr.scale);
      } catch (_) {
        /* ignore */
      }
      spr.destroy();
    }
  }

  drawBoard();

  return {
    origin,
    placeMark,
    clearMarks,
    syncFromMatch,
    hasMark(row, col) {
      return markSprites.has(markKey(row, col));
    },
  };
};
