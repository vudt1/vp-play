# Tiến Lên: virtual stage letterbox, turn timeout, hand abort

The Tiến Lên client uses a **full-window** PixiJS canvas (`innerWidth` × `innerHeight`, black clear) and a fixed **1920×1080 stage container** scaled with uniform `min(vw/1920, vh/1080)` and centered — not CSS-only canvas shrink. Game coords and hit targets stay in design space.

**Turn timeout never chooses cards.** On free lead, timeout is a **free-lead skip** (next active keeps free lead; `mustIncludeOpening` only while `currentTurn` is still the original opener). Otherwise timeout is auto-pass into `ringPassed` until the Ring ends. Manual pass on free lead remains rejected.

**Hand abort:** mid-hand leave that drops seats below 2 clears the hand with no `onSettle` / points, phase waiting or idle, and emits `hand:aborted` plus `room:state`. Leave with seats ≥ 2 but `active` ≤ 1 still settles normally.
