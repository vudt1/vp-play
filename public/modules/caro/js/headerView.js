window.Caro = window.Caro || {};

Caro.createHeaderView = function createHeaderView(uiLayer) {
  const { BASE_W, COLOR } = Caro.CONST;

  function makeText(content, style) {
    return new PIXI.Text({ text: content, style });
  }

  function createPlayerSlot(side) {
    const root = new PIXI.Container();
    const isLeft = side === 'left';

    const ring = new PIXI.Graphics();
    ring.visible = false;
    root.addChild(ring);

    const icon = new PIXI.Sprite(PIXI.Texture.from(isLeft ? 'mark-x' : 'mark-o'));
    icon.width = 52;
    icon.height = 52;
    icon.anchor.set(0.5);

    const name = makeText(isLeft ? 'Chờ Host…' : 'Chờ Guest…', {
      fontFamily: 'Segoe UI, system-ui, sans-serif',
      fontSize: 38,
      fill: isLeft ? COLOR.host : COLOR.guest,
      fontWeight: '700',
    });
    name.anchor.set(isLeft ? 0 : 1, 0.5);

    root.addChild(icon, name);

    let phase = 0;
    let active = false;
    let padX = 18;
    let padY = 12;
    let radius = 16;

    function layout() {
      const gap = 14;
      if (isLeft) {
        icon.x = 0;
        icon.y = 0;
        name.x = icon.width / 2 + gap;
        name.y = 0;
      } else {
        icon.x = 0;
        icon.y = 0;
        name.x = -(icon.width / 2 + gap);
        name.y = 0;
      }
    }

    function contentBounds() {
      const nw = name.width;
      const nh = Math.max(name.height, icon.height);
      if (isLeft) {
        const left = -icon.width / 2;
        const right = name.x + nw;
        return {
          x: left - padX,
          y: -nh / 2 - padY,
          w: right - left + padX * 2,
          h: nh + padY * 2,
        };
      }
      const right = icon.width / 2;
      const left = name.x - nw;
      return {
        x: left - padX,
        y: -nh / 2 - padY,
        w: right - left + padX * 2,
        h: nh + padY * 2,
      };
    }

    function drawRing() {
      const b = contentBounds();
      ring.clear();
      const dash = 14;
      const gap = 10;
      const perim =
        2 * (b.w + b.h - 2 * radius) + 2 * Math.PI * radius;
      const period = dash + gap;
      const offset = (phase % 1) * period;

      ring.roundRect(b.x, b.y, b.w, b.h, radius);
      ring.stroke({
        width: 3,
        color: COLOR.turnGlow,
        alpha: 0.35 + 0.25 * Math.sin(phase * Math.PI * 2),
      });

      const segs = Math.max(12, Math.floor(perim / period));
      for (let i = 0; i < segs; i++) {
        const t0 = ((i * period + offset) % perim) / perim;
        const t1 = ((i * period + offset + dash) % perim) / perim;
        strokeArcSegment(ring, b, radius, t0, t1);
      }
    }

    function strokeArcSegment(g, b, r, t0, t1) {
      if (t1 < t0) t1 += 1;
      const steps = 8;
      let started = false;
      for (let s = 0; s <= steps; s++) {
        const t = t0 + ((t1 - t0) * s) / steps;
        const p = pointOnRoundedRect(b, r, t % 1);
        if (!started) {
          g.moveTo(p.x, p.y);
          started = true;
        } else {
          g.lineTo(p.x, p.y);
        }
      }
      g.stroke({ width: 3.5, color: COLOR.turnRing, alpha: 0.95 });
    }

    function pointOnRoundedRect(b, r, t) {
      const straightW = Math.max(0, b.w - 2 * r);
      const straightH = Math.max(0, b.h - 2 * r);
      const arc = (Math.PI / 2) * r;
      const lens = [straightW, arc, straightH, arc, straightW, arc, straightH, arc];
      const total = lens.reduce((a, n) => a + n, 0) || 1;
      let d = ((t % 1) + 1) % 1 * total;
      const x0 = b.x;
      const y0 = b.y;
      const x1 = b.x + b.w;
      const y1 = b.y + b.h;

      if (d <= lens[0]) return { x: x0 + r + d, y: y0 };
      d -= lens[0];
      if (d <= lens[1]) {
        const a = -Math.PI / 2 + d / r;
        return { x: x1 - r + Math.cos(a) * r, y: y0 + r + Math.sin(a) * r };
      }
      d -= lens[1];
      if (d <= lens[2]) return { x: x1, y: y0 + r + d };
      d -= lens[2];
      if (d <= lens[3]) {
        const a = 0 + d / r;
        return { x: x1 - r + Math.cos(a) * r, y: y1 - r + Math.sin(a) * r };
      }
      d -= lens[3];
      if (d <= lens[4]) return { x: x1 - r - d, y: y1 };
      d -= lens[4];
      if (d <= lens[5]) {
        const a = Math.PI / 2 + d / r;
        return { x: x0 + r + Math.cos(a) * r, y: y1 - r + Math.sin(a) * r };
      }
      d -= lens[5];
      if (d <= lens[6]) return { x: x0, y: y1 - r - d };
      d -= lens[6];
      {
        const a = Math.PI + d / r;
        return { x: x0 + r + Math.cos(a) * r, y: y0 + r + Math.sin(a) * r };
      }
    }

    function setActive(on) {
      active = !!on;
      ring.visible = active;
      if (active) drawRing();
      else ring.clear();
    }

    function tick(dt) {
      if (!active) return;
      phase = (phase + dt * 0.9) % 1;
      drawRing();
    }

    function setPlayer(seat, emptyLabel) {
      name.text = seat?.displayName || seat?.pccuid || emptyLabel;
      icon.alpha = seat ? 1 : 0.35;
      name.alpha = seat ? 1 : 0.55;
      layout();
      if (active) drawRing();
    }

    layout();
    return { root, icon, name, setActive, setPlayer, tick };
  }

  const left = createPlayerSlot('left');
  const right = createPlayerSlot('right');

  left.root.x = 140;
  left.root.y = 58;
  right.root.x = BASE_W - 140;
  right.root.y = 58;

  const status = makeText('Chờ xác thực…', {
    fontFamily: 'Segoe UI, system-ui, sans-serif',
    fontSize: 24,
    fill: COLOR.muted,
    fontWeight: '500',
  });
  status.anchor.set(0.5, 0.5);
  status.x = BASE_W / 2;
  status.y = 44;

  const turn = makeText('', {
    fontFamily: 'Segoe UI, system-ui, sans-serif',
    fontSize: 26,
    fill: COLOR.text,
    fontWeight: '600',
  });
  turn.anchor.set(0.5, 0.5);
  turn.x = BASE_W / 2;
  turn.y = 88;

  uiLayer.addChild(left.root, right.root, status, turn);

  function seatPair(room) {
    if (!room?.seats?.length) return { host: null, guest: null };
    const host =
      room.seats.find((s) => s.pccuid === room.hostPccuid) || room.seats[0] || null;
    const guest = room.seats.find((s) => s.pccuid !== host?.pccuid) || null;
    return { host, guest };
  }

  function render(room, myPccuid) {
    if (!room) {
      left.setPlayer(null, 'Chờ Host…');
      right.setPlayer(null, 'Chờ Guest…');
      left.setActive(false);
      right.setActive(false);
      status.text = 'Chưa vào phòng. Chọn phòng trên portal.';
      turn.text = '';
      return { canStart: false, seatsN: 0 };
    }

    const { host, guest } = seatPair(room);
    left.setPlayer(host, 'Chờ Host…');
    right.setPlayer(guest, 'Chờ Guest…');

    const seatsN = room.seats?.length || 0;
    status.text = `Phòng ${room.id} · ${room.phase} · ${seatsN}/2`;

    const waiting = room.phase === 'waiting' || room.phase === 'idle';
    const isHost = !!(myPccuid && room.hostPccuid === myPccuid);
    const canStart = waiting && isHost && seatsN === 2;

    if (room.phase === 'playing' && room.match) {
      const turnId = room.match.currentTurn;
      left.setActive(host?.pccuid === turnId);
      right.setActive(guest?.pccuid === turnId);
      if (turnId === myPccuid) {
        turn.text = 'Lượt của bạn';
        turn.style.fill = COLOR.turnGlow;
      } else {
        const name =
          room.seats.find((s) => s.pccuid === turnId)?.displayName || 'đối thủ';
        turn.text = `Lượt: ${name}`;
        turn.style.fill = COLOR.muted;
      }
    } else {
      left.setActive(false);
      right.setActive(false);
      if (waiting && seatsN < 2) turn.text = 'Chờ đủ 2 người chơi';
      else if (waiting && canStart) turn.text = 'Sẵn sàng — bấm Bắt đầu';
      else if (waiting) turn.text = 'Chờ Host bắt đầu';
      else turn.text = '';
    }

    return { canStart, seatsN, waiting, isHost };
  }

  function tick(dt) {
    left.tick(dt);
    right.tick(dt);
  }

  return {
    status,
    turn,
    render,
    tick,
    setStatus(text) {
      status.text = text;
    },
  };
};
