# Deal grace on first turn + local empty-hand win SFX

Client deal+flip animation runs ~8s after `hand:dealt`, while the server previously armed `turnDeadline` at deal time — so the opener lost most of the turn window. **Decision:** pad only the first `turnDeadline` with **Deal grace** (`DEAL_GRACE_MS`, default 8000) in `roomTable.start()` (`now + turnTimeoutMs + dealGraceMs`); later turns use `turnTimeoutMs` alone. Client hides the turn timer while `animating` and runs full deal anim only when the hand still looks fresh (free lead, must-include opening, no lastCombo, all seats at 13 cards).

Default **turn timeout** is **30s** (`TURN_TIMEOUT_MS`). Local player emptying their hand plays `win.mp3` once on successful `hand:play`; end-of-hand `celebrateWin` skips the sound if that flag is already set (avoids double SFX when the hand ends on the same play).
