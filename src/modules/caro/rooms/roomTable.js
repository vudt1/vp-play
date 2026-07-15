'use strict';

const caroRules = require('../domain/caroRules');

const ROOM_IDS = [1, 2, 3];
const MAX_SEATS = 2;

function markValue(mark) {
  if (mark === 'X') return 1;
  if (mark === 'O') return 2;
  return 0;
}

function createRoomTable(options = {}) {
  const onSettle = options.onSettle ?? (async () => {});

  const rooms = new Map();
  for (const id of ROOM_IDS) {
    rooms.set(id, emptyRoom(id));
  }

  const playerIndex = new Map();

  function emptyRoom(id) {
    return {
      id,
      phase: 'idle',
      seats: [],
      hostPccuid: null,
      match: null,
      lastResult: null,
    };
  }

  function publicRoom(room) {
    return {
      id: room.id,
      phase: room.phase,
      seats: room.seats.map((s) => ({
        pccuid: s.pccuid,
        displayName: s.displayName,
        connected: s.connected,
        mark: s.mark || null,
      })),
      hostPccuid: room.hostPccuid,
      match: room.match
        ? {
            board: room.match.board.map((row) => row.slice()),
            currentTurn: room.match.currentTurn,
            turnPccuid: room.match.currentTurn,
            marks: { ...room.match.marks },
          }
        : null,
      lastResult: room.lastResult
        ? {
            result: room.lastResult.result,
            winnerId: room.lastResult.winnerId,
            winnerPccuid: room.lastResult.winnerPccuid,
            pointsDelta: { ...room.lastResult.pointsDelta },
            board: room.lastResult.board
              ? room.lastResult.board.map((row) => row.slice())
              : null,
            winLine: (room.lastResult.winLine || []).map((c) => c.slice()),
            lastMove: room.lastResult.lastMove
              ? { ...room.lastResult.lastMove }
              : null,
          }
        : null,
    };
  }

  function err(code, message) {
    return { ok: false, error: { code, message } };
  }

  function ok(extra) {
    return { ok: true, ...extra };
  }

  function list() {
    return ROOM_IDS.map((id) => publicRoom(rooms.get(id)));
  }

  function findPlayerRoom(pccuid) {
    return playerIndex.get(pccuid) ?? null;
  }

  function reassignHost(room) {
    if (room.seats.some((s) => s.pccuid === room.hostPccuid)) return;
    room.hostPccuid = room.seats[0]?.pccuid ?? null;
  }

  function join(player, roomId) {
    const room = rooms.get(roomId);
    if (!room) return err('ROOM_NOT_FOUND', 'Không tìm thấy phòng chơi');
    if (playerIndex.has(player.pccuid)) {
      const current = playerIndex.get(player.pccuid);
      if (current === roomId) return ok({ room: publicRoom(room) });
      return err('ALREADY_IN_ROOM', 'Bạn đã ở trong phòng khác');
    }
    if (room.phase === 'playing' || room.phase === 'settling') {
      return err('ROOM_BUSY', 'Phòng đang có người chơi');
    }
    if (room.seats.length >= MAX_SEATS) return err('ROOM_FULL', 'Phòng đã đầy');

    room.seats.push({
      pccuid: player.pccuid,
      displayName: player.displayName || player.pccuid,
      socketId: player.socketId || null,
      connected: true,
      mark: null,
    });
    if (!room.hostPccuid) room.hostPccuid = player.pccuid;
    if (room.phase === 'idle') room.phase = 'waiting';
    playerIndex.set(player.pccuid, roomId);
    return ok({ room: publicRoom(room) });
  }

  function abortMatch(room, reason) {
    room.match = null;
    room.lastResult = null;
    room.phase = room.seats.length === 0 ? 'idle' : 'waiting';
    for (const s of room.seats) s.mark = null;
    return {
      ok: true,
      aborted: true,
      abortReason: reason || 'solo',
      room: publicRoom(room),
    };
  }

  function leave(pccuid) {
    const roomId = playerIndex.get(pccuid);
    if (roomId == null) return err('NOT_IN_ROOM', 'Chưa chọn phòng chơi');
    const room = rooms.get(roomId);

    if (room.phase === 'playing' || room.phase === 'settling') {
      room.seats = room.seats.filter((s) => s.pccuid !== pccuid);
      playerIndex.delete(pccuid);
      reassignHost(room);
      if (room.seats.length === 0) {
        Object.assign(room, emptyRoom(roomId));
        return {
          ok: true,
          aborted: true,
          abortReason: 'empty',
          room: publicRoom(room),
        };
      }
      return abortMatch(room, 'solo');
    }

    room.seats = room.seats.filter((s) => s.pccuid !== pccuid);
    playerIndex.delete(pccuid);
    reassignHost(room);
    if (room.seats.length === 0) {
      Object.assign(room, emptyRoom(roomId));
    }
    return ok({ room: publicRoom(room) });
  }

  function disconnect(pccuid) {
    const roomId = playerIndex.get(pccuid);
    if (roomId == null) return ok({});
    const room = rooms.get(roomId);
    if (room.phase === 'playing' || room.phase === 'settling') {
      room.seats = room.seats.filter((s) => s.pccuid !== pccuid);
      playerIndex.delete(pccuid);
      reassignHost(room);
      if (room.seats.length === 0) {
        Object.assign(room, emptyRoom(roomId));
        return {
          ok: true,
          aborted: true,
          abortReason: 'empty',
          room: publicRoom(room),
        };
      }
      return abortMatch(room, 'disconnect');
    }

    const seat = room.seats.find((s) => s.pccuid === pccuid);
    if (seat) {
      seat.connected = false;
      seat.socketId = null;
    }
    room.seats = room.seats.filter((s) => s.pccuid !== pccuid);
    playerIndex.delete(pccuid);
    reassignHost(room);
    if (room.seats.length === 0) {
      Object.assign(room, emptyRoom(roomId));
    }
    return ok({ room: publicRoom(room) });
  }

  function rebindSocket(pccuid, socketId) {
    const roomId = playerIndex.get(pccuid);
    if (roomId == null) return err('NOT_IN_ROOM', 'Chưa vào phòng');
    const room = rooms.get(roomId);
    const seat = room.seats.find((s) => s.pccuid === pccuid);
    if (!seat) return err('NOT_IN_ROOM', 'Chưa vào phòng');
    seat.socketId = socketId;
    seat.connected = true;
    return ok({ room: publicRoom(room) });
  }

  function start(pccuid) {
    const roomId = playerIndex.get(pccuid);
    if (roomId == null) return err('NOT_IN_ROOM', 'Chưa vào phòng');
    const room = rooms.get(roomId);
    if (room.hostPccuid !== pccuid) {
      return err('NOT_HOST', 'Chỉ host được bắt đầu');
    }
    if (room.phase === 'playing' || room.phase === 'settling') {
      return err('ROOM_BUSY', 'Trận đang diễn ra');
    }
    if (room.seats.length < MAX_SEATS) {
      return err('NEED_PLAYERS', 'Cần đủ 2 người để bắt đầu');
    }

    const host = room.seats.find((s) => s.pccuid === room.hostPccuid) || room.seats[0];
    const guest = room.seats.find((s) => s.pccuid !== host.pccuid);
    host.mark = 'X';
    guest.mark = 'O';

    room.match = {
      board: caroRules.createEmptyBoard(),
      currentTurn: host.pccuid,
      marks: {
        [host.pccuid]: 'X',
        [guest.pccuid]: 'O',
      },
    };
    room.lastResult = null;
    room.phase = 'playing';
    return ok({ room: publicRoom(room) });
  }

  function settleWin(room, winnerId, lastMove, winLine) {
    const loser = room.seats.find((s) => s.pccuid !== winnerId);
    const deltas = {};
    deltas[winnerId] = 1;
    if (loser) deltas[loser.pccuid] = -1;

    const board = caroRules.cloneBoard(room.match.board);
    const finished = {
      result: 'win',
      winnerId,
      winnerPccuid: winnerId,
      pointsDelta: deltas,
      reason: 'win',
      board,
      winLine: winLine?.cells || [],
      lastMove,
    };

    room.phase = 'waiting';
    room.match = null;
    room.lastResult = finished;
    for (const s of room.seats) s.mark = null;

    Promise.resolve(
      onSettle({
        pointsDelta: deltas,
        winnerId,
        winnerPccuid: winnerId,
      })
    ).catch(() => {});

    return ok({
      room: publicRoom(room),
      finished,
    });
  }

  function settleDraw(room, lastMove) {
    const board = room.match ? caroRules.cloneBoard(room.match.board) : null;
    const finished = {
      result: 'draw',
      winnerId: null,
      winnerPccuid: null,
      pointsDelta: {},
      reason: 'draw',
      board,
      winLine: [],
      lastMove: lastMove || null,
    };
    room.phase = 'waiting';
    room.match = null;
    room.lastResult = finished;
    for (const s of room.seats) s.mark = null;
    return ok({
      room: publicRoom(room),
      finished,
    });
  }

  function move(pccuid, row, col) {
    const roomId = playerIndex.get(pccuid);
    if (roomId == null) return err('NOT_IN_ROOM', 'Chưa vào phòng');
    const room = rooms.get(roomId);
    if (room.phase !== 'playing' || !room.match) {
      return err('NOT_PLAYING', 'Chưa bắt đầu trận');
    }
    if (room.match.currentTurn !== pccuid) {
      return err('NOT_YOUR_TURN', 'Không phải lượt của bạn');
    }
    const mark = room.match.marks[pccuid];
    if (!mark) return err('NO_MARK', 'Không có quân cờ');

    const val = markValue(mark);
    if (!caroRules.isValidMove(room.match.board, row, col)) {
      return err('INVALID_MOVE', 'Nước đi không hợp lệ');
    }

    room.match.board[row][col] = val;
    const moved = { row, col, mark, pccuid };

    const winLine = caroRules.findWinLine(room.match.board, row, col, val);
    if (winLine) {
      const result = settleWin(room, pccuid, moved, winLine);
      return {
        ...result,
        moved,
      };
    }
    if (caroRules.isBoardFull(room.match.board)) {
      const result = settleDraw(room, moved);
      return {
        ...result,
        moved,
      };
    }

    const other = room.seats.find((s) => s.pccuid !== pccuid);
    room.match.currentTurn = other ? other.pccuid : pccuid;
    return ok({
      room: publicRoom(room),
      moved,
    });
  }

  return {
    list,
    join,
    leave,
    start,
    move,
    disconnect,
    rebindSocket,
    findPlayerRoom,
    ROOM_IDS,
    MAX_SEATS,
  };
}

module.exports = { createRoomTable, ROOM_IDS, MAX_SEATS };
