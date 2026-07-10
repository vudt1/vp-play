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
Một trong ba slot sảnh cố định trong Module multiplayer, tối đa bốn ghế.
_Avoid_: Lobby table, match, session

**Host**:
Người ngồi ghế được quyền Start; người vào phòng trước; chuyển khi rời.
_Avoid_: Owner, admin

**Hand**:
Một ván chia bài đến khi xếp hạng xong.
_Avoid_: Game, match, round (ambiguous)

**Ring**:
Chuỗi lượt đánh cho đến khi N−1 người bỏ lượt; người không bỏ giành quyền mở tự do.
_Avoid_: Trick (Western card sense), round

**Combo**:
Tổ hợp bài hợp lệ: rác, đôi, sám, tứ quý, sảnh (≥3, không 2), ba/bốn đôi thông (không 2).
_Avoid_: Hand, set, meld

**Beat**:
Chặn được combo trước: cùng kiểu và top cao hơn, hoặc special (tứ quý / đôi thông vs 2, v.v.).
_Avoid_: Cut, chặn (in code identifiers)

**Finish rank**:
Thứ tự người chơi hết bài (nhất … bét).
_Avoid_: Placement, ELO

**totalPoints**:
Điểm cộng dồn toàn portal (mọi Module ghi delta vào cùng tổng); dùng cho bảng xếp hạng global top 10.
_Avoid_: ELO, chips, money
