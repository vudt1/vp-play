window.Loto = window.Loto || {};

Loto.createBoardView = function createBoardView(opts) {
  const C = Loto.CONST;
  const { layer, onCellTap } = opts;
  const root = new PIXI.Container();
  layer.addChild(root);

  let cellMap = new Map();
  let marked = new Set();
  let frameTexture = null;
  let checkTexture = null;

  function hexToNum(hex) {
    if (!hex) return 0xcccccc;
    const s = String(hex).replace('#', '');
    return parseInt(s, 16);
  }

  function clear() {
    root.removeChildren();
    cellMap = new Map();
  }

  function setAssets(frame, check) {
    frameTexture = frame;
    checkTexture = check;
  }

  function setMarked(setOrArr) {
    marked = new Set([...(setOrArr || [])].map(Number));
    for (const [num, entry] of cellMap) {
      if (entry.check) entry.check.visible = marked.has(num);
    }
  }

  function toggleMark(n) {
    const num = Number(n);
    if (marked.has(num)) marked.delete(num);
    else marked.add(num);
    const entry = cellMap.get(num);
    if (entry?.check) entry.check.visible = marked.has(num);
    return marked.has(num);
  }

  function matrixRows(matrix) {
    if (!matrix) return [];
    return matrix.rows || matrix;
  }

  function renderTicket(ticket) {
    clear();
    if (!ticket) return;

    const bg = new PIXI.Graphics();
    bg.rect(0, 0, C.TICKET_W, C.TICKET_H);
    bg.fill({ color: C.COLOR.cream });
    root.addChild(bg);

    if (frameTexture) {
      const frame = new PIXI.Sprite(frameTexture);
      frame.width = C.TICKET_W;
      frame.height = C.TICKET_H;
      root.addChild(frame);
    }

    const theme = hexToNum(ticket.theme);
    const matrices = ticket.matrices || [];
    let y = C.TICKET_PAD_Y;
    const gridW = C.CELL_W * 9;
    const gridH = C.CELL_H * 3;
    const startX = (C.TICKET_W - gridW) / 2;
    const lines = new PIXI.Graphics();

    matrices.forEach((matrix, mIdx) => {
      const rows = matrixRows(matrix);
      const matrixRoot = new PIXI.Container();
      matrixRoot.x = startX;
      matrixRoot.y = y;

      for (let r = 0; r < 3; r += 1) {
        for (let c = 0; c < 9; c += 1) {
          const val = rows[r]?.[c];
          const cellX = c * C.CELL_W;
          const cellY = r * C.CELL_H;
          const g = new PIXI.Graphics();
          if (val == null) {
            g.rect(cellX + 1, cellY + 1, C.CELL_W - 2, C.CELL_H - 2);
            g.fill({ color: theme });
            matrixRoot.addChild(g);
          } else {
            const num = Number(val);
            g.rect(cellX + 1, cellY + 1, C.CELL_W - 2, C.CELL_H - 2);
            g.fill({ color: C.COLOR.white });
            g.stroke({ width: 1, color: 0xcccccc });
            const text = new PIXI.Text({
              text: String(num),
              style: {
                fontFamily: 'Segoe UI, system-ui, sans-serif',
                fontSize: 32,
                fill: 0x000000,
                fontWeight: '700',
              },
            });
            text.anchor.set(0.5);
            text.x = cellX + C.CELL_W / 2;
            text.y = cellY + C.CELL_H / 2;

            let check = null;
            if (checkTexture) {
              check = new PIXI.Sprite(checkTexture);
              const sz = Math.min(C.CELL_W, C.CELL_H) * C.CHECK_SCALE * 2.2;
              check.width = sz;
              check.height = sz;
              check.anchor.set(0.5);
              check.x = cellX + C.CELL_W / 2;
              check.y = cellY + C.CELL_H / 2;
              check.visible = marked.has(num);
            }

            const hit = new PIXI.Container();
            hit.eventMode = 'static';
            hit.cursor = 'pointer';
            hit.hitArea = new PIXI.Rectangle(cellX, cellY, C.CELL_W, C.CELL_H);
            hit.on('pointertap', () => onCellTap?.(num));
            hit.addChild(g, text);
            if (check) hit.addChild(check);
            matrixRoot.addChild(hit);
            cellMap.set(num, { check, text });
          }
        }
      }
      root.addChild(matrixRoot);

      if (mIdx < matrices.length - 1) {
        const ly = y + gridH + C.MATRIX_GAP / 2;
        lines.moveTo(C.TICKET_PAD_X, ly);
        lines.lineTo(C.TICKET_W - C.TICKET_PAD_X, ly);
        lines.stroke({ width: 4, color: C.COLOR.line });
      }
      y += gridH + C.MATRIX_GAP;
    });
    root.addChild(lines);
  }

  function renderPoolSlide(ticket, label) {
    renderTicket(ticket);
    if (label) {
      const t = new PIXI.Text({
        text: label,
        style: {
          fontFamily: 'Segoe UI, system-ui, sans-serif',
          fontSize: 22,
          fill: 0x333333,
          fontWeight: '600',
        },
      });
      t.x = C.TICKET_PAD_X;
      t.y = 8;
      root.addChild(t);
    }
  }

  return {
    root,
    setAssets,
    renderTicket,
    renderPoolSlide,
    clear,
    toggleMark,
    setMarked,
  };
};
