function portalApp() {
  const base = window.VP_BASE || '';

  function apiUrl(p) {
    return (window.vpAuth?.apiUrl || ((x) => base + x))(p);
  }

  function socketPath() {
    if (window.vpAuth?.socketPath) return window.vpAuth.socketPath();
    return base ? base + '/socket.io' : '/socket.io';
  }

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
    },

    applyAuthState() {
      this.authError = window.vpAuth?.error || null;
      if (window.vpAuth?.profile && window.vpAuth?.token) {
        const prev = this.token;
        this.profile = window.vpAuth.profile;
        this.token = window.vpAuth.token;
        if (!this.socket || prev !== this.token) this.connectSocket();
      } else {
        this.profile = null;
        this.token = null;
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
      this.connectSocket();
    },

    connectSocket() {
      if (this.socket) this.socket.disconnect();
      this.socket = io({ path: socketPath(), auth: { token: this.token } });
      this.socket.on('room:list', (list) => {
        if (Array.isArray(list)) this.rooms = list;
      });
      this.socket.on('room:state', (room) => {
        const i = this.rooms.findIndex((r) => r.id === room.id);
        if (i >= 0) this.rooms[i] = room;
      });
      this.socket.emit('room:list');
    },

    inRoom(roomId) {
      return this.rooms.some(
        (r) => r.id === roomId && r.seats.some((s) => s.pccuid === this.profile?.pccuid)
      );
    },

    joinRoom(roomId) {
      if (!this.socket) return;
      this.socket.emit('room:join', { roomId }, () => {
        this.openGame();
      });
    },

    openGame() {
      this.showGame = true;
      this.$nextTick?.(() => this.postAuthToGame());
      setTimeout(() => this.postAuthToGame(), 300);
    },

    closeGame() {
      this.showGame = false;
    },

    postAuthToGame() {
      const frame = document.getElementById('tienlen-frame');
      if (!frame?.contentWindow || !this.token || !this.profile) return;
      frame.contentWindow.postMessage(
        {
          type: 'vp-auth',
          token: this.token,
          profile: this.profile,
        },
        window.location.origin
      );
    },
  };
}
