window.Caro = window.Caro || {};

Caro.createSocketClient = function createSocketClient(opts) {
  const {
    socketPath,
    getToken,
    getProfile,
    onStatus,
    onRoom,
    onMoved,
    onFinished,
    onAborted,
    onError,
  } = opts;

  let socket = null;

  function disconnect() {
    if (!socket) return;
    try {
      socket.disconnect();
    } catch (_) {
      /* ignore */
    }
    socket = null;
  }

  function connect() {
    const token = getToken();
    if (!token) return;

    if (socket?.connected) {
      try {
        if (socket.auth) socket.auth.token = token;
      } catch (_) {
        /* ignore */
      }
      socket.emit('room:list');
      return;
    }

    disconnect();
    onStatus?.('Đang kết nối…');

    socket = io('/caro', {
      path: socketPath(),
      auth: { token },
    });

    socket.on('connect', () => {
      onStatus?.('Đã kết nối');
      socket.emit('room:list');
    });

    socket.on('connect_error', (err) => {
      onStatus?.('Lỗi kết nối: ' + (err?.message || 'auth'));
    });

    socket.on('room:list', (list) => {
      const profile = getProfile();
      if (!profile) return;
      const mine = (list || []).find((r) =>
        (r.seats || []).some((s) => s.pccuid === profile.pccuid)
      );
      onRoom?.(mine || null, { fromList: true });
    });

    socket.on('room:state', (room) => {
      onRoom?.(room, { fromList: false });
    });

    socket.on('match:moved', (payload) => {
      onMoved?.(payload);
    });

    socket.on('match:finished', (payload) => {
      onFinished?.(payload);
    });

    socket.on('match:aborted', (payload) => {
      onAborted?.(payload);
    });

    socket.on('match:error', (err) => {
      onError?.(err);
    });
  }

  return {
    connect,
    disconnect,
    get socket() {
      return socket;
    },
    emitMove(row, col, ack) {
      socket?.emit('match:move', { row, col }, ack);
    },
    emitStart(ack) {
      socket?.emit('room:start', {}, ack);
    },
    requestList() {
      socket?.emit('room:list');
    },
  };
};
