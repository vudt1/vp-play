window.Loto = window.Loto || {};

Loto.createHudView = function createHudView(uiLayer, overlayLayer) {
  const C = Loto.CONST;
  const { BASE_W, BASE_H, COLOR } = C;

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
      fontSize: 26,
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
    c._label = t;
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
    c.setLabel = (text) => {
      t.text = text;
    };
    return c;
  }

  const status = makeText('', {
    fontFamily: 'Segoe UI, system-ui, sans-serif',
    fontSize: 28,
    fill: COLOR.text,
    fontWeight: '600',
  });
  status.x = 48;
  status.y = 28;
  uiLayer.addChild(status);

  const btnPrepare = makeButton('Chuẩn bị vé', 240, 60);
  const btnStart = makeButton('Bắt đầu rao', 240, 60);
  const btnKinh = makeButton('Kinh', 200, 72);
  const btnPrev = makeButton('◀', 72, 56);
  const btnNext = makeButton('▶', 72, 56);
  const btnPick = makeButton('Chọn vé này', 220, 56);
  const btnClear = makeButton('Bỏ chọn', 160, 56);

  [btnPrepare, btnStart, btnKinh, btnPrev, btnNext, btnPick, btnClear].forEach((b) => {
    b.visible = false;
    overlayLayer.addChild(b);
  });

  btnPrepare.x = 48;
  btnPrepare.y = BASE_H - 100;
  btnStart.x = 310;
  btnStart.y = BASE_H - 100;
  btnKinh.x = (BASE_W - 200) / 2 - 120;
  btnKinh.y = BASE_H - 110;
  btnPrev.x = 48;
  btnPrev.y = BASE_H - 180;
  btnNext.x = 140;
  btnNext.y = BASE_H - 180;
  btnPick.x = 230;
  btnPick.y = BASE_H - 180;
  btnClear.x = 470;
  btnClear.y = BASE_H - 180;

  const PANEL_W = 280;
  const listRoot = new PIXI.Container();
  listRoot.x = BASE_W - PANEL_W - 40;
  listRoot.y = 80;
  uiLayer.addChild(listRoot);

  const listPanel = new PIXI.Graphics();
  listRoot.addChild(listPanel);

  const listMask = new PIXI.Graphics();
  listRoot.addChild(listMask);

  const listItems = new PIXI.Container();
  listItems.mask = listMask; // Crop elements when panel height shrinks
  listRoot.addChild(listItems);

  let lastSeats = [];
  let lastHost = null;
  let lastChecking = null;

  function getMaxHeight() {
    const h = Math.min(BASE_H - 120, 40 + (lastSeats?.length || 0) * 68);
    return Math.max(h, 80);
  }

  const animState = { height: 0 };

  function redrawPanel(height) {
    listPanel.clear();
    listMask.clear();
    if (height > 0) {
      listPanel.roundRect(0, 0, PANEL_W, height, 14);
      listPanel.fill({ color: COLOR.panel, alpha: 0.92 });
      listPanel.stroke({ width: 1, color: 0x5a667a });

      listMask.roundRect(0, 0, PANEL_W, height, 14);
      listMask.fill({ color: 0xffffff });
    }
  }

  let listVisible = true;
  const btnToggle = makeButton('▲', 48, 48);
  btnToggle.x = BASE_W - 70;
  btnToggle.y = 24;
  btnToggle.visible = true;
  overlayLayer.addChild(btnToggle); // Static on overlayLayer

  btnToggle.on('pointertap', () => {
    listVisible = !listVisible;
    btnToggle.setLabel(listVisible ? '▲' : '▼');
    const fullH = getMaxHeight();
    const targetH = listVisible ? fullH : 0;

    if (listVisible) {
      listRoot.visible = true;
    }

    if (typeof gsap !== 'undefined') {
      gsap.killTweensOf(animState);
      gsap.to(animState, {
        height: targetH,
        duration: 0.35,
        ease: 'power2.out',
        onUpdate: () => {
          redrawPanel(animState.height);
        },
        onComplete: () => {
          if (!listVisible) {
            listRoot.visible = false;
          }
        }
      });
    } else {
      animState.height = targetH;
      redrawPanel(targetH);
      listRoot.visible = listVisible;
    }
  });

  const checkingRoot = new PIXI.Container();
  checkingRoot.visible = false;
  overlayLayer.addChild(checkingRoot);
  const checkingBg = new PIXI.Graphics();
  const checkingText = makeText('', {
    fontFamily: 'Segoe UI, system-ui, sans-serif',
    fontSize: 32,
    fill: COLOR.text,
    fontWeight: '700',
  });
  checkingText.anchor.set(0.5);
  checkingRoot.addChild(checkingBg, checkingText);

  const resultRoot = new PIXI.Container();
  resultRoot.visible = false;
  overlayLayer.addChild(resultRoot);
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

  let handsTexture = null;

  function setHandsTexture(tex) {
    handsTexture = tex;
  }

  function paintList(seats, hostPccuid, checkingPccuid) {
    lastSeats = seats;
    lastHost = hostPccuid;
    lastChecking = checkingPccuid;

    if (typeof gsap !== 'undefined') {
      listItems.children.forEach((row) => {
        if (row._textGroup) {
          row._textGroup.children.forEach((child) => {
            gsap.killTweensOf(child);
          });
        }
      });
    }

    listItems.removeChildren();

    const fullH = getMaxHeight();
    if (typeof gsap === 'undefined' || !gsap.isTweening(animState)) {
      animState.height = listVisible ? fullH : 0;
    }
    redrawPanel(animState.height);
    listRoot.visible = listVisible || (typeof gsap !== 'undefined' && gsap.isTweening(animState));

    (seats || []).forEach((s, i) => {
      const row = new PIXI.Container();
      row.y = 16 + i * 68;
      row.x = 16;

      const av = new PIXI.Graphics();
      const r = 26; // Increased from 22 to 26 (size 52x52)
      av.circle(r, r, r);
      av.fill({ color: s.pccuid === hostPccuid ? COLOR.accent : 0x3a465c });

      const letter = makeText((s.displayName || '?').charAt(0).toUpperCase(), {
        fontFamily: 'Segoe UI, system-ui, sans-serif',
        fontSize: 26, // Increased from 22 to 26
        fill: COLOR.text,
        fontWeight: '700',
      });
      letter.anchor.set(0.5);
      letter.x = r;
      letter.y = r;
      row.addChild(av, letter);

      const textGroup = new PIXI.Container();
      textGroup.alpha = listVisible ? 1 : 0;
      row._textGroup = textGroup;
      row.addChild(textGroup);

      row.eventMode = 'static';
      const nameText = makeText(s.displayName || s.pccuid, {
        fontFamily: 'Segoe UI, system-ui, sans-serif',
        fontSize: 24,
        fill: COLOR.text,
        fontWeight: '600',
      });
      nameText.x = 80;

      if (s.pccuid === hostPccuid) {
        nameText.y = r - 26;

        const hostTag = makeText('Host', {
          fontFamily: 'Segoe UI, system-ui, sans-serif',
          fontSize: 20,
          fill: COLOR.accent,
          fontWeight: '700',
        });
        hostTag.x = 80;
        hostTag.y = r + 2;
        textGroup.addChild(nameText, hostTag);
      } else {
        nameText.y = r - 12;
        textGroup.addChild(nameText);
      }

      if (checkingPccuid && s.pccuid === checkingPccuid) {
        // On row (not textGroup) so hands stay visible while list panel is open.
        if (handsTexture) {
          const hand = new PIXI.Sprite(handsTexture);
          hand.width = 36;
          hand.height = 36;
          hand.anchor.set(0.5);
          hand.x = PANEL_W - 40;
          hand.y = r;
          row.addChild(hand);

          if (typeof gsap !== 'undefined') {
            gsap.to(hand, {
              rotation: 0.28,
              duration: 0.22,
              yoyo: true,
              repeat: -1,
              ease: 'sine.inOut',
            });
          }
        } else {
          const handFallback = makeText('✋', {
            fontFamily: 'Segoe UI Emoji, Segoe UI, sans-serif',
            fontSize: 28,
            fill: COLOR.gold,
          });
          handFallback.anchor.set(0.5);
          handFallback.x = PANEL_W - 40;
          handFallback.y = r;
          row.addChild(handFallback);
        }
      }

      if (!s.connected) row.alpha = 0.45;
      listItems.addChild(row);
    });
  }

  return {
    btnPrepare,
    btnStart,
    btnKinh,
    btnPrev,
    btnNext,
    btnPick,
    btnClear,
    setStatus(text) {
      status.text = text || '';
    },
    setHandsTexture,
    paintList,
    showChecking(name) {
      checkingText.text = `${name || 'Ai đó'} đang hô Kinh…`;
      const w = Math.min(700, checkingText.width + 80);
      const h = 80;
      checkingBg.clear();
      checkingBg.roundRect(-w / 2, -h / 2, w, h, 14);
      checkingBg.fill({ color: 0x0b0e14, alpha: 0.85 });
      checkingBg.stroke({ width: 2, color: COLOR.gold });
      checkingRoot.x = BASE_W / 2;
      checkingRoot.y = 100;
      checkingRoot.visible = true;
    },
    hideChecking() {
      checkingRoot.visible = false;
    },
    showResult(text) {
      resultText.text = text || '';
      const w = Math.min(760, Math.max(320, resultText.width + 80));
      const h = Math.max(72, resultText.height + 44);
      resultPanel.clear();
      resultPanel.roundRect(-w / 2, -h / 2, w, h, 16);
      resultPanel.fill({ color: 0x0b0e14, alpha: 0.82 });
      resultPanel.stroke({ width: 2, color: COLOR.gold });
      resultRoot.x = BASE_W / 2;
      resultRoot.y = BASE_H - 200;
      resultRoot.visible = true;
    },
    hideResult() {
      resultRoot.visible = false;
    },
  };
};
