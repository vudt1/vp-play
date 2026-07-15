Kế hoạch này tuân thủ nghiêm ngặt các nguyên tắc thiết kế cốt lõi của hệ thống: tách biệt hoàn toàn logic nghiệp vụ (domain), sử dụng mô hình Socket.IO Adapter cho luồng dữ liệu thời gian thực, quản lý phòng chơi cô lập, tích hợp hệ thống điểm số toàn cục, và hiển thị client thông qua PixiJS đặt trong iframe chuẩn khung hình $1920 \times 1080$.

---

## 1. Kế hoạch triển khai & Cấu trúc thư mục

Để tích hợp mượt mà vào dự án, chúng ta sẽ tạo mới các cấu trúc file tương ứng với cấu trúc của module `tienlen` hiện tại:

```text
├── src/
│   ├── modules/
│   │   ├── catalog.js                # Đăng ký thông tin module Caro[cite: 1]
│   │   └── caro/                     # Backend module Caro[cite: 1]
│   │       ├── index.js              # Entry point của module[cite: 1]
│   │       ├── domain/
│   │       │   └── caroRules.js      # Logic bàn cờ & luật chặn 2 đầu (Pure JS)[cite: 1]
│   │       ├── rooms/
│   │       │   └── roomTable.js      # Quản lý 3 phòng chơi, ghế ngồi, timeout[cite: 1]
│   │       └── sockets.js            # Socket.IO adapter xử lý kết nối/sự kiện[cite: 1]
│   └── sockets/
│       └── index.js                  # Mount caro socket adapter vào cổng chung[cite: 1]
└── public/
    └── modules/
        └── caro/                     # Web client (Iframe)[cite: 1]
            ├── icon.png              # Icon đại diện ngoài portal[cite: 1]
            ├── index.html            # File HTML tĩnh load game[cite: 1]
            ├── assets/
            │   ├── x.svg             # Quân cờ X[cite: 1]
            │   ├── o.svg             # Quân cờ O[cite: 1]
            │   └── sounds/
            │       └── place.mp3     # Âm thanh đặt quân[cite: 1]
            └── js/
                ├── libs/             # Thư viện PixiJS v8, GSAP 3, Howler[cite: 1]
                └── game.js           # Xử lý canvas, vẽ bàn cờ, kết nối socket

```

---

## 2. Thiết kế Server-Side (Backend)

### 2.1. Logic bàn cờ & Luật chặn hai đầu (`caroRules.js`)

File logic này được thiết kế theo dạng **Pure Functions** (không chứa I/O hay state) để dễ dàng viết Unit Test độc lập.

```javascript
// src/modules/caro/domain/caroRules.js

const BOARD_SIZE = 15;

function createEmptyBoard() {
  return Array(BOARD_SIZE).fill(null).map(() => Array(BOARD_SIZE).fill(0));
}

/**
 * Kiểm tra xem nước đi có hợp lệ không
 */
function isValidMove(board, row, col) {
  return row >= 0 && row < BOARD_SIZE && col >= 0 && col < BOARD_SIZE && board[row][col] === 0;
}

/**
 * Kiểm tra xem người chơi hiện tại (playerVal: 1 hoặc 2) có thắng hay không
 * dựa trên nước đi cuối cùng tại (r, c) kèm Luật chặn hai đầu Việt Nam.
 */
function checkWin(board, r, c, playerVal) {
  const directions = [
    [0, 1],   // Ngang
    [1, 0],   // Dọc
    [1, 1],   // Chéo xuôi
    [1, -1]   // Chéo ngược
  ];

  const opponentVal = playerVal === 1 ? 2 : 1;

  for (const [dr, dc] of directions) {
    let count = 1;
    
    // Đếm tiến
    let stepForward = 1;
    while (
      r + dr * stepForward >= 0 && r + dr * stepForward < BOARD_SIZE &&
      c + dc * stepForward >= 0 && c + dc * stepForward < BOARD_SIZE &&
      board[r + dr * stepForward][c + dc * stepForward] === playerVal
    ) {
      count++;
      stepForward++;
    }

    // Đếm lùi
    let stepBackward = 1;
    while (
      r - dr * stepBackward >= 0 && r - dr * stepBackward < BOARD_SIZE &&
      c - dc * stepBackward >= 0 && c - dc * stepBackward < BOARD_SIZE &&
      board[r - dr * stepBackward][c - dc * stepBackward] === playerVal
    ) {
      count++;
      stepBackward++;
    }

    // Đạt từ 5 quân liên tiếp trở lên
    if (count >= 5) {
      // Xác định tọa độ hai đầu chuỗi để kiểm tra chặn
      const headR = r + dr * stepForward;
      const headC = c + dc * stepForward;
      const tailR = r - dr * stepBackward;
      const tailC = c - dc * stepBackward;

      let headBlocked = false;
      let tailBlocked = false;

      // Kiểm tra đầu chuỗi
      if (headR >= 0 && headR < BOARD_SIZE && headC >= 0 && headC < BOARD_SIZE) {
        if (board[headR][headC] === opponentVal) {
          headBlocked = true;
        }
      }

      // Kiểm tra cuối chuỗi
      if (tailR >= 0 && tailR < BOARD_SIZE && tailC >= 0 && tailC < BOARD_SIZE) {
        if (board[tailR][tailC] === opponentVal) {
          tailBlocked = true;
        }
      }

      // Luật chặn hai đầu: Chỉ bỏ qua chiến thắng khi cả hai đầu ĐỀU bị chặn bởi quân đối phương
      if (headBlocked && tailBlocked) {
        continue; 
      }

      return true; // Thắng hợp lệ
    }
  }

  return false;
}

module.exports = {
  BOARD_SIZE,
  createEmptyBoard,
  isValidMove,
  checkWin
};

```

### 2.2. Quản lý phòng chơi (`roomTable.js`)

Caro chỉ cần tối đa 2 người chơi mỗi bàn đấu. Ta sẽ thiết lập hệ thống 3 phòng cố định như yêu cầu.

```javascript
// src/modules/caro/rooms/roomTable.js
const { createEmptyBoard } = require('../domain/caroRules');

class CaroRoomTable {
  constructor(roomId) {
    this.roomId = roomId;
    this.players = []; // Tối đa 2 players [{ id, username, symbol: 'X'|'O' }]
    this.phase = 'waiting'; // 'waiting' | 'playing'
    this.board = null;
    this.currentTurnIdx = 0;
  }

  join(player) {
    if (this.players.length >= 2) return { error: 'Room is full' };
    if (this.phase !== 'waiting') return { error: 'Game already in progress' };

    const symbol = this.players.length === 0 ? 'X' : 'O';
    this.players.push({ ...player, symbol });
    return { success: true, symbol };
  }

  leave(playerId) {
    this.players = this.players.filter(p => p.id !== playerId);
    if (this.phase === 'playing') {
      // Huỷ trận đấu giữa chừng nếu người chơi thoát ra
      this.phase = 'waiting';
      this.board = null;
      return { action: 'abort' };
    }
    return { action: 'update' };
  }

  start() {
    if (this.players.length < 2) return { error: 'Need 2 players to start' };
    this.phase = 'playing';
    this.board = createEmptyBoard();
    this.currentTurnIdx = 0; // X đi trước
    return { success: true, board: this.board, currentTurn: this.players[this.currentTurnIdx].id };
  }
}

module.exports = CaroRoomTable;

```

### 2.3. Socket.IO Adapter (`sockets.js`)

Nhận nhiệm vụ điều phối kết nối, xác thực người dùng dựa trên token JWT và gọi các dịch vụ lưu điểm khi trận đấu kết thúc.

```javascript
// src/modules/caro/sockets.js
const CaroRoomTable = require('./rooms/roomTable');
const { isValidMove, checkWin } = require('./domain/caroRules');
const rankService = require('../../services/rankService');

// Khởi tạo 3 phòng chơi cố định
const rooms = Array.from({ length: 3 }, (_, i) => new CaroRoomTable(`caro-room-${i + 1}`));

module.exports = function(io) {
  const caroNamespace = io.of('/caro');

  caroNamespace.on('connection', (socket) => {
    const user = socket.request.user;

    socket.on('room:join', ({ roomId }) => {
      const room = rooms.find(r => r.roomId === roomId);
      if (!room) return socket.emit('room:error', { message: 'Phòng không tồn tại!' });

      const result = room.join({ id: user.id, username: user.username });
      if (result.error) {
        return socket.emit('room:error', { message: result.error });
      }

      socket.join(roomId);
      socket.emit('room:joined', { symbol: result.symbol, state: room });
      caroNamespace.to(roomId).emit('room:updated', { players: room.players });

      // Tự động bắt đầu khi đủ 2 người chơi
      if (room.players.length === 2 && room.phase === 'waiting') {
        const gameStart = room.start();
        caroNamespace.to(roomId).emit('game:started', gameStart);
      }
    });

    socket.on('game:move', ({ roomId, row, col }) => {
      const room = rooms.find(r => r.roomId === roomId);
      if (!room || room.phase !== 'playing') return;

      const activePlayer = room.players[room.currentTurnIdx];
      if (activePlayer.id !== user.id) return socket.emit('game:error', { message: 'Không phải lượt của bạn!' });

      const playerVal = activePlayer.symbol === 'X' ? 1 : 2;
      const { board } = room;

      if (!isValidMove(board, row, col)) {
        return socket.emit('game:error', { message: 'Nước đi không hợp lệ!' });
      }

      // Đánh quân cờ lên bảng
      board[row][col] = playerVal;

      // Phát sự kiện vẽ nước đi kèm âm thanh tại Client
      caroNamespace.to(roomId).emit('game:moved', { row, col, symbol: activePlayer.symbol });

      // Kiểm tra thắng cuộc
      if (checkWin(board, row, col, playerVal)) {
        handleEndGame(room, roomId, activePlayer.id);
      } else {
        // Đổi lượt đi (Vô thời hạn)
        room.currentTurnIdx = (room.currentTurnIdx + 1) % 2;
        caroNamespace.to(roomId).emit('game:turn_changed', { 
          currentTurn: room.players[room.currentTurnIdx].id
        });
      }
    });

    socket.on('disconnect', () => {
      for (const room of rooms) {
        const player = room.players.find(p => p.id === user.id);
        if (player) {
          const res = room.leave(user.id);
          if (res.action === 'abort') {
            caroNamespace.to(room.roomId).emit('game:aborted', { message: 'Đối thủ đã thoát phòng. Trận đấu kết thúc.' });
          }
          caroNamespace.to(room.roomId).emit('room:updated', { players: room.players });
        }
      }
    });
  });

  // Kết thúc ván đấu và tính toán xếp hạng (Ranking)
  function handleEndGame(room, roomId, winnerId) {
    room.phase = 'waiting';

    const winner = room.players.find(p => p.id === winnerId);
    const loser = room.players.find(p => p.id !== winnerId);

    // Cập nhật điểm cho user: win +1, lose -1
    if (winner && loser) {
      rankService.applyPoints(winner.id, 1);
      rankService.applyPoints(loser.id, -1);
    }

    caroNamespace.to(roomId).emit('game:finished', { 
      winnerId, 
      pointsUpdate: { [winnerId]: 1, [loser.id]: -1 } 
    });
  }
};

```

---

## 3. Thiết kế Client-Side (Frontend)

Client Caro sẽ sử dụng **PixiJS v8** làm nền tảng đồ họa chính để tạo bàn cờ tương tác mượt mà hiệu năng cao, đặt trong một khung bao cố định (Letterbox Container) có độ phân giải gốc $1920 \times 1080$ giúp co giãn responsive đồng bộ.

### 3.1. Thiết kế Giao diện (PixiJS Layout)

* **Background Bàn cờ**: Vẽ một hình chữ nhật lớn $15 \times 15$ ô có màu vàng nhạt (mã màu kiến nghị: `#FEF9E7`).
* **Lưới ô cờ (Grid)**: Chạy vòng lặp vẽ các đường kẻ mảnh màu đen (`0x000000`). Mỗi ô cờ (cell) có kích thước cố định khoảng $60 \times 60$ pixels để cân đối đẹp mắt trong tỷ lệ khung hình.
* **Quân cờ**: Khi nhận sự kiện `game:moved`, load file vector tương ứng `x.svg` hoặc `o.svg` và hiển thị hiệu ứng phóng to dần nhẹ nhàng bằng GSAP.


* **Âm thanh (Sounds)**: Khởi tạo đối tượng âm thanh đặt quân bằng **Howler**:


```javascript
const soundPlace = new Howl({
  src: ['assets/sounds/place.mp3']
});

```


Mỗi khi thực thi thành công lệnh đánh cờ từ Server hoặc Client nhận được sự kiện `game:moved`, ta kích hoạt `soundPlace.play()`.

### 3.2. Responsive Letterbox ($1920 \times 1080$)

Đoạn mã cấu trúc chuẩn của game client dưới canvas của PixiJS:

```javascript
// public/modules/caro/js/game.js

const designWidth = 1920;
const designHeight = 1080;

const app = new PIXI.Application();

async function initGame() {
  await app.init({ 
    width: window.innerWidth, 
    height: window.innerHeight,
    resolution: window.devicePixelRatio || 1,
    autoDensity: true
  });
  document.body.appendChild(app.canvas);

  // Tạo container đóng vai trò là khung Letterbox[cite: 1]
  const gameStage = new PIXI.Container();
  app.stage.addChild(gameStage);

  function resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    app.renderer.resize(w, h);

    // Tính toán tỷ lệ scale đồng nhất (Uniform Scale)[cite: 1]
    const scale = Math.min(w / designWidth, h / designHeight);
    gameStage.scale.set(scale);

    // Căn giữa màn hình[cite: 1]
    gameStage.x = (w - designWidth * scale) / 2;
    gameStage.y = (h - designHeight * scale) / 2;
  }

  window.addEventListener('resize', resize);
  resize();

  // Vẽ bàn cờ 15x15 nền vàng nhạt
  drawBoard(gameStage);
}

function drawBoard(stage) {
  const boardContainer = new PIXI.Container();
  const cellSize = 60; // Kích thước mỗi ô cờ
  const boardOffset = 90; // Căn chỉnh giữa khung 1920x1080

  const bg = new PIXI.Graphics();
  bg.rect(0, 0, cellSize * 15, cellSize * 15);
  bg.fill({ color: 0xFEF9E7 }); // Màu vàng nhạt
  bg.stroke({ width: 2, color: 0x000000 }); // Biên ngoài màu đen
  boardContainer.addChild(bg);

  // Vẽ lưới ô vuông
  const grid = new PIXI.Graphics();
  for (let i = 1; i < 15; i++) {
    // Đường kẻ dọc
    grid.moveTo(i * cellSize, 0);
    grid.lineTo(i * cellSize, cellSize * 15);
    // Đường kẻ ngang
    grid.moveTo(0, i * cellSize);
    grid.lineTo(cellSize * 15, i * cellSize);
  }
  grid.stroke({ width: 1, color: 0x000000 }); // Màu lưới đen mảnh
  boardContainer.addChild(grid);

  // Căn giữa bàn cờ trong màn hình game 1920x1080
  boardContainer.x = (designWidth - boardContainer.width) / 2;
  boardContainer.y = (designHeight - boardContainer.height) / 2;
  stage.addChild(boardContainer);
}

initGame();

```

---

## 4. Kiểm thử (Unit Testing)

Theo yêu cầu kiểm thử nghiêm ngặt tại `AGENTS.md`, chúng ta sẽ viết unit test độc lập cho phần domain kiểm tra điều kiện thắng và luật chặn 2 đầu dưới thư mục `tests/modules/caro/`:

```javascript
// tests/modules/caro/caroRules.test.js
const assert = require('node:assert');
const test = require('node:test');
const { createEmptyBoard, checkWin } = require('../../../src/modules/caro/domain/caroRules');

test('Caro Rules - Thắng bình thường với 5 quân liên tiếp hàng ngang', () => {
  const board = createEmptyBoard();
  board[0][0] = 1;
  board[0][1] = 1;
  board[0][2] = 1;
  board[0][3] = 1;
  board[0][4] = 1; // Nước đi cuối cùng giúp tạo chuỗi 5 quân X

  const isWin = checkWin(board, 0, 4, 1);
  assert.strictEqual(isWin, true);
});

test('Caro Rules - Bị chặn 2 đầu bởi quân đối phương (X bị O chặn)', () => {
  const board = createEmptyBoard();
  board[1][0] = 2; // O chặn đầu bên trái
  board[1][1] = 1; // X
  board[1][2] = 1; // X
  board[1][3] = 1; // X
  board[1][4] = 1; // X
  board[1][5] = 1; // X nước đi tạo chuỗi 5 quân
  board[1][6] = 2; // O chặn đầu bên phải

  const isWin = checkWin(board, 1, 5, 1);
  assert.strictEqual(isWin, false, 'Chuỗi 5 quân bị chặn 2 đầu không được tính thắng');
});

test('Caro Rules - Chỉ bị chặn 1 đầu bởi quân đối phương', () => {
  const board = createEmptyBoard();
  board[2][0] = 2; // O chặn đầu trái
  board[2][1] = 1; // X
  board[2][2] = 1; // X
  board[2][3] = 1; // X
  board[2][4] = 1; // X
  board[2][5] = 1; // X nước đi tạo chuỗi 5 quân
  // Đầu phải hoàn toàn trống

  const isWin = checkWin(board, 2, 5, 1);
  assert.strictEqual(isWin, true, 'Bị chặn 1 đầu vẫn tính thắng bình thường');
});

```

---

Để bắt đầu bắt tay vào việc hiện thực hóa mã nguồn này, bạn muốn xử lý trường hợp khi **hết 30 giây (turn timeout)** là hệ thống tự động đánh một nước đi ngẫu nhiên hợp lệ cho người chơi hiện tại để trận đấu tiếp tục, hay sẽ xử thua trực tiếp luôn để đảm bảo tính cạnh tranh cao của trò chơi?