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

  const PANEL_MIN_W = 300;
  const PANEL_MAX_W = 520;
  const PANEL_RIGHT_MARGIN = 40;
  const ROW_PAD_X = 14;
  const ROW_PAD_Y = 12;
  const AVATAR_R = 26;
  const AVATAR_D = AVATAR_R * 2;
  const COL_GAP = 12;
  const BADGE_GAP = 10;
  const ROW_H_BASE = 68;
  const ROW_H_BADGE = 76;

  let panelW = PANEL_MIN_W;
  let rowH = ROW_H_BASE;

  const listRoot = new PIXI.Container();
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
  let lastShowTicketBadges = false;
  let lastContentH = 80;

  function placeListRoot() {
    listRoot.x = BASE_W - panelW - PANEL_RIGHT_MARGIN;
  }
  placeListRoot();

  function getMaxHeight() {
    return Math.min(BASE_H - 120, Math.max(80, lastContentH));
  }

  const animState = { height: 0 };

  function redrawPanel(height) {
    listPanel.clear();
    listMask.clear();
    if (height > 0) {
      listPanel.roundRect(0, 0, panelW, height, 14);
      listPanel.fill({ color: COLOR.panel, alpha: 0.92 });
      listPanel.stroke({ width: 1, color: 0x5a667a });

      listMask.roundRect(0, 0, panelW, height, 14);
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

  function makeTicketBadge(ready) {
    const label = ready ? 'đã sẵn sàng' : 'chưa chọn vé';
    const bgColor = ready ? COLOR.badgeReadyBg : COLOR.badgePendingBg;
    const textColor = ready ? COLOR.badgeReadyText : COLOR.badgePendingText;
    const t = makeText(label, {
      fontFamily: 'Segoe UI, system-ui, sans-serif',
      fontSize: 13,
      fill: textColor,
      fontWeight: '700',
    });
    const padX = 8;
    const padY = 4;
    const bw = Math.ceil(t.width) + padX * 2;
    const bh = Math.ceil(t.height) + padY * 2;
    const c = new PIXI.Container();
    const g = new PIXI.Graphics();
    g.roundRect(0, 0, bw, bh, 8);
    g.fill({ color: bgColor });
    t.x = padX;
    t.y = padY;
    c.addChild(g, t);
    c._badgeW = bw;
    c._badgeH = bh;
    return c;
  }

  function measureBadgeColW() {
    const a = makeTicketBadge(false);
    const b = makeTicketBadge(true);
    return Math.max(a._badgeW, b._badgeW);
  }

  function measureNameWidth(label) {
    const t = makeText(label || '?', {
      fontFamily: 'Segoe UI, system-ui, sans-serif',
      fontSize: 22,
      fill: COLOR.text,
      fontWeight: '600',
    });
    return Math.ceil(t.width);
  }

  function paintList(seats, hostPccuid, checkingPccuid, opts) {
    lastSeats = seats;
    lastHost = hostPccuid;
    lastChecking = checkingPccuid;
    lastShowTicketBadges = !!(opts && opts.showTicketBadges);
    const showTicketBadges = lastShowTicketBadges;
    rowH = showTicketBadges ? ROW_H_BADGE : ROW_H_BASE;

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

    const seatList = seats || [];
    const badgeColW = showTicketBadges ? measureBadgeColW() : 0;
    const handColW = !showTicketBadges && checkingPccuid ? 40 : 0;
    const rightColW = Math.max(badgeColW, handColW);

    let maxNameW = 72;
    for (const s of seatList) {
      maxNameW = Math.max(maxNameW, measureNameWidth(s.displayName || s.pccuid));
    }
    // Cap name column so panel stays on-screen; wrap instead of ellipsis-trim.
    const nameColCap = showTicketBadges ? 200 : 220;
    const nameColW = Math.min(maxNameW, nameColCap);

    const contentW =
      ROW_PAD_X +
      AVATAR_D +
      COL_GAP +
      nameColW +
      (rightColW ? BADGE_GAP + rightColW : 0) +
      ROW_PAD_X;
    panelW = Math.max(PANEL_MIN_W, Math.min(PANEL_MAX_W, contentW));
    placeListRoot();

    const nameX = ROW_PAD_X + AVATAR_D + COL_GAP;
    const rightColX = panelW - ROW_PAD_X - rightColW;
    let yCursor = ROW_PAD_Y;

    seatList.forEach((s) => {
      const row = new PIXI.Container();
      row.y = yCursor;
      row.x = 0;
      row.eventMode = 'static';

      const isHost = s.pccuid === hostPccuid;
      const nameText = makeText(s.displayName || s.pccuid, {
        fontFamily: 'Segoe UI, system-ui, sans-serif',
        fontSize: 22,
        fill: COLOR.text,
        fontWeight: '600',
        wordWrap: true,
        wordWrapWidth: nameColW,
        breakWords: true,
      });
      nameText.x = nameX;

      let hostTag = null;
      if (isHost) {
        hostTag = makeText('Host', {
          fontFamily: 'Segoe UI, system-ui, sans-serif',
          fontSize: 18,
          fill: COLOR.accent,
          fontWeight: '700',
        });
        hostTag.x = nameX;
      }

      const nameBlockH = nameText.height + (hostTag ? hostTag.height + 2 : 0);
      const thisRowH = Math.max(rowH, nameBlockH + 8, AVATAR_D + 8);
      const midY = thisRowH / 2;

      const av = new PIXI.Graphics();
      av.circle(ROW_PAD_X + AVATAR_R, midY, AVATAR_R);
      av.fill({ color: isHost ? COLOR.accent : 0x3a465c });

      const letter = makeText((s.displayName || '?').charAt(0).toUpperCase(), {
        fontFamily: 'Segoe UI, system-ui, sans-serif',
        fontSize: 26,
        fill: COLOR.text,
        fontWeight: '700',
      });
      letter.anchor.set(0.5);
      letter.x = ROW_PAD_X + AVATAR_R;
      letter.y = midY;
      row.addChild(av, letter);

      const textGroup = new PIXI.Container();
      textGroup.alpha = listVisible ? 1 : 0;
      row._textGroup = textGroup;
      row.addChild(textGroup);

      const nameTop = Math.max(0, (thisRowH - nameBlockH) / 2);
      nameText.y = nameTop;
      if (hostTag) {
        hostTag.y = nameTop + nameText.height + 2;
        textGroup.addChild(nameText, hostTag);
      } else {
        textGroup.addChild(nameText);
      }

      if (showTicketBadges && rightColW > 0) {
        const badge = makeTicketBadge(!!s.ticketId);
        badge.x = rightColX + (rightColW - badge._badgeW);
        badge.y = Math.max(0, midY - badge._badgeH / 2);
        row.addChild(badge);
      } else if (checkingPccuid && s.pccuid === checkingPccuid) {
        // On row (not textGroup) so hands stay visible while list panel is open.
        if (handsTexture) {
          const hand = new PIXI.Sprite(handsTexture);
          hand.width = 36;
          hand.height = 36;
          hand.anchor.set(0.5);
          hand.x = rightColX + rightColW / 2;
          hand.y = midY;
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
          handFallback.x = rightColX + rightColW / 2;
          handFallback.y = midY;
          row.addChild(handFallback);
        }
      }

      if (!s.connected) row.alpha = 0.45;
      listItems.addChild(row);
      yCursor += thisRowH;
    });

    lastContentH = seatList.length ? yCursor + ROW_PAD_Y : 80;

    const fullH = getMaxHeight();
    if (typeof gsap === 'undefined' || !gsap.isTweening(animState)) {
      animState.height = listVisible ? fullH : 0;
    }
    redrawPanel(animState.height);
    listRoot.visible = listVisible || (typeof gsap !== 'undefined' && gsap.isTweening(animState));
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
