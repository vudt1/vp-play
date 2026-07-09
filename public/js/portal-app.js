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

    async init() {
      await (window.vpAuth?.ready || Promise.resolve());
      this.devMode = !!window.vpAuth?.devMode || !!window.VP_KEYCLOAK?.authDevBypass;
      if (window.vpAuth?.profile) {
        this.profile = window.vpAuth.profile;
        this.token = window.vpAuth.token;
        this.connectSocket();
      }
      window.addEventListener('message', (ev) => {
        if (ev.origin !== window.location.origin) return;
        if (ev.data?.type === 'vp-game-ready') this.postAuthToGame();
      });
    },

    login() {
      window.vpAuth?.login?.();
    },

    logout() {
      window.vpAuth?.logout?.();
    },

    async devLogin() {
      const id = (this.devId || 'player1').trim();
      this.token = id;
      this.profile = { pccuid: id, displayName: id };
      window.vpAuth.token = id;
      window.vpAuth.profile = this.profile;
      await fetch(apiUrl('/api/auth/sync'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${id}`,
        },
        body: JSON.stringify({ displayName: id }),
      });
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
