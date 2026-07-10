(function () {
  const RANK = ['3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A', '2'];
  const SUIT = ['S', 'C', 'D', 'H'];
  const base = window.VP_BASE || '';

  function assetUrl(name) {
    return `${base}/modules/tienlen/assets/${name}.svg`;
  }

  function socketPath() {
    return base ? `${base}/socket.io` : '/socket.io';
  }

  const state = {
    token: null,
    profile: null,
    socket: null,
    room: null,
    hand: [],
    selected: new Set(),
  };

  const el = {
    status: document.getElementById('status'),
    table: document.getElementById('table'),
    hand: document.getElementById('hand'),
    last: document.getElementById('last'),
    error: document.getElementById('error'),
    me: document.getElementById('me'),
    btnStart: document.getElementById('btn-start'),
    btnLeave: document.getElementById('btn-leave'),
    btnPlay: document.getElementById('btn-play'),
    btnPass: document.getElementById('btn-pass'),
  };

  if (window.Phaser) {
    new Phaser.Game({
      type: Phaser.AUTO,
      parent: 'phaser-host',
      width: 8,
      height: 8,
      backgroundColor: '#0b1018',
      scene: { create() {} },
    });
  }

  window.parent.postMessage({ type: 'vp-game-ready' }, window.location.origin);

  window.addEventListener('message', (ev) => {
    if (ev.origin !== window.location.origin) return;
    if (ev.data?.type !== 'vp-auth') return;
    state.token = ev.data.token;
    state.profile = ev.data.profile;
    el.me.textContent = state.profile
      ? `${state.profile.displayName} (${state.profile.pccuid})`
      : '';
    connect();
  });

  el.btnStart.addEventListener('click', () => {
    state.socket?.emit('room:start', {}, (res) => {
      if (res && !res.ok) showError(res.error);
    });
  });

  el.btnLeave.addEventListener('click', () => {
    state.socket?.emit('room:leave', {}, () => {
      state.room = null;
      state.hand = [];
      render();
      el.status.textContent = 'Đã rời phòng';
    });
  });

  el.btnPlay.addEventListener('click', () => {
    const cardIds = [...state.selected];
    state.socket?.emit('hand:play', { cardIds }, (res) => {
      if (res && !res.ok) showError(res.error);
      else {
        state.selected.clear();
        state.hand = state.hand.filter((c) => !cardIds.includes(c));
        renderHand();
      }
    });
  });

  el.btnPass.addEventListener('click', () => {
    state.socket?.emit('hand:pass', {}, (res) => {
      if (res && !res.ok) showError(res.error);
    });
  });

  function connect() {
    if (state.socket) state.socket.disconnect();
    el.status.textContent = 'Đang kết nối…';
    state.socket = io({ path: socketPath(), auth: { token: state.token } });

    state.socket.on('connect', () => {
      el.status.textContent = 'Đã kết nối';
      state.socket.emit('room:list');
    });

    state.socket.on('connect_error', (err) => {
      el.status.textContent = 'Lỗi kết nối: ' + (err.message || 'auth');
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
        render();
      }
    });

    state.socket.on('hand:dealt', ({ cards }) => {
      state.hand = [...(cards || [])].sort((a, b) => a - b);
      state.selected.clear();
      renderHand();
      el.status.textContent = 'Đã chia bài';
      if (state.room) render();
    });

    state.socket.on('hand:error', (err) => showError(err));

    state.socket.on('hand:finished', (payload) => {
      const mine = payload.pointsDelta?.[state.profile?.pccuid];
      el.status.textContent =
        'Ván xong. Điểm: ' +
        (mine >= 0 ? '+' : '') +
        (mine ?? 0) +
        ' · ' +
        (payload.finishOrder || []).join(' → ');
      state.hand = [];
      state.selected.clear();
      renderHand();
    });
  }

  function showError(err) {
    el.error.textContent = err?.message || err?.code || 'Error';
    setTimeout(() => {
      if (el.error.textContent === (err?.message || err?.code || 'Error')) {
        el.error.textContent = '';
      }
    }, 4000);
  }

  function assetName(id) {
    return SUIT[id % 4] + RANK[Math.floor(id / 4)];
  }

  function render() {
    const room = state.room;
    if (!room) {
      el.table.innerHTML = '<p class="muted">Chưa vào phòng. Chọn phòng trên portal.</p>';
      el.btnStart.disabled = true;
      el.btnPlay.disabled = true;
      el.btnPass.disabled = true;
      return;
    }

    const isHost = room.hostPccuid === state.profile?.pccuid;
    const canStart =
      isHost &&
      (room.phase === 'waiting' || room.phase === 'idle') &&
      room.seats.length >= 2;
    el.btnStart.disabled = !canStart;
    el.status.textContent = `Phòng ${room.id} · ${room.phase} · ${room.seats.length}/4`;

    el.table.innerHTML = room.seats
      .map((s) => {
        const turn = room.hand?.currentTurn === s.pccuid ? ' turn' : '';
        const host = room.hostPccuid === s.pccuid ? ' host' : '';
        const count = room.hand?.cardCounts?.[s.pccuid];
        const countLabel = count != null ? ` · ${count} lá` : '';
        const offline = s.connected === false ? ' (offline)' : '';
        return `<div class="seat${turn}${host}"><div>${escapeHtml(s.displayName)}${offline}</div><div class="muted">${s.pccuid}${countLabel}</div></div>`;
      })
      .join('');

    if (room.hand?.lastCombo) {
      const c = room.hand.lastCombo;
      el.last.textContent = `Bài trên bàn: ${c.type} [${c.cards.map(assetName).join(', ')}]`;
    } else if (room.hand?.freeLead) {
      el.last.textContent = room.hand.mustInclude3s
        ? 'Lượt mở: phải có 3♠'
        : 'Lượt tự do';
    } else {
      el.last.textContent = '';
    }

    const myTurn = room.hand?.currentTurn === state.profile?.pccuid;
    el.btnPlay.disabled = !myTurn || state.selected.size === 0;
    el.btnPass.disabled = !myTurn || !!room.hand?.freeLead;
    renderHand();
  }

  function renderHand() {
    el.hand.innerHTML = '';
    for (const id of state.hand) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'card-btn' + (state.selected.has(id) ? ' selected' : '');
      btn.title = assetName(id);
      const img = document.createElement('img');
      img.alt = assetName(id);
      img.src = assetUrl(assetName(id));
      img.onerror = () => {
        btn.textContent = assetName(id);
      };
      btn.appendChild(img);
      btn.addEventListener('click', () => {
        if (state.selected.has(id)) state.selected.delete(id);
        else state.selected.add(id);
        render();
      });
      el.hand.appendChild(btn);
    }
    const room = state.room;
    const myTurn = room?.hand?.currentTurn === state.profile?.pccuid;
    el.btnPlay.disabled = !myTurn || state.selected.size === 0;
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }
})();
