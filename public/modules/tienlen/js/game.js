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
    opponentStacks: {},
    animating: false,
    destroyed: false,
  };

  const app = new PIXI.Application();
  await app.init({
    width: window.innerWidth || BASE_W,
    height: window.innerHeight || BASE_H,
    backgroundColor: 0x000000,
    antialias: true,
    resolution: Math.min(window.devicePixelRatio || 1, 2),
    autoDensity: true,
  });

  const root = document.getElementById('game-root');
  root.appendChild(app.canvas);

  const stageRoot = new PIXI.Container();
  app.stage.addChild(stageRoot);

  const world = new PIXI.Container();
  stageRoot.addChild(world);

  let letterboxRaf = 0;
  let lastLetterbox = { vw: 0, vh: 0 };

  function applyLetterbox() {
    if (state.destroyed) return;
    const vw = Math.max(1, window.innerWidth || BASE_W);
    const vh = Math.max(1, window.innerHeight || BASE_H);
    if (vw === lastLetterbox.vw && vh === lastLetterbox.vh) return;
    lastLetterbox = { vw, vh };
    app.renderer.resize(vw, vh);
    const scale = Math.min(vw / BASE_W, vh / BASE_H);
    stageRoot.scale.set(scale);
    stageRoot.x = (vw - BASE_W * scale) / 2;
    stageRoot.y = (vh - BASE_H * scale) / 2;
  }

  function onWindowResize() {
    if (letterboxRaf) return;
    letterboxRaf = requestAnimationFrame(() => {
      letterboxRaf = 0;
      applyLetterbox();
    });
  }

  function onVisibilityChange() {
    setGameVisible(document.visibilityState === 'visible');
  }

  function onParentMessage(ev) {
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
  }

  window.addEventListener('resize', onWindowResize);
  window.addEventListener('message', onParentMessage);
  document.addEventListener('visibilitychange', onVisibilityChange);
  applyLetterbox();

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
    opponents: new PIXI.Container(),
    play: new PIXI.Container(),
    hand: new PIXI.Container(),
    ui: new PIXI.Container(),
  };
  world.addChild(layers.seats);
  world.addChild(layers.opponents);
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

  const OPPONENT_STACK = {
    top: {
      cx: 960,
      cy: 210,
      axis: 'x',
      box: 900,
      scale: 0.78,
      maxStep: 46,
      minStep: 12,
    },
    left: {
      cx: 220,
      cy: 480,
      axis: 'y',
      box: 420,
      scale: 0.42,
      maxStep: 22,
      minStep: 5,
    },
    right: {
      cx: 1700,
      cy: 480,
      axis: 'y',
      box: 420,
      scale: 0.42,
      maxStep: 22,
      minStep: 5,
    },
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
        fontSize: 33,
        fill: 0xe7ecf3,
        fontWeight: '600',
      },
    });
    name.anchor.set(pos.align === 'right' ? 1 : pos.align === 'left' ? 0 : 0.5, 0.5);
    name.x = pos.align === 'left' ? -58 : pos.align === 'right' ? 58 : 0;
    name.y = 0;

    g.addChild(light);
    g.addChild(name);
    layers.seats.addChild(g);

    seatViews[key] = { g, light, name, blinkTween: null };
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

  function stackStep(count, cfg) {
    if (count <= 1) return 0;
    const step = cfg.box / (count - 1);
    return Math.max(cfg.minStep, Math.min(cfg.maxStep, step));
  }

  function clearOpponentStacks() {
    for (const key of Object.keys(state.opponentStacks)) {
      const entry = state.opponentStacks[key];
      if (entry?.container) entry.container.destroy({ children: true });
    }
    state.opponentStacks = {};
    layers.opponents.removeChildren();
  }

  function renderOpponentStacks(map, cardCounts, me) {
    const keep = new Set();
    for (const [pccuid, slot] of Object.entries(map)) {
      if (pccuid === me || slot === 'bottom') continue;
      const cfg = OPPONENT_STACK[slot];
      if (!cfg) continue;
      const count = cardCounts?.[pccuid] ?? 0;
      keep.add(slot);
      let entry = state.opponentStacks[slot];
      if (!entry) {
        const container = new PIXI.Container();
        layers.opponents.addChild(container);
        entry = { container, sprites: [], count: -1 };
        state.opponentStacks[slot] = entry;
      }
      if (entry.count === count && entry.sprites.length === count) continue;
      entry.container.removeChildren();
      for (const s of entry.sprites) s.destroy();
      entry.sprites = [];
      entry.count = count;
      if (count <= 0) continue;
      const step = stackStep(count, cfg);
      const span = step * (count - 1);
      const scale = cfg.scale;
      const w = Card.WIDTH * scale;
      const h = Card.HEIGHT * scale;
      for (let i = 0; i < count; i += 1) {
        const spr = new PIXI.Sprite(backTex);
        spr.anchor.set(0.5);
        spr.width = w;
        spr.height = h;
        if (cfg.axis === 'x') {
          spr.x = cfg.cx - span / 2 + i * step;
          spr.y = cfg.cy;
        } else {
          spr.x = cfg.cx;
          spr.y = cfg.cy - span / 2 + i * step;
        }
        entry.container.addChild(spr);
        entry.sprites.push(spr);
      }
    }
    for (const slot of Object.keys(state.opponentStacks)) {
      if (!keep.has(slot)) {
        const entry = state.opponentStacks[slot];
        entry.container.destroy({ children: true });
        delete state.opponentStacks[slot];
      }
    }
  }

  function buildUi(parent) {
    const title = new PIXI.Text({
      text: 'Tiến Lên Miền Nam',
      style: {
        fontFamily: 'Segoe UI, system-ui, sans-serif',
        fontSize: 46,
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

    const turnTimer = new PIXI.Text({
      text: '',
      style: {
        fontFamily: 'Segoe UI, system-ui, sans-serif',
        fontSize: 36,
        fill: 0xe7ecf3,
        fontWeight: '700',
      },
    });
    turnTimer.anchor.set(0.5);
    turnTimer.x = 960;
    turnTimer.y = 250;
    parent.addChild(turnTimer);

    function makeButton(label, x, y, primary, opts = {}) {
      const padX = opts.padX ?? 28;
      const height = opts.height ?? 56;
      const minWidth = opts.minWidth ?? 148;
      const fontSize = opts.fontSize ?? 28;
      const c = new PIXI.Container();
      c.x = x;
      c.y = y;
      c.eventMode = 'static';
      c.cursor = 'pointer';
      const bg = new PIXI.Graphics();
      const t = new PIXI.Text({
        text: label,
        style: {
          fontFamily: 'Segoe UI, system-ui, sans-serif',
          fontSize,
          fill: 0xe7ecf3,
          fontWeight: '600',
        },
      });
      t.anchor.set(0.5);
      const width = Math.max(minWidth, Math.ceil(t.width) + padX * 2);
      t.x = width / 2;
      t.y = height / 2;
      const draw = (enabled) => {
        bg.clear();
        bg.roundRect(0, 0, width, height, 12);
        bg.fill(enabled ? (primary ? 0x3d8bfd : 0x243044) : 0x1a2332);
        bg.stroke({ width: 1, color: 0x2a3548 });
        c.alpha = enabled ? 1 : 0.45;
      };
      draw(false);
      c.addChild(bg);
      c.addChild(t);
      c._width = width;
      c._setEnabled = (en) => {
        c._enabled = en;
        draw(en);
        c.eventMode = en ? 'static' : 'none';
      };
      c._enabled = false;
      parent.addChild(c);
      return c;
    }

    const btnLeave = makeButton('Rời phòng', 0, 24, false);
    const btnStart = makeButton('Bắt đầu (Host)', 0, 24, true);
    const gap = 16;
    const rightEdge = 1880;
    btnLeave.x = rightEdge - btnLeave._width;
    btnStart.x = btnLeave.x - gap - btnStart._width;
    btnLeave._setEnabled(true);
    const btnPlay = makeButton('Đánh', 746, 996, true, { minWidth: 188 });
    const btnPass = makeButton('Bỏ lượt', 954, 996, false, { minWidth: 188 });

    return { status, last, error, turnTimer, btnStart, btnLeave, btnPlay, btnPass };
  }

  function showError(err) {
    const msg =
      (typeof err === 'string' ? err : null) ||
      err?.message ||
      err?.code ||
      'Lỗi';
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

  function killSeatBlinks() {
    Object.values(seatViews).forEach((v) => {
      if (v.blinkTween) {
        v.blinkTween.kill();
        v.blinkTween = null;
      }
      setLightActive(v, false);
    });
  }

  function resetPlaySurface({ keepRoom = true, statusText, clearRoomHand = false } = {}) {
    state.hand = [];
    state.selected.clear();
    state.animating = false;
    clearHandSprites();
    clearTableCards();
    clearOpponentStacks();
    killSeatBlinks();
    ui.last.text = '';
    ui.turnTimer.text = '';
    ui.error.text = '';
    try {
      if (typeof gsap !== 'undefined') gsap.globalTimeline.clear();
    } catch (_) {
      /* ignore */
    }
    if (!keepRoom) {
      state.room = null;
    } else if (clearRoomHand && state.room) {
      state.room = {
        ...state.room,
        hand: null,
        phase: state.room.seats?.length ? 'waiting' : 'idle',
      };
    }
    render();
    if (statusText != null) ui.status.text = statusText;
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
    if (!room || !state.profile) {
      clearOpponentStacks();
      return;
    }
    const me = state.profile.pccuid;
    const map = relativeSeatMap(room, me);
    for (const seat of room.seats) {
      const slot = map[seat.pccuid];
      if (!slot) continue;
      const view = ensureSeatView(slot);
      view.g.visible = true;
      const host = room.hostPccuid === seat.pccuid ? ' · Host' : '';
      const offline = seat.connected === false ? ' (offline)' : '';
      view.name.text = `${seat.displayName}${host}${offline}`;
      setLightActive(view, room.hand?.currentTurn === seat.pccuid);
    }
    if (room.hand?.cardCounts) {
      renderOpponentStacks(map, room.hand.cardCounts, me);
    } else {
      clearOpponentStacks();
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

  function formatTurnSeconds(msLeft) {
    const sec = Math.max(0, Math.ceil(msLeft / 1000));
    return sec;
  }

  function renderTurnTimer() {
    const h = state.room?.hand;
    const timer = ui.turnTimer;
    if (!h || h.turnDeadline == null || !h.currentTurn) {
      timer.text = '';
      return;
    }
    const me = state.profile?.pccuid;
    const seat = (state.room.seats || []).find((s) => s.pccuid === h.currentTurn);
    const name = seat?.displayName || h.currentTurn;
    const sec = formatTurnSeconds(h.turnDeadline - Date.now());
    const mine = me && h.currentTurn === me;
    timer.text = mine ? `Lượt của bạn · ${sec}s` : `${name} · ${sec}s`;
    timer.style.fill = sec <= 5 ? 0xf07178 : mine ? 0x22c55e : 0xe7ecf3;
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
      ui.turnTimer.text = '';
      return;
    }
    ui.status.text = `Phòng ${room.id} · ${room.phase} · ${room.seats.length}/4`;
    renderSeats();
    renderLast();
    renderTurnTimer();
    syncTableFromRoom();
    updateActionButtons();
  }

  app.ticker.add(() => {
    if (state.room?.hand?.turnDeadline != null) renderTurnTimer();
  });

  ui.btnStart.on('pointertap', () => {
    if (!ui.btnStart._enabled) return;
    state.socket?.emit('room:start', {}, (res) => {
      if (res && !res.ok) showError(res.error);
    });
  });

  ui.btnLeave.on('pointertap', () => {
    state.socket?.emit('room:leave', {}, () => {
      resetPlaySurface({ keepRoom: false, statusText: 'Đã rời phòng' });
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
      requestHandSync();
    });
  });

  ui.btnPass.on('pointertap', () => {
    if (!ui.btnPass._enabled) return;
    state.socket?.emit('hand:pass', {}, (res) => {
      if (res && !res.ok) showError(res.error);
    });
  });

  let handSyncPending = false;

  async function applyPrivateHand(cards, { dealAnim = false } = {}) {
    const next = [...(cards || [])].map(Number).sort((a, b) => a - b);
    const same =
      next.length === state.hand.length && next.every((id, i) => id === state.hand[i]);
    state.hand = next;
    const keep = new Set(next);
    for (const id of [...state.selected]) {
      if (!keep.has(id)) state.selected.delete(id);
    }
    if (dealAnim) {
      clearTableCards();
      clearOpponentStacks();
      ui.status.text = 'Đã chia bài';
      await renderHand(true);
    } else if (!same || state.cardSprites.size !== next.length) {
      await renderHand(false);
    }
  }

  function requestHandSync() {
    if (!state.socket?.connected || handSyncPending || state.animating) return;
    const me = state.profile?.pccuid;
    const count = state.room?.hand?.cardCounts?.[me];
    if (count == null) return;
    if (count === state.hand.length) return;
    handSyncPending = true;
    state.socket.emit('hand:sync', {}, async (res) => {
      handSyncPending = false;
      if (res?.ok && Array.isArray(res.cards)) {
        await applyPrivateHand(res.cards, { dealAnim: false });
        render();
      }
    });
  }

  function connect() {
    if (state.socket?.connected && state.socket.auth?.token === state.token) {
      state.socket.emit('room:list');
      requestHandSync();
      return;
    }
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
        requestHandSync();
      } else if (state.room) {
        resetPlaySurface({ keepRoom: false, statusText: 'Chưa vào phòng. Chọn phòng trên portal.' });
      }
    });

    state.socket.on('room:state', (room) => {
      if (!state.profile) return;
      if (room.seats.some((s) => s.pccuid === state.profile.pccuid)) {
        state.room = room;
        if (!room.hand) {
          resetPlaySurface({
            keepRoom: true,
            statusText: `Phòng ${room.id} · ${room.phase} · ${room.seats.length}/4`,
          });
          return;
        }
        render();
        requestHandSync();
      } else if (state.room && state.room.id === room.id) {
        resetPlaySurface({ keepRoom: false, statusText: 'Chưa vào phòng. Chọn phòng trên portal.' });
      }
    });

    state.socket.on('hand:dealt', async ({ cards }) => {
      await applyPrivateHand(cards, { dealAnim: true });
      render();
    });

    state.socket.on('hand:update', async ({ cards }) => {
      await applyPrivateHand(cards, { dealAnim: false });
      render();
    });

    state.socket.on('hand:error', (err) => {
      showError(err);
      if (err?.code === 'CARDS_NOT_HELD') requestHandSync();
    });

    state.socket.on('hand:aborted', () => {
      resetPlaySurface({
        keepRoom: true,
        clearRoomHand: true,
        statusText: 'Ván hòa — không đủ người chơi',
      });
    });

    state.socket.on('hand:finished', (payload) => {
      const mine = payload.pointsDelta?.[state.profile?.pccuid];
      const statusText =
        'Ván xong. Điểm: ' +
        (mine >= 0 ? '+' : '') +
        (mine ?? 0) +
        ' · ' +
        (payload.finishOrder || []).join(' → ');
      resetPlaySurface({
        keepRoom: true,
        clearRoomHand: true,
        statusText,
      });
      if (mine != null && mine > 0) {
        Animations.celebrateWin(layers.ui, 960, 400);
      } else if (mine != null && mine < 0) {
        Animations.showBanner(layers.ui, 'Thua ván', 0xff4444);
      }
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
    if (state.destroyed) return;
    state.destroyed = true;
    setGameVisible(false);
    window.removeEventListener('resize', onWindowResize);
    window.removeEventListener('message', onParentMessage);
    document.removeEventListener('visibilitychange', onVisibilityChange);
    if (letterboxRaf) {
      cancelAnimationFrame(letterboxRaf);
      letterboxRaf = 0;
    }
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
      clearOpponentStacks();
    } catch (_) {
      /* ignore */
    }
    killSeatBlinks();
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
})();
