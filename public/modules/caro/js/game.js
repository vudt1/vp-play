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
    endBanner: '',
    sfxPlayedForResult: null,
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

  const sfx = Caro.createSfx(moduleRoot);

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

  function resultKey(finished) {
    if (!finished) return null;
    const w = finished.winnerId || finished.winnerPccuid || '';
    const r = finished.result || '';
    const move = finished.lastMove;
    const m = move ? `${move.row},${move.col}` : '';
    return `${r}:${w}:${m}`;
  }

  function finishedMessage(finished) {
    const me = state.profile?.pccuid;
    if (!finished) return 'Hòa';
    if (finished.result === 'win' || finished.winnerId) {
      const win = finished.winnerId === me;
      const delta = finished.pointsDelta?.[me];
      const pts =
        delta != null ? ` (${delta >= 0 ? '+' : ''}${delta})` : win ? ' (+1)' : ' (−1)';
      return win ? `Bạn thắng!${pts}` : `Bạn thua${pts}`;
    }
    if (finished.result === 'draw') return 'Hòa — bàn đầy';
    return 'Hòa';
  }

  function applyFinishedVisual(finished, { playSfx = true } = {}) {
    if (!finished) return;
    if (finished.board) {
      boardView.syncFromBoard(finished.board, { animateNew: false });
    }
    if (finished.winLine?.length) {
      boardView.showWinLine(finished.winLine);
    } else {
      boardView.clearWinLine();
    }

    const key = resultKey(finished);
    const text = finishedMessage(finished);
    state.endBanner = text;
    hud.showResult(text);

    if (playSfx && key && state.sfxPlayedForResult !== key) {
      state.sfxPlayedForResult = key;
      const me = state.profile?.pccuid;
      if (finished.result === 'win' || finished.winnerId) {
        if (finished.winnerId === me) sfx.playWin();
        else sfx.playLose();
      }
    }
  }

  function clearEndState() {
    state.endBanner = '';
    state.sfxPlayedForResult = null;
    hud.hideResult();
    boardView.clearWinLine();
  }

  function applyRoom(room) {
    if (!state.profile) return;
    if (!room) {
      state.room = null;
      boardView.clearMarks();
      clearEndState();
      render();
      return;
    }
    const me = state.profile.pccuid;
    const seated = (room.seats || []).some((s) => s.pccuid === me);
    if (seated) {
      const prevPhase = state.room?.phase;
      state.room = room;

      if (room.phase === 'playing' && room.match) {
        if (prevPhase !== 'playing') {
          clearEndState();
          boardView.clearMarks();
        }
        boardView.syncFromMatch(room.match, { animateNew: false });
        hud.hideResult();
        state.endBanner = '';
      } else if (room.lastResult?.board) {
        applyFinishedVisual(room.lastResult, { playSfx: false });
      } else if (!room.match && !room.lastResult) {
        if (prevPhase === 'playing') {
          /* keep board if mid-transition */
        } else if (!state.endBanner) {
          boardView.clearMarks();
        }
      }
      render();
      return;
    }
    if (state.room && state.room.id === room.id) {
      state.room = null;
      boardView.clearMarks();
      clearEndState();
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

    const canStart = !!meta.canStart;
    hud.setStartVisible(canStart, canStart);

    if (room.phase === 'playing' && room.match) {
      hud.hideResult();
      boardView.syncFromMatch(room.match, { animateNew: false });
      return;
    }

    if (room.lastResult?.board) {
      boardView.syncFromBoard(room.lastResult.board, { animateNew: false });
      if (room.lastResult.winLine?.length) {
        boardView.showWinLine(room.lastResult.winLine);
      }
      if (!state.endBanner) {
        state.endBanner = finishedMessage(room.lastResult);
      }
      hud.showResult(state.endBanner);
    } else if (state.endBanner && (room.phase === 'waiting' || room.phase === 'idle')) {
      hud.showResult(state.endBanner);
    }

    if (meta.seatsN < 2 && state.endBanner) {
      /* host left after match — stay usable, still show result briefly */
      if (meta.isHost) {
        header.turn.text = 'Bạn là Host — chờ người chơi khác';
      }
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
        sfx.playPlace();
      }
      if (state.room?.match) {
        boardView.syncFromMatch(state.room.match, { animateNew: false });
      }
      render();
    },
    onFinished: (payload) => {
      const finished = payload?.finished || payload;
      if (payload?.room) {
        state.room = payload.room;
        if (!state.room.lastResult && finished) {
          state.room.lastResult = finished;
        }
      } else if (state.room) {
        state.room.phase = 'waiting';
        state.room.match = null;
        state.room.lastResult = finished || state.room.lastResult;
      }
      applyFinishedVisual(finished || state.room?.lastResult, { playSfx: true });
      render();
    },
    onAborted: (payload) => {
      if (payload?.room) state.room = payload.room;
      else if (state.room) {
        state.room.phase = state.room.seats?.length ? 'waiting' : 'idle';
        state.room.match = null;
        state.room.lastResult = null;
      }
      boardView.clearMarks();
      clearEndState();
      state.endBanner = 'Hòa — đối thủ rời phòng';
      hud.showResult(state.endBanner);
      render();
    },
    onError: showError,
  });

  hud.btnStart.on('pointertap', () => {
    if (!hud.btnStart.isEnabled() || !net.socket) return;
    clearEndState();
    boardView.clearMarks();
    net.emitStart((res) => {
      if (res && res.ok === false) showError(res.error);
      if (res?.ok && res.room) {
        state.room = res.room;
        boardView.clearMarks();
        clearEndState();
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