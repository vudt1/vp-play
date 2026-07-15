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

  const btnStart = makeButton('Bắt đầu', 220, 64);
  btnStart.x = (BASE_W - 220) / 2;
  btnStart.y = BASE_H - 110;
  btnStart.visible = false;
  uiLayer.addChild(btnStart);

  const overlayBg = new PIXI.Graphics();
  overlayBg.rect(0, 0, BASE_W, BASE_H);
  overlayBg.fill({ color: 0x000000, alpha: 0.55 });
  overlayBg.visible = false;

  const overlayText = makeText('', {
    fontFamily: 'Segoe UI, system-ui, sans-serif',
    fontSize: 48,
    fill: COLOR.text,
    fontWeight: '700',
    align: 'center',
    wordWrap: true,
    wordWrapWidth: 900,
  });
  overlayText.anchor.set(0.5);
  overlayText.x = BASE_W / 2;
  overlayText.y = BASE_H / 2;
  overlayText.visible = false;

  overlayLayer.addChild(overlayBg, overlayText);

  return {
    btnStart,
    setStartVisible(on, enabled) {
      btnStart.visible = !!on;
      btnStart.setEnabled(!!enabled);
    },
    hideOverlay() {
      overlayBg.visible = false;
      overlayText.visible = false;
    },
    showOverlay(text) {
      overlayText.text = text;
      overlayBg.visible = true;
      overlayText.visible = true;
    },
  };
};
