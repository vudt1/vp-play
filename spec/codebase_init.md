Codebase & Tech-stack analyzing report !
---

## 1. Tổng kết Tech Stack Đề Xuất

| Thành phần | Công nghệ lựa chọn | Vai trò trong hệ thống |
| --- | --- | --- |
| **Backend Core** | **Node.js (Express)** | Chạy Web Server để phục vụ giao diện và làm REST API xử lý dữ liệu. |
| **Realtime Engine** | **Socket.io** | Quản lý phòng chơi, đồng bộ lượt đánh bài, chia bài thời gian thực giữa các máy. |
| **Database** | **SQLite 3 (`better-sqlite3`)** | Lưu thông tin user và bảng xếp hạng điểm (chạy chế độ WAL để tối ưu ghi đồng thời). |
| **Portal UI Shell** | **EJS (Embedded JS)** | Render giao diện Portal từ Server (Server-Side Rendering) giúp tải trang cực nhẹ. |
| **Portal Reactive** | **Alpine.js** | Xử lý logic phía Client (gọi API, cập nhật bảng điểm tự động mà không cần F5). |
| **Authentication** | **Keycloak-js** | Nhúng trực tiếp vào Client qua Alpine.js để thực hiện Login/Logout qua mạng LAN. |
| **Mini-Game App** | **Phaser.js** | Framework chạy độc lập tại Client để xử lý đồ họa, hiệu ứng 52 lá bài Tiến Lên. |

---

## 2. Cấu Trúc Dự Án Mẫu (Monorepo Đơn Giản)

Để đạt được mục tiêu *"Start một phát lên luôn cả lũ"*, toàn bộ mã nguồn sẽ được tổ chức trong một thư mục duy nhất như sau:

```text
vp-play/
│
├── spec/					# Thư mục chứa các specs của dự án
│
├── database/
│   └── play.db             # File database SQLite (Tự sinh ra khi chạy ứng dụng)
│
├── public/                   # Thư mục chứa tài nguyên tĩnh công khai rộng rãi
│   ├── css/
│   │   └── style.css         # CSS chung cho toàn hệ thống Portal
│   │
│   └── modules/                # NƠI CHỨA CÁC MODULE MINI-GAME
│       └── tienlen/          # Game Tiến Lên miền Nam (Chạy độc lập)
│           ├── index.html    # File HTML chính của game bài
│           ├── game.js       # Logic Phaser.js (Load bài, vẽ bài, bắt sự kiện click)
│           └── assets/       # Nơi chứa bộ asset 52 lá bài (SVG) của bạn
│
├── src/                      # Thư mục chứa mã nguồn Backend & Giao diện
│   ├── config/
│   │   └── db.js             # Kết nối SQLite 3, cấu hình chế độ PRAGMA journal_mode = WAL;
│   │
│   ├── controllers/
│   │   ├── authController.js # API nhận dữ liệu login từ client để đồng bộ vào SQLite
│   │   └── rankController.js # API lấy danh sách Top 10 bảng xếp hạng điểm số
│   │
│   ├── sockets/              # Nơi xử lý toàn bộ logic Realtime
│   │   ├── index.js          # Khởi tạo Socket.io chung
│   │   └── tienlenSocket.js  # Logic chia bài, kiểm tra vòng đánh, tính thắng/thua game Tiến Lên
│   │
│   └── views/                # Thư mục chứa các file giao diện EJS (Server-side)
│       ├── partials/
│       │   ├── header.ejs    # Thanh menu, nhúng CDN Alpine.js, cấu hình Keycloak chung
│       │   └── footer.ejs    # Bản quyền hoặc thông tin chân trang
│       ├── index.ejs         # Trang chủ Portal (Hiển thị nút Login hoặc Danh sách Game)
│       └── ranking.ejs       # Trang hiển thị bảng xếp hạng điểm số (Xếp theo ELO)
│
├── package.json              # Khai báo các thư viện (express, socket.io, better-sqlite3,...)
└── server.js                 # FILE CHẠY CHÍNH CỦA HỆ THỐNG

```

---

## 3. Quy Trình Vận Hành Của Hệ Thống

Khi bạn gõ lệnh `npm start` trên môi trường DEV:

1. **Khởi tạo:** `server.js` chạy $\rightarrow$ Mở cổng `3000` $\rightarrow$ Kết nối file `play.db` $\rightarrow$ Kích hoạt Socket.io.
2. **Truy cập Portal:** Người chơi truy cập `http://localhost:3000`. Server trả về file `index.ejs`. Alpine.js kích hoạt Keycloak để kiểm tra trạng thái đăng nhập.
3. **Đồng bộ User:** Nếu user login thành công, Alpine.js bốc `pccuid` gửi về API `/api/auth/sync`. Backend kiểm tra nếu chưa có user này trong SQLite thì `INSERT`, có rồi thì bỏ qua.
4. **Vào chơi Game:** User bấm vào game Tiến Lên $\rightarrow$ Portal chuyển hướng (hoặc mở iframe) sang `http://localhost:3000/modules/tienlen/index.html`.
5. **Đấu bài Realtime:** Phaser.js khởi chạy trên trình duyệt, đồng thời kích hoạt kết nối Socket.io lên Server tại cổng `3000` để bắt đầu ghép phòng và chia bài.
6. **Cập nhật Bảng xếp hạng:** Trận đấu kết thúc $\rightarrow$ Server tính toán cộng trừ điểm ELO $\rightarrow$ Ghi trực tiếp vào SQLite $\rightarrow$ Phát một tín hiệu socket báo cho trang `ranking.ejs` cập nhật lại điểm số theo thời gian thực.

Cấu trúc này cực kỳ trực quan, tách biệt rõ ràng giữa logic Portal (EJS/Alpine) và logic Game (Phaser), giúp bạn dễ dàng "nhét" thêm hàng chục game khác vào thư mục `public/modules/` sau này mà không cần sửa lại kiến trúc cốt lõi.