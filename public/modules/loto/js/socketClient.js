window.Loto = window.Loto || {};

Loto.createSocketClient = function createSocketClient(opts) {
  const {
    socketPath,
    getToken,
    getProfile,
    onStatus,
    onRoom,
    onNumberDrawn,
    onChecking,
    onOver,
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

    socket = io('/loto', {
      path: socketPath(),
      auth: { token },
    });

    let joinedChannelRoomId = null;

    function ensureRoomChannel(list) {
      const profile = getProfile();
      if (!profile || !socket) return;
      const mine = (list || []).find((r) =>
        (r.seats || []).some((s) => s.pccuid === profile.pccuid)
      );
      if (!mine) {
        joinedChannelRoomId = null;
        return;
      }
      if (joinedChannelRoomId === mine.id) return;
      joinedChannelRoomId = mine.id;
      socket.emit('room:join', { roomId: mine.id }, (ack) => {
        if (ack && ack.ok === false) {
          joinedChannelRoomId = null;
          onError?.(ack.error);
          return;
        }
        if (ack?.room) onRoom?.(ack.room, { fromList: false });
      });
    }

    socket.on('connect', () => {
      onStatus?.('Đã kết nối');
      joinedChannelRoomId = null;
      socket.emit('room:list');
    });

    socket.on('connect_error', (err) => {
      onStatus?.('Lỗi kết nối: ' + (err?.message || 'auth'));
    });

    socket.on('room:list', (list) => {
      const profile = getProfile();
      if (!profile) return;
      ensureRoomChannel(list);
      const mine = (list || []).find((r) =>
        (r.seats || []).some((s) => s.pccuid === profile.pccuid)
      );
      onRoom?.(mine || null, { fromList: true });
    });

    socket.on('room:state', (room) => {
      onRoom?.(room, { fromList: false });
    });


    socket.on('round:number_drawn', (payload) => {
      onNumberDrawn?.(payload);
    });

    socket.on('round:player_checking_kinh', (payload) => {
      onChecking?.(payload);
    });

    socket.on('round:over', (payload) => {
      onOver?.(payload);
    });

    socket.on('round:aborted', (payload) => {
      onAborted?.(payload);
    });

    socket.on('round:error', (err) => {
      onError?.(err);
    });
  }

  return {
    connect,
    disconnect,
    get socket() {
      return socket;
    },
    emitPrepare(ack) {
      socket?.emit('round:prepare_tickets', {}, ack);
    },
    emitSelectTicket(ticketId, ack) {
      socket?.emit('round:select_ticket', { ticketId }, ack);
    },
    emitStart(ack) {
      socket?.emit('round:start', {}, ack);
    },
    emitKinh(ack) {
      socket?.emit('round:submit_kinh', {}, ack);
    },
    requestList() {
      socket?.emit('room:list');
    },
  };
};
