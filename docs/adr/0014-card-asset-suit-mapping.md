# 14. Standardizing Tiến Lên Card Asset Suit Mapping

- **Status:** Accepted
- **Date:** 2026-07-23

## Context

In Tiến Lên Miền Nam, suit order by strength is:

- **0:** `S` (Spade / Bích ♠)
- **1:** `C` (Club / Chuồn ♣)
- **2:** `D` (Diamond / Rô ◆)
- **3:** `H` (Heart / Cơ ♥)

Cards are mapped via `cardId = rank * 4 + suit` and mapped to asset SVG file names via `assetName(id) = SUIT_NAMES[suitOf(id)] + RANK_NAMES[rankOf(id)]`.

However, SVG filenames under `public/modules/tienlen/assets/images/cards/` were misnamed (e.g. `C2.svg` contained Heart drawings, `H2.svg` contained Diamond drawings, `D2.svg` contained Club drawings). This caused visual confusion where `2♥` appeared as `2♣` internally, creating invalid gameplay beats where visually superior cards failed to beat inferior ones.

## Decision

1. **Rename Asset SVGs**: Renamed all 39 rotated SVG assets under `public/modules/tienlen/assets/images/cards/` so that:
   - `H*.svg` contains Heart (♥) graphics
   - `D*.svg` contains Diamond (◆) graphics
   - `C*.svg` contains Club (♣) graphics
   - `S*.svg` contains Spade (♠) graphics
2. Keep `card.js` domain logic and `assetName(id)` mapping intact as standard single source of truth.

## Consequences

- Asset file names strictly reflect visual drawing contents.
- `2♥` (`H2.svg`, ID 51) is correctly recognized and beats `2♦` (`D2.svg`, ID 50) both visually and in game logic.
