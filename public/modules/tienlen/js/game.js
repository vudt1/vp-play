(async function () {
  const BASE_W = 1920;
  const BASE_H = 1080;
  const RANK = ['3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A', '2'];
  const SUIT = ['S', 'C', 'D', 'H'];

  const base = window.VP_BASE || '';
  const moduleRoot = `${base}/modules/tienlen`;

  function socketPath() {
    return base ? `${base}/socket.io` : '/socket.io';
  }

  function assetName(id) {
    return SUIT[id % 4] + RANK[Math.floor(id / 4)];
  }

  function cardAssetUrl(name) {
    return `${moduleRoot}/assets/images/cards/${name}.svg`;
  }

  const state = {
    token: null,
    profile: null,
    socket: null,
    room: null,
    hand: [],
    selected: new Set(),
    cardSprites: new Map(),
    tableCards: [],
    animating: false,
  };

  const app = new PIXI.Application();
  await app.init({
    width: BASE_W,
    height: BASE_H,
    backgroundColor: 0x05070b,
    antialias: true,
    resolution: Math.min(window.devicePixelRatio || 1, 2),
    autoDensity: true,
  });

  const root = document.getElementById('game-root');
  root.appendChild(app.canvas);

  function applyLetterbox() {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const scale = Math.min(vw / BASE_W, vh / BASE_H);
    const w = Math.floor(BASE_W * scale);
    const h = Math.floor(BASE_H * scale);
    app.canvas.style.width = `${w}px`;
    app.canvas.style.height = `${h}px`;
  }
  window.addEventListener('resize', applyLetterbox);
  applyLetterbox();

  const world = new PIXI.Container();
  app.stage.addChild(world);

  await PIXI.Assets.load([
    { alias: 'table', src: `${moduleRoot}/assets/images/table.jpg` },
    { alias: 'card-back', src: `${moduleRoot}/assets/images/card-back.png` },
    ...Array.from({ length: 52 }, (_, id) => ({
      alias: `card-${id}`,
      src: cardAssetUrl(assetName(id)),
    })),
  ]);

  SoundManager.init(moduleRoot);

  const tableSprite = PIXI.Sprite.from('table');
  tableSprite.width = BASE_W;
  tableSprite.height = BASE_H;
  world.addChild(tableSprite);

  const dim = new PIXI.Graphics();
  dim.rect(0, 0, BASE_W, BASE_H);
  dim.fill({ color: 0x000000, alpha: 0.25 });
  world.addChild(dim);

  const layers = {
    seats: new PIXI.Container(),
    play: new PIXI.Container(),
    hand: new PIXI.Container(),
    ui: new PIXI.Container(),
  };
  world.addChild(layers.seats);
  world.addChild(layers.play);
  world.addChild(layers.hand);
  world.addChild(layers.ui);

  const backTex = PIXI.Texture.from('card-back');
  const deck = new Deck(layers.play, backTex);

  const ui = buildUi(layers.ui);
  const seatViews = {};

  const SEAT_LAYOUT = {
    bottom: { x: 320, y: 980, align: 'left' },
    top: { x: 960, y: 90, align: 'center' },
    left: { x: 160, y: 480, align: 'left' },
    right: { x: 1760, y: 480, align: 'right' },
  };

  function seatSlotsForCount(n) {
    if (n <= 2) return ['bottom', 'top'];
    if (n === 3) return ['bottom', 'top', 'left'];
    return ['bottom', 'top', 'left', 'right'];
  }

  function relativeSeatMap(room, me) {
    const seats = room.seats || [];
    const myIdx = seats.findIndex((s) => s.pccuid === me);
    if (myIdx < 0) return {};
    const slots = seatSlotsForCount(seats.length);
    const map = {};
    for (let i = 0; i < seats.length; i += 1) {
      const seat = seats[(myIdx + i) % seats.length];
      map[seat.pccuid] = slots[i];
    }
    return map;
  }

  function ensureSeatView(key) {
    if (seatViews[key]) return seatViews[key];
    const pos = SEAT_LAYOUT[key];
    const g = new PIXI.Container();
    g.x = pos.x;
    g.y = pos.y;

    const light = new PIXI.Graphics();
    light.circle(0, 0, 16);
    light.fill(0x2a3548);
    light.x = pos.align === 'left' ? -88 : pos.align === 'right' ? 88 : -110;
    light.y = 0;

    const name = new PIXI.Text({
      text: '',
      style: {
        fontFamily: 'Segoe UI, system-ui, sans-serif',
        fontSize: 30,
        fill: 0xe7ecf3,
        fontWeight: '600',
      },
    });
    name.anchor.set(pos.align === 'right' ? 1 : pos.align === 'left' ? 0 : 0.5, 0.5);
    name.x = pos.align === 'left' ? -58 : pos.align === 'right' ? 58 : 0;
    name.y = 0;

    const meta = new PIXI.Text({
      text: '',
      style: {
        fontFamily: 'Segoe UI, system-ui, sans-serif',
        fontSize: 22,
        fill: 0x8b9bb4,
      },
    });
    meta.anchor.set(name.anchor.x, 0.5);
    meta.x = name.x;
    meta.y = 34;

    g.addChild(light);
    g.addChild(name);
    g.addChild(meta);
    layers.seats.addChild(g);

    seatViews[key] = { g, light, name, meta, blinkTween: null };
    return seatViews[key];
  }

  function setLightActive(view, active) {
    if (view.blinkTween) {
      view.blinkTween.kill();
      view.blinkTween = null;
    }
    view.light.clear();
    if (active) {
      view.light.circle(0, 0, 18);
      view.light.fill(0x22c55e);
      view.blinkTween = gsap.to(view.light, {
        alpha: 0.25,
        duration: 0.55,
        yoyo: true,
        repeat: -1,
        ease: 'sine.inOut',
      });
    } else {
      view.light.alpha = 1;
      view.light.circle(0, 0, 16);
      view.light.fill(0x2a3548);
    }
  }

  function buildUi(parent) {
    const title = new PIXI.Text({
      text: 'Tiến Lên Miền Nam',
      style: {
        fontFamily: 'Segoe UI, system-ui, sans-serif',
        fontSize: 36,
        fill: 0xe7ecf3,
        fontWeight: '700',
      },
    });
    title.x = 40;
    title.y = 20;
    parent.addChild(title);

    const status = new PIXI.Text({
      text: 'Chờ xác thực từ portal…',
      style: {
        fontFamily: 'Segoe UI, system-ui, sans-serif',
        fontSize: 24,
        fill: 0x8b9bb4,
      },
    });
    status.x = 40;
    status.y = 68;
    parent.addChild(status);

    const last = new PIXI.Text({
      text: '',
      style: {
        fontFamily: 'Segoe UI, system-ui, sans-serif',
        fontSize: 28,
        fill: 0xc5d0e0,
      },
    });
    last.anchor.set(0.5);
    last.x = 960;
    last.y = 300;
    parent.addChild(last);

    const error = new PIXI.Text({
      text: '',
      style: {
        fontFamily: 'Segoe UI, system-ui, sans-serif',
        fontSize: 24,
        fill: 0xf07178,
      },
    });
    error.anchor.set(0.5);
    error.x = 960;
    error.y = 348;
    parent.addChild(error);

    function makeButton(label, x, y, primary) {
      const c = new PIXI.Container();
      c.x = x;
      c.y = y;
      c.eventMode = 'static';
      c.cursor = 'pointer';
      const bg = new PIXI.Graphics();
      const draw = (enabled) => {
        bg.clear();
        bg.roundRect(0, 0, 188, 56, 12);
        bg.fill(enabled ? (primary ? 0x3d8bfd : 0x243044) : 0x1a2332);
        bg.stroke({ width: 1, color: 0x2a3548 });
        c.alpha = enabled ? 1 : 0.45;
      };
      draw(false);
      const t = new PIXI.Text({
        text: label,
        style: {
          fontFamily: 'Segoe UI, system-ui, sans-serif',
          fontSize: 24,
          fill: 0xe7ecf3,
          fontWeight: '600',
        },
      });
      t.anchor.set(0.5);
      t.x = 94;
      t.y = 28;
      c.addChild(bg);
      c.addChild(t);
      c._setEnabled = (en) => {
        c._enabled = en;
        draw(en);
        c.eventMode = en ? 'static' : 'none';
      };
      c._enabled = false;
      parent.addChild(c);
      return c;
    }

    const btnStart = makeButton('Start (Host)', 1440, 24, true);
    const btnLeave = makeButton('Rời phòng', 1648, 24, false);
    btnLeave._setEnabled(true);
    const btnPlay = makeButton('Đánh', 746, 996, true);
    const btnPass = makeButton('Bỏ lượt', 954, 996, false);

    return { status, last, error, btnStart, btnLeave, btnPlay, btnPass };
  }

  function showError(err) {
    const msg = err?.message || err?.code || 'Error';
    ui.error.text = msg;
    setTimeout(() => {
      if (ui.error.text === msg) ui.error.text = '';
    }, 4000);
  }

  function clearHandSprites() {
    for (const card of state.cardSprites.values()) card.destroy();
    state.cardSprites.clear();
    layers.hand.removeChildren();
  }

  function clearTableCards() {
    for (const card of state.tableCards) card.destroy();
    state.tableCards = [];
  }

  function handLayout(count) {
    const spacing = Math.min(78, 900 / Math.max(count, 1));
    const total = spacing * (count - 1);
    const startX = 960 - total / 2;
    const y = 860;
    return Array.from({ length: count }, (_, i) => ({ x: startX + i * spacing, y }));
  }

  async function renderHand(animateDeal) {
    const ids = [...state.hand].sort((a, b) => a - b);
    const positions = handLayout(ids.length);

    if (animateDeal) {
      clearHandSprites();
      deck.showStock(8);
      const cards = ids.map((id) => {
        const card = deck.createCard(id, PIXI.Texture.from(`card-${id}`));
        layers.hand.addChild(card.container);
        state.cardSprites.set(id, card);
        return card;
      });
      state.animating = true;
      await Animations.dealCards(cards, positions, { x: 960, y: 420 });
      deck.showStock(0);
      for (const card of cards) {
        await card.setFaceUp(true, true);
        card.setInteractive(true, onCardTap);
      }
      state.animating = false;
    } else {
      const keep = new Set(ids);
      for (const [id, card] of [...state.cardSprites.entries()]) {
        if (!keep.has(id)) {
          card.destroy();
          state.cardSprites.delete(id);
        }
      }
      ids.forEach((id, i) => {
        let card = state.cardSprites.get(id);
        if (!card) {
          card = deck.createCard(id, PIXI.Texture.from(`card-${id}`));
          card.setFaceUp(true, false);
          layers.hand.addChild(card.container);
          state.cardSprites.set(id, card);
        }
        card.baseY = positions[i].y;
        card.x = positions[i].x;
        card.y = positions[i].y + (state.selected.has(id) ? -28 : 0);
        card.selected = state.selected.has(id);
        card.setInteractive(true, onCardTap);
      });
    }
    updateActionButtons();
  }

  function onCardTap(card) {
    if (state.animating) return;
    if (state.selected.has(card.cardId)) state.selected.delete(card.cardId);
    else state.selected.add(card.cardId);
    card.setSelected(state.selected.has(card.cardId));
    updateActionButtons();
  }

  function updateActionButtons() {
    const room = state.room;
    const me = state.profile?.pccuid;
    const isHost = room && room.hostPccuid === me;
    const canStart =
      isHost &&
      room &&
      (room.phase === 'waiting' || room.phase === 'idle') &&
      room.seats.length >= 2;
    ui.btnStart._setEnabled(!!canStart);

    const myTurn = room?.hand?.currentTurn === me;
    ui.btnPlay._setEnabled(!!myTurn && state.selected.size > 0 && !state.animating);
    ui.btnPass._setEnabled(!!myTurn && room?.hand && !room.hand.freeLead && !state.animating);
  }

  function renderSeats() {
    Object.values(seatViews).forEach((v) => {
      v.g.visible = false;
    });
    const room = state.room;
    if (!room || !state.profile) return;
    const map = relativeSeatMap(room, state.profile.pccuid);
    for (const seat of room.seats) {
      const slot = map[seat.pccuid];
      if (!slot) continue;
      const view = ensureSeatView(slot);
      view.g.visible = true;
      const host = room.hostPccuid === seat.pccuid ? ' · Host' : '';
      const offline = seat.connected === false ? ' (offline)' : '';
      view.name.text = `${seat.displayName}${host}${offline}`;
      const count = room.hand?.cardCounts?.[seat.pccuid];
      view.meta.text = count != null ? `${count} lá` : '';
      setLightActive(view, room.hand?.currentTurn === seat.pccuid);
    }
  }

  function renderLast() {
    const h = state.room?.hand;
    if (!h) {
      ui.last.text = '';
      return;
    }
    if (h.lastCombo) {
      const c = h.lastCombo;
      ui.last.text = `Bài trên bàn: ${c.type} [${c.cards.map(assetName).join(', ')}]`;
    } else if (h.freeLead && h.mustIncludeOpening) {
      ui.last.text = `Lượt mở: phải có ${assetName(h.openingCardId)}`;
    } else if (h.freeLead) {
      ui.last.text = 'Lượt tự do';
    } else {
      ui.last.text = '';
    }
  }

  async function syncTableFromRoom() {
    const h = state.room?.hand;
    if (!h?.lastCombo) {
      clearTableCards();
      return;
    }
    const cards = h.lastCombo.cards;
    const same =
      state.tableCards.length === cards.length &&
      state.tableCards.every((c, i) => c.cardId === cards[i]);
    if (same) return;
    clearTableCards();
    cards.forEach((id, i) => {
      const card = deck.createCard(id, PIXI.Texture.from(`card-${id}`));
      card.setFaceUp(true, false);
      card.x = 960 + (i - (cards.length - 1) / 2) * 36;
      card.y = 480;
      card.container.scale.set(0.92);
      layers.play.addChild(card.container);
      state.tableCards.push(card);
    });
  }

  function render() {
    const room = state.room;
    if (!room) {
      ui.status.text = 'Chưa vào phòng. Chọn phòng trên portal.';
      renderSeats();
      updateActionButtons();
      ui.last.text = '';
      return;
    }
    ui.status.text = `Phòng ${room.id} · ${room.phase} · ${room.seats.length}/4`;
    renderSeats();
    renderLast();
    syncTableFromRoom();
    updateActionButtons();
  }

  ui.btnStart.on('pointertap', () => {
    if (!ui.btnStart._enabled) return;
    state.socket?.emit('room:start', {}, (res) => {
      if (res && !res.ok) showError(res.error);
    });
  });

  ui.btnLeave.on('pointertap', () => {
    state.socket?.emit('room:leave', {}, () => {
      state.room = null;
      state.hand = [];
      state.selected.clear();
      clearHandSprites();
      clearTableCards();
      render();
      ui.status.text = 'Đã rời phòng';
    });
  });

  ui.btnPlay.on('pointertap', () => {
    if (!ui.btnPlay._enabled) return;
    const cardIds = [...state.selected];
    state.socket?.emit('hand:play', { cardIds }, async (res) => {
      if (res && !res.ok) {
        showError(res.error);
        return;
      }
      const played = cardIds.map((id) => state.cardSprites.get(id)).filter(Boolean);
      state.selected.clear();
      state.hand = state.hand.filter((c) => !cardIds.includes(c));
      if (played.length) {
        state.animating = true;
        await Animations.playToTable(played, { x: 960, y: 480 });
        for (const c of played) {
          state.cardSprites.delete(c.cardId);
          state.tableCards.push(c);
        }
        state.animating = false;
      }
      await renderHand(false);
      render();
    });
  });

  ui.btnPass.on('pointertap', () => {
    if (!ui.btnPass._enabled) return;
    state.socket?.emit('hand:pass', {}, (res) => {
      if (res && !res.ok) showError(res.error);
    });
  });

  function connect() {
    if (state.socket) state.socket.disconnect();
    ui.status.text = 'Đang kết nối…';
    state.socket = io({ path: socketPath(), auth: { token: state.token } });

    state.socket.on('connect', () => {
      ui.status.text = 'Đã kết nối';
      state.socket.emit('room:list');
    });

    state.socket.on('connect_error', (err) => {
      ui.status.text = 'Lỗi kết nối: ' + (err.message || 'auth');
    });

    state.socket.on('room:list', (list) => {
      if (!state.profile) return;
      const mine = (list || []).find((r) =>
        r.seats.some((s) => s.pccuid === state.profile.pccuid)
      );
      if (mine) {
        state.room = mine;
        render();
      } else if (state.room) {
        state.room = null;
        state.hand = [];
        state.selected.clear();
        clearHandSprites();
        clearTableCards();
        render();
      }
    });

    state.socket.on('room:state', (room) => {
      if (!state.profile) return;
      if (room.seats.some((s) => s.pccuid === state.profile.pccuid)) {
        state.room = room;
        render();
      } else if (state.room && state.room.id === room.id) {
        state.room = null;
        state.hand = [];
        state.selected.clear();
        clearHandSprites();
        clearTableCards();
        render();
      }
    });

    state.socket.on('hand:dealt', async ({ cards }) => {
      state.hand = [...(cards || [])].sort((a, b) => a - b);
      state.selected.clear();
      clearTableCards();
      ui.status.text = 'Đã chia bài';
      await renderHand(true);
      render();
    });

    state.socket.on('hand:error', (err) => showError(err));

    state.socket.on('hand:finished', (payload) => {
      const mine = payload.pointsDelta?.[state.profile?.pccuid];
      ui.status.text =
        'Ván xong. Điểm: ' +
        (mine >= 0 ? '+' : '') +
        (mine ?? 0) +
        ' · ' +
        (payload.finishOrder || []).join(' → ');
      if (mine != null && mine > 0) {
        Animations.celebrateWin(layers.ui, 960, 400);
      } else if (mine != null && mine < 0) {
        Animations.showBanner(layers.ui, 'Thua ván', 0xff4444);
      }
      state.hand = [];
      state.selected.clear();
      clearHandSprites();
      clearTableCards();
      render();
    });
  }

  function setGameVisible(visible) {
    if (globalThis.SoundManager?.setMuted) {
      SoundManager.setMuted(!visible);
    } else if (typeof Howler !== 'undefined') {
      Howler.mute(!visible);
    }
  }

  function teardown() {
    setGameVisible(false);
    if (state.socket) {
      try {
        state.socket.disconnect();
      } catch (_) {
        /* ignore */
      }
      state.socket = null;
    }
    state.room = null;
    state.hand = [];
    state.selected.clear();
    try {
      clearHandSprites();
      clearTableCards();
    } catch (_) {
      /* ignore */
    }
    Object.values(seatViews).forEach((v) => {
      if (v.blinkTween) {
        v.blinkTween.kill();
        v.blinkTween = null;
      }
    });
    try {
      if (typeof gsap !== 'undefined') gsap.globalTimeline.clear();
    } catch (_) {
      /* ignore */
    }
    try {
      app.destroy(true, { children: true, texture: false });
    } catch (_) {
      /* ignore */
    }
  }

  window.parent.postMessage({ type: 'vp-game-ready' }, window.location.origin);

  window.addEventListener('message', (ev) => {
    if (ev.origin !== window.location.origin) return;
    const type = ev.data?.type;
    if (type === 'vp-auth') {
      state.token = ev.data.token;
      state.profile = ev.data.profile;
      connect();
      return;
    }
    if (type === 'vp-game-visibility') {
      setGameVisible(ev.data.visible !== false);
      return;
    }
    if (type === 'vp-game-teardown') {
      teardown();
    }
  });
})();
