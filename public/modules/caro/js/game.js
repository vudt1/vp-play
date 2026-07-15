(async function () {
  const C = Caro.CONST;
  const base = window.VP_BASE || '';
  const moduleRoot = `${base}/modules/caro`;

  function socketPath() {
    return base ? `${base}/socket.io` : '/socket.io';
  }

  const state = {
    token: null,
    profile: null,
    room: null,
    destroyed: false,
    lastError: '',
  };

  const app = new PIXI.Application();
  await app.init({
    width: window.innerWidth || C.BASE_W,
    height: window.innerHeight || C.BASE_H,
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

  const letterbox = Caro.createLetterbox(app, stageRoot, C.BASE_W, C.BASE_H);

  await PIXI.Assets.load([
    { alias: 'mark-x', src: `${moduleRoot}/assets/images/x.svg` },
    { alias: 'mark-o', src: `${moduleRoot}/assets/images/o.svg` },
  ]);

  const sfx = Caro.createPlaceSound(moduleRoot);

  const bg = new PIXI.Graphics();
  bg.rect(0, 0, C.BASE_W, C.BASE_H);
  bg.fill({ color: C.COLOR.panel });
  world.addChild(bg);

  const layers = {
    board: new PIXI.Container(),
    marks: new PIXI.Container(),
    ui: new PIXI.Container(),
    overlay: new PIXI.Container(),
  };
  world.addChild(layers.board, layers.marks, layers.ui, layers.overlay);

  const boardView = Caro.createBoardView({
    layers,
    onCellTap(row, col) {
      if (state.destroyed || !net.socket || !state.room?.match) return;
      const me = state.profile?.pccuid;
      if (!me || state.room.match.currentTurn !== me) return;
      if (state.room.phase !== 'playing') return;
      if (state.room.match.board?.[row]?.[col]) return;
      net.emitMove(row, col, (res) => {
        if (res && res.ok === false) showError(res.error);
      });
    },
  });

  const header = Caro.createHeaderView(layers.ui);
  const hud = Caro.createHudView(layers.ui, layers.overlay);

  function showError(err) {
    const msg = err?.message || err?.code || String(err || 'Lỗi');
    state.lastError = msg;
    header.setStatus(msg);
  }

  function applyRoom(room) {
    if (!state.profile) return;
    if (!room) {
      state.room = null;
      boardView.clearMarks();
      hud.hideOverlay();
      render();
      return;
    }
    const me = state.profile.pccuid;
    const seated = (room.seats || []).some((s) => s.pccuid === me);
    if (seated) {
      const prevPhase = state.room?.phase;
      const prevMatch = !!state.room?.match;
      state.room = room;
      if (room.phase === 'playing' && room.match) {
        if (!prevMatch || prevPhase !== 'playing') {
          boardView.clearMarks();
          boardView.syncFromMatch(room.match, { animateNew: false });
        } else {
          boardView.syncFromMatch(room.match, { animateNew: false });
        }
      } else if (!room.match) {
        boardView.clearMarks();
      }
      render();
      return;
    }
    if (state.room && state.room.id === room.id) {
      state.room = null;
      boardView.clearMarks();
      hud.hideOverlay();
      render();
    }
  }

  function render() {
    const room = state.room;
    const me = state.profile?.pccuid;
    const meta = header.render(room, me);
    if (!room) {
      hud.setStartVisible(false, false);
      return;
    }
    hud.setStartVisible(!!meta.canStart, !!meta.canStart);
    if (room.phase === 'playing' && room.match) {
      hud.hideOverlay();
      boardView.syncFromMatch(room.match, { animateNew: false });
    }
  }

  function resolveMarkVal(payload) {
    let markVal = payload?.mark ?? payload?.value ?? payload?.playerVal;
    if (markVal === 'X') markVal = 1;
    if (markVal === 'O') markVal = 2;
    if (!markVal && state.room?.match?.marks) {
      const byTurn = payload?.pccuid || payload?.by;
      const letter = byTurn ? state.room.match.marks[byTurn] : null;
      markVal = letter === 'O' ? 2 : 1;
    }
    return markVal || 1;
  }

  const net = Caro.createSocketClient({
    socketPath,
    getToken: () => state.token,
    getProfile: () => state.profile,
    onStatus: (t) => header.setStatus(t),
    onRoom: (room) => applyRoom(room),
    onMoved: (payload) => {
      const row = payload?.row;
      const col = payload?.col;
      const markVal = resolveMarkVal(payload);
      if (payload?.room) {
        state.room = payload.room;
      } else if (state.room?.match && Number.isInteger(row) && Number.isInteger(col)) {
        if (state.room.match.board) {
          state.room.match.board[row][col] = markVal;
        }
        if (payload?.currentTurn != null) {
          state.room.match.currentTurn = payload.currentTurn;
        }
      }
      if (Number.isInteger(row) && Number.isInteger(col)) {
        boardView.placeMark(row, col, markVal, { animate: true });
        sfx.play();
      }
      if (state.room?.match) {
        boardView.syncFromMatch(state.room.match, { animateNew: false });
      }
      render();
    },
    onFinished: (payload) => {
      if (payload?.room) state.room = payload.room;
      else if (state.room) {
        state.room.phase = 'waiting';
        state.room.match = null;
      }
      boardView.clearMarks();

      const me = state.profile?.pccuid;
      const finished = payload?.finished || payload;
      let text = 'Hòa';
      if (finished?.result === 'win' || finished?.winnerId) {
        const win = finished.winnerId === me;
        const delta = finished.pointsDelta?.[me];
        const pts =
          delta != null ? ` (${delta >= 0 ? '+' : ''}${delta})` : win ? ' (+1)' : ' (−1)';
        text = win ? `Bạn thắng!${pts}` : `Bạn thua${pts}`;
      } else if (finished?.result === 'draw') {
        text = 'Hòa — bàn đầy';
      }
      hud.showOverlay(text);
      render();
    },
    onAborted: (payload) => {
      if (payload?.room) state.room = payload.room;
      else if (state.room) {
        state.room.phase = state.room.seats?.length ? 'waiting' : 'idle';
        state.room.match = null;
      }
      boardView.clearMarks();
      hud.showOverlay('Hòa — đối thủ rời phòng');
      render();
    },
    onError: showError,
  });

  hud.btnStart.on('pointertap', () => {
    if (!hud.btnStart.isEnabled() || !net.socket) return;
    hud.hideOverlay();
    net.emitStart((res) => {
      if (res && res.ok === false) showError(res.error);
      if (res?.ok && res.room) {
        state.room = res.room;
        boardView.clearMarks();
        hud.hideOverlay();
        render();
      }
    });
  });

  app.ticker.add((ticker) => {
    if (state.destroyed) return;
    const dt = (ticker.deltaMS || 16.6) / 1000;
    header.tick(dt);
  });

  function setGameVisible(visible) {
    sfx.mute(!visible);
    if (app?.ticker) {
      if (visible) app.ticker.start();
      else app.ticker.stop();
    }
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
      net.connect();
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

  function teardown() {
    if (state.destroyed) return;
    state.destroyed = true;
    setGameVisible(false);
    window.removeEventListener('message', onParentMessage);
    document.removeEventListener('visibilitychange', onVisibilityChange);
    letterbox.destroy();
    net.disconnect();
    state.room = null;
    try {
      boardView.clearMarks();
    } catch (_) {
      /* ignore */
    }
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

  window.addEventListener('message', onParentMessage);
  document.addEventListener('visibilitychange', onVisibilityChange);

  render();
  window.parent.postMessage({ type: 'vp-game-ready' }, window.location.origin);
})();
