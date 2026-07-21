(async function () {
  const C = Loto.CONST;
  const base = window.VP_BASE || '';
  const moduleRoot = `${base}/modules/loto`;

  function socketPath() {
    return base ? `${base}/socket.io` : '/socket.io';
  }

  const state = {
    token: null,
    profile: null,
    room: null,
    destroyed: false,
    poolIndex: 0,
    lastDrawn: null,
    sfxOverKey: null,
    renderedTicketId: null,
    /** Client-held Kinh flash so hands icon is visible despite sync server settle. */
    checkingFlash: null,
    checkingFlashTimer: null,
  };

  const CHECKING_FLASH_MS = 1800;

  function clearCheckingFlash() {
    if (state.checkingFlashTimer) {
      clearTimeout(state.checkingFlashTimer);
      state.checkingFlashTimer = null;
    }
    state.checkingFlash = null;
  }

  function startCheckingFlash(pccuid) {
    if (!pccuid) return;
    if (state.checkingFlashTimer) clearTimeout(state.checkingFlashTimer);
    state.checkingFlash = { pccuid, until: Date.now() + CHECKING_FLASH_MS };
    state.checkingFlashTimer = setTimeout(() => {
      state.checkingFlash = null;
      state.checkingFlashTimer = null;
      renderHud();
    }, CHECKING_FLASH_MS);
  }

  function activeCheckingPccuid(room) {
    const now = Date.now();
    if (state.checkingFlash && state.checkingFlash.until > now) {
      return state.checkingFlash.pccuid;
    }
    return room?.checkingPccuid || null;
  }

  const app = new PIXI.Application();
  await app.init({
    width: window.innerWidth || C.BASE_W,
    height: window.innerHeight || C.BASE_H,
    backgroundColor: 0x000000,
    antialias: true,
    resolution: Math.min(window.devicePixelRatio || 1, 2),
    autoDensity: true,
  });

  const rootEl = document.getElementById('game-root');
  rootEl.appendChild(app.canvas);

  const stageRoot = new PIXI.Container();
  app.stage.addChild(stageRoot);
  const world = new PIXI.Container();
  stageRoot.addChild(world);
  Loto.createLetterbox(app, stageRoot, C.BASE_W, C.BASE_H);

  let frameTex;
  let checkTex;
  let handsTex;
  try {
    const textures = await PIXI.Assets.load([
      { alias: 'loto-frame', src: `${moduleRoot}/assets/images/frames.svg` },
      { alias: 'loto-check', src: `${moduleRoot}/assets/images/check.svg` },
      { alias: 'loto-hands', src: `${moduleRoot}/assets/images/hands.svg` },
    ]);
    frameTex = textures['loto-frame'] || textures.frame;
    checkTex = textures['loto-check'] || textures.check;
    handsTex = textures['loto-hands'] || textures.hands;
  } catch (_) {
    frameTex = null;
    checkTex = null;
    handsTex = null;
  }

  const sfx = Loto.createSfx(moduleRoot);

  const bg = new PIXI.Graphics();
  bg.rect(0, 0, C.BASE_W, C.BASE_H);
  bg.fill({ color: C.COLOR.bg });
  world.addChild(bg);

  const layers = {
    board: new PIXI.Container(),
    ui: new PIXI.Container(),
    overlay: new PIXI.Container(),
  };
  world.addChild(layers.board, layers.ui, layers.overlay);

  const board = Loto.createBoardView({
    layer: layers.board,
    onCellTap(num) {
      if (state.destroyed || !state.room) return;
      if (state.room.phase !== 'playing') return;
      const me = mySeat();
      if (!me?.ticketId) return;
      board.toggleMark(num);
      sfx.playClick();
    },
  });
  board.setAssets(frameTex, checkTex);
  board.root.x = 40;
  board.root.y = 90;

  const hud = Loto.createHudView(layers.ui, layers.overlay);
  if (handsTex) hud.setHandsTexture(handsTex);

  function mySeat() {
    const me = state.profile?.pccuid;
    if (!me || !state.room) return null;
    return (state.room.seats || []).find((s) => s.pccuid === me) || null;
  }

  function isHost() {
    return state.profile && state.room && state.room.hostPccuid === state.profile.pccuid;
  }

  function showError(err) {
    const msg = err?.message || err?.code || String(err || 'Lỗi');
    hud.setStatus(msg);
  }

  function fireworks() {
    if (typeof gsap === 'undefined') return;
    for (let i = 0; i < 18; i += 1) {
      const dot = new PIXI.Graphics();
      const color = i % 2 ? C.COLOR.gold : C.COLOR.accent;
      dot.circle(0, 0, 6 + (i % 4));
      dot.fill({ color });
      dot.x = C.BASE_W / 2;
      dot.y = C.BASE_H / 2;
      layers.overlay.addChild(dot);
      const ang = (Math.PI * 2 * i) / 18;
      const dist = 180 + (i % 5) * 40;
      gsap.to(dot, {
        x: C.BASE_W / 2 + Math.cos(ang) * dist,
        y: C.BASE_H / 2 + Math.sin(ang) * dist,
        alpha: 0,
        duration: 0.9 + (i % 3) * 0.15,
        ease: 'power2.out',
        onComplete: () => {
          layers.overlay.removeChild(dot);
          dot.destroy();
        },
      });
    }
  }

  function currentPoolTicket() {
    const pool = state.room?.ticketPool || [];
    if (!pool.length) return null;
    const idx = ((state.poolIndex % pool.length) + pool.length) % pool.length;
    return pool[idx];
  }

  function renderBoard() {
    const room = state.room;
    if (!room) {
      state.renderedTicketId = null;
      board.clear();
      return;
    }
    const me = mySeat();
    if (room.phase === 'playing' || room.phase === 'settling') {
      const ticket = room.myTicket || null;
      const tid = ticket?.ticketId || null;
      if (tid && tid === state.renderedTicketId) return;
      state.renderedTicketId = tid;
      if (ticket) board.renderTicket(ticket);
      else board.clear();
      return;
    }
    state.renderedTicketId = null;
    if ((room.ticketPool || []).length) {
      const t = currentPoolTicket();
      if (t) {
        const taken = (room.seats || []).find((s) => s.ticketId === t.ticketId);
        const label = `${t.ticketId}${taken ? ` · ${taken.displayName}` : ''}${
          me?.ticketId === t.ticketId ? ' · (của bạn)' : ''
        }`;
        board.renderPoolSlide(t, label);
      }
    } else {
      board.clear();
    }
  }

  function renderHud() {
    const room = state.room;
    if (!room) {
      hud.setStatus('Chưa vào phòng — vào phòng từ portal');
      hud.btnPrepare.visible = false;
      hud.btnStart.visible = false;
      hud.btnKinh.visible = false;
      hud.btnPrev.visible = false;
      hud.btnNext.visible = false;
      hud.btnPick.visible = false;
      hud.btnClear.visible = false;
      hud.paintList([], null, null);
      return;
    }

    const me = mySeat();
    const waiting = room.phase === 'waiting' || room.phase === 'idle';
    const playing = room.phase === 'playing';
    const settling = room.phase === 'settling';
    const hasPool = (room.ticketPool || []).length > 0;
    const allPicked =
      (room.seats || []).length >= 2 && (room.seats || []).every((s) => s.ticketId);

    const checkingUid = activeCheckingPccuid(room);
    hud.paintList(room.seats, room.hostPccuid, checkingUid);

    hud.btnPrepare.visible = waiting && isHost();
    hud.btnPrepare.setEnabled(waiting && isHost() && (room.seats || []).length >= 2);
    hud.btnStart.visible = waiting && isHost();
    hud.btnStart.setEnabled(waiting && isHost() && hasPool && allPicked);

    hud.btnPrev.visible = waiting && hasPool;
    hud.btnNext.visible = waiting && hasPool;
    hud.btnPick.visible = waiting && hasPool;
    hud.btnClear.visible = waiting && hasPool && !!me?.ticketId;

    const now = Date.now();
    const cd = me?.cooldownUntil && me.cooldownUntil > now;
    hud.btnKinh.visible = playing || settling || !!checkingUid;
    hud.btnKinh.setEnabled(playing && !cd && !!me?.ticketId && !checkingUid);
    if (cd) {
      const left = Math.ceil((me.cooldownUntil - now) / 1000);
      hud.btnKinh.setLabel(`Kinh (${left}s)`);
    } else {
      hud.btnKinh.setLabel('Kinh');
    }

    let status = `Phòng ${room.id} · ${room.phase}`;
    if (playing || settling) {
      status += ` · đã rao ${room.drawnNumbers?.length || 0}/90`;
      if (state.lastDrawn != null) status += ` · vừa: ${state.lastDrawn}`;
    } else if (hasPool) {
      status += ` · vé ${(state.poolIndex % room.ticketPool.length) + 1}/${room.ticketPool.length}`;
    }
    if (checkingUid) {
      const who = (room.seats || []).find((s) => s.pccuid === checkingUid);
      hud.showChecking(who?.displayName || 'Player');
    } else {
      hud.hideChecking();
    }
    hud.setStatus(status);
  }

  function render() {
    renderBoard();
    renderHud();
  }

  function applyRoom(room, meta) {
    if (!state.profile) return;
    if (!room) {
      state.room = null;
      state.renderedTicketId = null;
      board.clear();
      hud.hideResult();
      render();
      return;
    }
    const me = state.profile.pccuid;
    const seated = (room.seats || []).some((s) => s.pccuid === me);
    if (!seated) {
      state.room = null;
      state.renderedTicketId = null;
      board.clear();
      render();
      return;
    }
    // Lobby list is redacted (empty ticketPool/drawnNumbers); keep full room:state when already seated.
    // Do not trust list checkingPccuid over a local Kinh flash (server settles sync).
    if (meta?.fromList && state.room && state.room.id === room.id) {
      state.room.seats = room.seats;
      state.room.phase = room.phase;
      state.room.hostPccuid = room.hostPccuid;
      if (room.checkingPccuid) state.room.checkingPccuid = room.checkingPccuid;
      state.room.lastResult = room.lastResult;
      if (room.poolSize != null) state.room.poolSize = room.poolSize;
      renderHud();
      return;
    }
    state.room = room;
    if (room.lastResult?.result === 'win') {
      const key = `${room.lastResult.winnerId}:${room.lastResult.reason}`;
      if (state.sfxOverKey !== key) {
        state.sfxOverKey = key;
        const win = room.lastResult.winnerId === me;
        const winnerName =
          (room.seats || []).find((s) => s.pccuid === room.lastResult.winnerId)?.displayName ||
          room.lastResult.winnerDisplayName ||
          'Người chơi';
        hud.showResult(win ? 'Bạn Kinh! +10' : `${winnerName} thắng (+10)`);
        if (win) {
          sfx.playVictory();
          fireworks();
        }
      }
    }
    render();
  }

  const net = Loto.createSocketClient({
    socketPath,
    getToken: () => state.token,
    getProfile: () => state.profile,
    onStatus: (t) => hud.setStatus(t),
    onRoom: (room, meta) => applyRoom(room, meta),
    onNumberDrawn: (payload) => {
      if (payload?.number != null) {
        state.lastDrawn = payload.number;
        sfx.playNumber(payload.number);
      }
      if (payload?.drawnNumbers && state.room) {
        state.room.drawnNumbers = payload.drawnNumbers;
      }
      if (payload?.nextDrawAt != null && state.room) {
        state.room.nextDrawAt = payload.nextDrawAt;
      }
      renderHud();
    },
    onChecking: (payload) => {
      if (payload?.pccuid) startCheckingFlash(payload.pccuid);
      if (state.room) state.room.checkingPccuid = payload?.pccuid || null;
      renderHud();
    },
    onOver: (payload) => {
      if (payload?.winnerId) startCheckingFlash(payload.winnerId);
      if (payload?.room) applyRoom(payload.room);
      else if (payload) {
        const me = state.profile?.pccuid;
        const win = payload.winnerId === me;
        hud.showResult(win ? 'Bạn Kinh! +10' : 'Có người Kinh thắng');
        if (win) {
          sfx.playVictory();
          fireworks();
        }
      }
    },
    onAborted: (payload) => {
      clearCheckingFlash();
      hud.showResult(`Ván hủy: ${payload?.reason || 'abort'}`);
      hud.hideChecking();
      net.requestList();
    },
    onError: (err) => showError(err),
  });

  hud.btnPrepare.on('pointertap', () => {
    net.emitPrepare((res) => {
      if (res && res.ok === false) showError(res.error);
      else if (res?.room) applyRoom(res.room);
    });
  });
  hud.btnStart.on('pointertap', () => {
    net.emitStart((res) => {
      if (res && res.ok === false) showError(res.error);
      else if (res?.room) {
        board.setMarked([]);
        state.lastDrawn = null;
        state.sfxOverKey = null;
        state.renderedTicketId = null;
        hud.hideResult();
        applyRoom(res.room);
      }
    });
  });
  hud.btnPrev.on('pointertap', () => {
    state.poolIndex -= 1;
    render();
  });
  hud.btnNext.on('pointertap', () => {
    state.poolIndex += 1;
    render();
  });
  hud.btnPick.on('pointertap', () => {
    const t = currentPoolTicket();
    if (!t) return;
    net.emitSelectTicket(t.ticketId, (res) => {
      if (res && res.ok === false) showError(res.error);
      else if (res?.room) applyRoom(res.room);
    });
  });
  hud.btnClear.on('pointertap', () => {
    net.emitSelectTicket(null, (res) => {
      if (res && res.ok === false) showError(res.error);
      else if (res?.room) applyRoom(res.room);
    });
  });
  hud.btnKinh.on('pointertap', () => {
    const me = state.profile?.pccuid;
    if (me) startCheckingFlash(me);
    renderHud();
    net.emitKinh((res) => {
      if (res && res.ok === false) {
        showError(res.error);
        if (res.room) applyRoom(res.room);
      } else if (res?.finished || res?.room) {
        applyRoom(res.room || res.finished?.room);
      }
    });
  });

  function onAuthMessage(ev) {
    const data = ev?.data;
    if (!data || data.type !== 'vp-auth') return;
    if (data.token) state.token = data.token;
    if (data.profile) state.profile = data.profile;
    if (state.token) net.connect();
    if (state.profile) net.requestList();
    render();
  }
  window.addEventListener('message', onAuthMessage);

  try {
    if (window.parent && window.parent !== window) {
      window.parent.postMessage({ type: 'vp-game-ready' }, '*');
    }
  } catch (_) {
    /* ignore */
  }

  const cached = localStorage.getItem('vp_access_token');
  if (cached) {
    state.token = cached;
    net.connect();
  }

  setInterval(() => {
    if (state.room?.phase === 'playing') renderHud();
  }, 500);

  render();
})();
