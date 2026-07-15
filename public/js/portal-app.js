function portalApp() {
  const base = window.VP_BASE || '';
  const root = document.querySelector('.app-page');
  const moduleKind = root?.dataset?.moduleKind || 'multiplayer';
  const maxSeats = Number(root?.dataset?.maxSeats) || 4;
  const socketNamespace = (root?.dataset?.socketNamespace || '').trim();
  const BUSY_PHASES = new Set(['playing', 'settling']);

  function apiUrl(p) {
    return (window.vpAuth?.apiUrl || ((x) => base + x))(p);
  }

  function socketPath() {
    if (window.vpAuth?.socketPath) return window.vpAuth.socketPath();
    return base ? base + '/socket.io' : '/socket.io';
  }

  const PHASE_VI = {
    idle: 'Trống',
    waiting: 'Chờ',
    playing: 'Đang chơi',
    settling: 'Kết thúc',
  };

  return {
    profile: null,
    token: null,
    rooms: [
      { id: 1, phase: 'idle', seats: [], hostPccuid: null },
      { id: 2, phase: 'idle', seats: [], hostPccuid: null },
      { id: 3, phase: 'idle', seats: [], hostPccuid: null },
    ],
    showGame: false,
    socket: null,
    devMode: false,
    devId: 'player1',
    authError: null,
    authReady: false,
    seatedRoomId: null,
    joinError: null,
    maxSeats,
    _leaveBound: null,
    _navBound: null,
    _leaving: false,

    async init() {
      await (window.vpAuth?.ready || Promise.resolve());
      this.authReady = true;
      this.devMode = !!window.vpAuth?.devMode || !!window.VP_KEYCLOAK?.authDevBypass;
      this.applyAuthState();
      window.vpAuth?.renderAuthSlot?.();
      window.addEventListener('vp-auth-changed', () => this.applyAuthState());
      window.addEventListener('message', (ev) => {
        if (ev.origin !== window.location.origin) return;
        if (ev.data?.type === 'vp-game-ready') this.postAuthToGame();
      });
      this._leaveBound = () => {
        this.leaveIfSeated({ wait: false });
      };
      window.addEventListener('pagehide', this._leaveBound);
      window.addEventListener('beforeunload', this._leaveBound);
      this._navBound = (ev) => this.onDocumentClick(ev);
      document.addEventListener('click', this._navBound, true);
      if (window.vpAuth) {
        window.vpAuth.beforeLogout = () => this.leaveIfSeated({ wait: true });
      }
      if (moduleKind !== 'multiplayer') {
        this.showGame = true;
      }
    },

    phaseLabel(phase) {
      return PHASE_VI[phase] || phase || '—';
    },

    applyAuthState() {
      this.authError = window.vpAuth?.error || null;
      if (window.vpAuth?.profile && window.vpAuth?.token) {
        const prev = this.token;
        this.profile = window.vpAuth.profile;
        this.token = window.vpAuth.token;
        if (moduleKind === 'multiplayer' && (!this.socket || prev !== this.token)) {
          this.connectSocket();
        }
      } else {
        if (this.socket && this.seatedRoomId) {
          this.leaveIfSeated({ wait: false });
        }
        this.profile = null;
        this.token = null;
        this.seatedRoomId = null;
        if (this.socket) {
          this.socket.disconnect();
          this.socket = null;
        }
      }
    },

    async retryAuth() {
      this.authError = null;
      await window.vpAuth?.retrySync?.();
      this.applyAuthState();
    },

    async devLogin() {
      const id = (this.devId || 'player1').trim();
      if (!id) {
        this.authError = 'pccuid bắt buộc';
        return;
      }
      this.authError = null;
      let res;
      try {
        res = await fetch(apiUrl('/api/auth/sync'), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${id}`,
          },
          body: JSON.stringify({ displayName: id }),
        });
      } catch (_) {
        this.authError = 'Không đồng bộ được tài khoản';
        this.profile = null;
        this.token = null;
        return;
      }
      if (!res.ok) {
        let message = 'Đồng bộ tài khoản thất bại';
        try {
          const body = await res.json();
          if (body?.message) message = body.message;
        } catch (_) {
          /* ignore */
        }
        this.authError = message;
        this.profile = null;
        this.token = null;
        if (window.vpAuth) {
          window.vpAuth.token = null;
          window.vpAuth.profile = null;
          window.vpAuth.error = message;
          window.vpAuth.renderAuthSlot?.();
          window.dispatchEvent(new CustomEvent('vp-auth-changed'));
        }
        return;
      }
      let data = {};
      try {
        data = await res.json();
      } catch (_) {
        /* ignore */
      }
      this.token = id;
      this.profile = {
        pccuid: data.pccuid || id,
        displayName: data.displayName || id,
      };
      if (window.vpAuth) {
        window.vpAuth.token = id;
        window.vpAuth.profile = this.profile;
        window.vpAuth.error = null;
        window.vpAuth.renderAuthSlot?.();
        window.dispatchEvent(new CustomEvent('vp-auth-changed'));
      }
      if (moduleKind === 'multiplayer') this.connectSocket();
    },

    connectSocket() {
      if (this.socket) this.socket.disconnect();
      const opts = { path: socketPath(), auth: { token: this.token } };
      this.socket = socketNamespace
        ? io(socketNamespace, opts)
        : io(opts);
      this.socket.on('connect', () => {
        this.socket.emit('room:list');
      });
      this.socket.on('room:list', (list) => {
        if (Array.isArray(list)) {
          this.rooms = list;
          this.syncSeated();
        }
      });
      this.socket.on('room:state', (room) => {
        const i = this.rooms.findIndex((r) => r.id === room.id);
        if (i >= 0) this.rooms[i] = room;
        else if (room?.id != null) this.rooms.push(room);
        this.syncSeated();
      });
      const refreshList = () => {
        this.socket?.emit('room:list');
      };
      this.socket.on('hand:finished', refreshList);
      this.socket.on('hand:aborted', refreshList);
      this.socket.on('match:finished', refreshList);
      this.socket.on('match:aborted', refreshList);
      if (this.socket.connected) this.socket.emit('room:list');
    },

    mergeRoom(room) {
      if (!room || room.id == null) return;
      const i = this.rooms.findIndex((r) => r.id === room.id);
      if (i >= 0) this.rooms[i] = room;
      else this.rooms.push(room);
    },

    syncSeated() {
      const uid = this.profile?.pccuid;
      if (!uid) {
        this.seatedRoomId = null;
        return;
      }
      const room = this.rooms.find((r) => r.seats.some((s) => s.pccuid === uid));
      this.seatedRoomId = room ? room.id : null;
      if (!this.seatedRoomId && this.showGame && moduleKind === 'multiplayer') {
        this.setGameVisible(false);
        this.showGame = false;
        this.syncCinemaClass();
      }
    },

    inRoom(roomId) {
      return this.rooms.some(
        (r) => r.id === roomId && r.seats.some((s) => s.pccuid === this.profile?.pccuid)
      );
    },

    canJoin(room) {
      if (!room || !this.profile) return false;
      if (this.inRoom(room.id)) return false;
      if (this.seatedRoomId != null) return false;
      if (BUSY_PHASES.has(room.phase)) return false;
      if (room.seats.length >= this.maxSeats) return false;
      return true;
    },

    joinRoom(roomId) {
      if (!this.socket) return;
      this.joinError = null;
      this.socket.emit('room:join', { roomId }, (ack) => {
        if (ack && ack.ok === false) {
          this.joinError = ack.error?.message || 'Không vào được phòng';
          return;
        }
        if (ack?.room) this.mergeRoom(ack.room);
        this.seatedRoomId = roomId;
        this.syncSeated();
        if (this.seatedRoomId == null) this.seatedRoomId = roomId;
        this.openGame();
      });
    },

    leaveRoom() {
      this.setGameVisible(false);
      this.leaveIfSeated({ wait: false });
      this.showGame = false;
      this.syncCinemaClass();
      this.joinError = null;
    },

    leaveIfSeated(opts = {}) {
      const wait = opts.wait !== false;
      if (!this.socket || !this.seatedRoomId || this._leaving) {
        this.showGame = false;
        this.syncCinemaClass();
        return wait ? Promise.resolve() : undefined;
      }
      this._leaving = true;
      const roomId = this.seatedRoomId;
      this.seatedRoomId = null;
      this.setGameVisible(false);
      this.showGame = false;
      this.syncCinemaClass();

      const finish = () => {
        this._leaving = false;
      };

      if (!wait) {
        try {
          this.socket.emit('room:leave');
        } catch (_) {
          /* ignore */
        }
        finish();
        return undefined;
      }

      return new Promise((resolve) => {
        let done = false;
        const complete = () => {
          if (done) return;
          done = true;
          finish();
          resolve();
        };
        const t = setTimeout(complete, 800);
        try {
          this.socket.emit('room:leave', {}, () => {
            clearTimeout(t);
            complete();
          });
        } catch (_) {
          clearTimeout(t);
          complete();
        }
        void roomId;
      });
    },

    async leaveSurface(ev) {
      this.notifyGameTeardown();
      this.setGameVisible(false);
      this.showGame = false;
      this.syncCinemaClass();
      if (ev) {
        ev.preventDefault();
        const href = ev.currentTarget?.getAttribute?.('href');
        await this.leaveIfSeated({ wait: true });
        if (href) window.location.href = href;
        return;
      }
      await this.leaveIfSeated({ wait: true });
    },

    onDocumentClick(ev) {
      if (moduleKind !== 'multiplayer' || !this.seatedRoomId) return;
      const a = ev.target?.closest?.('a[href]');
      if (!a || a.hasAttribute('download') || a.target === '_blank') return;
      if (a.classList.contains('back-link')) return;
      const href = a.getAttribute('href');
      if (!href || href.startsWith('#') || href.startsWith('javascript:')) return;
      let url;
      try {
        url = new URL(href, window.location.href);
      } catch (_) {
        return;
      }
      if (url.origin !== window.location.origin) return;
      if (url.pathname === window.location.pathname && url.search === window.location.search) {
        return;
      }
      ev.preventDefault();
      ev.stopPropagation();
      this.notifyGameTeardown();
      this.leaveIfSeated({ wait: true }).then(() => {
        window.location.href = url.href;
      });
    },

    syncCinemaClass() {
      document.body.classList.toggle('cinema-active', !!this.showGame);
    },

    postToGame(payload) {
      const frame = document.getElementById('module-frame');
      if (!frame?.contentWindow) return;
      try {
        frame.contentWindow.postMessage(payload, window.location.origin);
      } catch (_) {
        /* ignore */
      }
    },

    setGameVisible(visible) {
      this.postToGame({ type: 'vp-game-visibility', visible: !!visible });
    },

    notifyGameTeardown() {
      this.postToGame({ type: 'vp-game-teardown' });
    },

    openGame() {
      if (moduleKind === 'multiplayer' && !this.seatedRoomId) return;
      this.showGame = true;
      this.syncCinemaClass();
      this.$nextTick?.(() => {
        this.postAuthToGame();
        this.setGameVisible(true);
      });
      setTimeout(() => {
        this.postAuthToGame();
        this.setGameVisible(true);
      }, 300);
    },

    closeGame() {
      this.setGameVisible(false);
      this.showGame = false;
      this.syncCinemaClass();
    },

    postAuthToGame() {
      const frame = document.getElementById('module-frame');
      if (!frame?.contentWindow || !this.token || !this.profile) return;
      const profile = {
        pccuid: this.profile.pccuid,
        displayName: this.profile.displayName,
      };
      frame.contentWindow.postMessage(
        {
          type: 'vp-auth',
          token: String(this.token),
          profile,
        },
        window.location.origin
      );
    },
  };
}
