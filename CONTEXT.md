# VP Play

Portal giải trí LAN nội bộ với catalog mini-app (Module) và ván bài realtime; điểm cộng dồn global theo totalPoints.

## Language

**Player**:
Người đã xác thực (Keycloak), định danh bằng `pccuid`.
_Avoid_: Account, user account, client

**Module**:
Một mini-app được catalog trên portal (`/public/modules/<id>`), có icon; chỉ Module **live** có app surface để chơi. Catalog có thể liệt kê entry placeholder (chưa chơi được).
_Avoid_: App store app, plugin, game (ambiguous with Hand), app (dùng Module)

**App surface**:
Trang portal của một Module (chi tiết + play chrome); Module multiplayer chứa Room lobby và iframe tại đây.
_Avoid_: Game page, lobby (alone)

**Room**:
Một trong ba slot sảnh cố định trong Module multiplayer; số ghế tối đa do Module quy định (catalog `maxSeats`).
_Avoid_: Lobby table, match, session

**Host**:
Người ngồi ghế được quyền Start; người vào phòng trước; chuyển khi rời.
_Avoid_: Owner, admin

**Hand**:
Một ván chia bài (Tiến Lên) đến khi xếp hạng xong.
_Avoid_: Game, match, round (ambiguous)

**Match**:
Một ván chơi board-game (Caro) từ Start đến win, full-board draw, hoặc abort; khác Hand (card).
_Avoid_: Game, hand, round (as the domain name for board modules)

**Mark**:
Quân cờ Caro của một ghế trong Match: X (Host, đi trước) hoặc O (guest).
_Avoid_: Piece, stone, symbol (as domain name)

**Block-two-ends**:
Luật thắng Caro Việt Nam: chuỗi ≥5 Mark cùng loại chỉ thắng khi không bị Mark đối thủ chặn cả hai đầu chuỗi; biên bàn không tính là chặn.
_Avoid_: Open-ended five, renju

**Ring**:
Chuỗi lượt đánh cho đến khi N−1 người bỏ lượt; người không bỏ giành quyền mở tự do. Ai đã pass trong Ring mất quyền đánh cho đến khi Ring kết thúc.
_Avoid_: Trick (Western card sense), round

**Free-lead skip**:
Hết giờ trên free lead: không đánh bài, free lead chuyển sang người kế trong active; không ghi pass vào Ring. Opening must-include chỉ còn bắt opener gốc.
_Avoid_: Auto-lead, auto-play on timeout

**Hand abort**:
Hủy Hand giữa chừng khi còn dưới hai ghế (rời phòng / mất kết nối hết hạn); hòa, không ghi điểm; phòng về waiting hoặc idle.
_Avoid_: Draw match (as code id), forfeit, cancel game

**Match abort**:
Hủy Match giữa chừng (rời phòng hoặc disconnect ngay); hòa, không ghi điểm; phòng về waiting hoặc idle.
_Avoid_: Forfeit, cancel game, disconnect hold (Caro không giữ ghế RECONNECT_MS)

**Combo**:
Tổ hợp bài hợp lệ: rác, đôi, sám, tứ quý, sảnh (≥3, không 2), ba/bốn đôi thông (không 2).
_Avoid_: Hand, set, meld

**Opening lead**:
Lượt free lead đầu tiên của một Hand. Opener là người cầm **opening card** (card id nhỏ nhất trong các tay đã chia); Combo mở bắt buộc gồm lá đó chỉ khi vẫn là lượt của opener. Với đủ 4 người (hết 52 lá) opening card luôn là 3♠.
_Avoid_: First turn only, 3♠ rule (as the sole name)

**Opening card**:
Lá có card id nhỏ nhất trong mọi tay đã deal của Hand; public state có thể expose `openingCardId` và `mustIncludeOpening` cho đến khi opener mở thành công hoặc free-lead skip khỏi opener.
_Avoid_: 3 of spades (as the only name), seed card

**Deal grace**:
Khoảng chờ sau khi chia bài trước khi lượt đầu của Hand được tính hết giờ (bù thời gian animation chia bài trên client). Chỉ áp dụng cho `turnDeadline` lần đầu sau deal; các lượt sau không cộng thêm.
_Avoid_: deal delay, animation timeout, turn padding (as domain names)

**Beat**:
Chặn được combo trước: cùng kiểu và top cao hơn, hoặc special (tứ quý / đôi thông vs 2, v.v.).
_Avoid_: Cut, chặn (in code identifiers)

**Finish rank**:
Thứ tự người chơi hết bài (nhất … bét).
_Avoid_: Placement, ELO

**totalPoints**:
Điểm cộng dồn toàn portal (mọi Module ghi delta vào cùng tổng); dùng cho bảng xếp hạng global top 10.
_Avoid_: ELO, chips, money
