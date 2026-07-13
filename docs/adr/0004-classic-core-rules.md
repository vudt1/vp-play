# Classic core Tiến Lên rules only

MVP implements legal combos, same-shape beat, in-turn specials (tứ quý / 3 đôi thông vs single 2; 4 đôi thông vs single|pair 2 or tứ quý), **Opening lead** by the holder of the lowest dealt card id (must include that card; with 4 players this is always 3♠), full finish ranking, and simple finish-order points.

Public hand fields: `openingCardId`, `mustIncludeOpening` (replaces always-3♠ / `mustInclude3s`).

Explicit non-goals: tới trắng, đền bài, thối 3 bích, cóng multipliers, AI autoplay, out-of-turn chặt, ELO. Full research remains in `spec/logic_game.md` for a later expansion decision.
