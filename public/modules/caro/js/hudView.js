window.Caro = window.Caro || {};

Caro.createHudView = function createHudView(uiLayer, overlayLayer) {
  const { BASE_W, BASE_H, COLOR } = Caro.CONST;

  function makeText(content, style) {
    return new PIXI.Text({ text: content, style });
  }

  function makeButton(label, w, h) {
    const c = new PIXI.Container();
    const g = new PIXI.Graphics();
    function paint(fill) {
      g.clear();
      g.roundRect(0, 0, w, h, 12);
      g.fill({ color: fill });
      g.stroke({ width: 1, color: 0x5a667a });
    }
    paint(COLOR.btn);
    const t = makeText(label, {
      fontFamily: 'Segoe UI, system-ui, sans-serif',
      fontSize: 28,
      fill: COLOR.text,
      fontWeight: '700',
    });
    t.anchor.set(0.5);
    t.x = w / 2;
    t.y = h / 2;
    c.addChild(g, t);
    c.eventMode = 'static';
    c.cursor = 'pointer';
    c._enabled = true;
    c.on('pointerover', () => {
      if (c._enabled) paint(COLOR.btnHover);
    });
    c.on('pointerout', () => {
      if (c._enabled) paint(COLOR.btn);
    });
    c.setEnabled = (on) => {
      c._enabled = !!on;
      c.alpha = on ? 1 : 0.35;
      c.eventMode = on ? 'static' : 'none';
      paint(COLOR.btn);
    };
    c.isEnabled = () => c._enabled;
    return c;
  }

  const resultRoot = new PIXI.Container();
  resultRoot.visible = false;
  resultRoot.eventMode = 'none';

  const resultPanel = new PIXI.Graphics();
  const resultText = makeText('', {
    fontFamily: 'Segoe UI, system-ui, sans-serif',
    fontSize: 40,
    fill: COLOR.text,
    fontWeight: '700',
    align: 'center',
    wordWrap: true,
    wordWrapWidth: 720,
  });
  resultText.anchor.set(0.5);
  resultRoot.addChild(resultPanel, resultText);
  overlayLayer.addChild(resultRoot);

  const btnStart = makeButton('Bắt đầu', 220, 64);
  btnStart.x = (BASE_W - 220) / 2;
  btnStart.y = BASE_H - 110;
  btnStart.visible = false;
  overlayLayer.addChild(btnStart);

  function layoutResult(text) {
    resultText.text = text || '';
    const padX = 40;
    const padY = 22;
    const w = Math.min(760, Math.max(320, resultText.width + padX * 2));
    const h = Math.max(72, resultText.height + padY * 2);
    resultPanel.clear();
    resultPanel.roundRect(-w / 2, -h / 2, w, h, 16);
    resultPanel.fill({ color: 0x0b0e14, alpha: 0.78 });
    resultPanel.stroke({ width: 2, color: COLOR.turnGlow, alpha: 0.85 });
    resultRoot.x = BASE_W / 2;
    resultRoot.y = BASE_H - 200;
  }

  return {
    btnStart,
    setStartVisible(on, enabled) {
      btnStart.visible = !!on;
      btnStart.setEnabled(!!enabled);
      if (btnStart.visible) {
        overlayLayer.addChild(btnStart);
      }
    },
    hideResult() {
      resultRoot.visible = false;
    },
    showResult(text) {
      layoutResult(text);
      resultRoot.visible = true;
      overlayLayer.addChild(resultRoot);
      if (btnStart.visible) overlayLayer.addChild(btnStart);
    },
    hideOverlay() {
      resultRoot.visible = false;
    },
    showOverlay(text) {
      this.showResult(text);
    },
  };
};
