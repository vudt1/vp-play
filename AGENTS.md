# AGENTS.md — VP Play

Instructions for AI coding agents working in this repository. Read this file before changing code.

## Project

**VP Play** is a small internal LAN entertainment portal: Express portal (Module catalog + app surfaces) + Socket.IO realtime + mini-apps under `public/modules/` (**Tiến Lên Miền Nam**, **Caro** / PixiJS). Multiplayer: **3 fixed rooms** per Module; Tiến Lên **max 4** seats (2–4 humans); Caro **max 2** seats. Caro uses Socket.IO namespace `/caro` and `match:*` events (ADR 0012); no bots.

Product research lives in `spec/` (`codebase_init.md`, `logic_game.md`). Runtime code is not there. Design system: `DESIGN.md`.

Domain vocabulary: `CONTEXT.md`. Architectural decisions: `docs/adr/`.

## Tech stack

| Layer | Choice | Notes |
| --- | --- | --- |
| Runtime | Node.js | Single process |
| HTTP | Express | REST + static + EJS |
| Views | EJS | Portal SSR |
| Client portal | Alpine.js | Catalog, app surface, ranking |
| Auth | Keycloak-js (browser) + JWT verify (server) | Id: `KEYCLOAK_ID_CLAIM` (default `pccuid`); display: `KEYCLOAK_DISPLAY_NAME_CLAIM` (default `preferred_username`) |
| Realtime | Socket.IO | Room/hand events; auth on handshake |
| Game client | PixiJS v8 + GSAP 3 + Howler | `public/modules/<id>/` (local `js/libs/`, letterbox 1920×1080); loaded in **iframe** |
| DB | SQLite via `better-sqlite3` | WAL; file under `database/` |
| Config | `dotenv` | `.env.development` / `.env.production` via `VP_ENV`; see `.env.*.example` |
| Portal CSS | Tailwind CSS **v3.4** (CLI build) | Source `src/css/portal.css` → built `public/css/portal.css`; offline fonts under `public/fonts/` (see ADR 0007) |

**Do not add** without an explicit human decision: ORM, Redis, formal FSM library, GraphQL, monorepo tooling, second mini-game framework, CDN Tailwind, or extra PostCSS plugins beyond the official Tailwind CLI.

## Repository map

- `server.js` — process entry: HTTP server, view engine, static, Socket.IO attach
- `src/modules/catalog.js` — static Module catalog (id, name, blurb, icon, entry, kind)
- `src/modules/<id>/` — **server side of a multiplayer Module** (namespaced by catalog id)
  - `src/modules/tienlen/domain/` — pure card/combo/rules/deal/scoring (no I/O)
  - `src/modules/tienlen/rooms/roomTable.js` — in-memory rooms/seats/hand phase
  - `src/modules/tienlen/sockets.js` — Module Socket.IO adapter (`room:*` / `hand:*`, default namespace)
  - `src/modules/caro/` — board Match domain + roomTable (2 seats) + `sockets.js` on namespace `/caro` (`room:*` / `match:*`)
  - `src/modules/<id>/index.js` — barrel re-export for the Module server package
- `src/sockets/` — portal Socket.IO hub: JWT auth middleware + attach per-Module adapters
- `src/auth/`, `src/services/`, `src/controllers/` — Keycloak verify, user sync, ranks
- `src/views/` — EJS portal templates (`/` catalog, `/apps/:id` app surface e.g. `app_tienlen`, `/ranking`)
- `public/` — CSS + mini-app static assets (`public/modules/<id>/`, icon at `icon.png`)
- `assets/card/svg/` — source card SVGs (copy or link into game assets)
- `tests/modules/<id>/` — prefer Module domain + roomTable unit tests
- `spec/` — design notes only
- `DESIGN.md` — portal design tokens / UI contract

## Commands

- `npm run build:css` — Tailwind CLI: `src/css/portal.css` → `public/css/portal.css`
- `npm run dev` — development (`predev` builds CSS; `VP_ENV=development` → `.env.development`)
- `npm start` — production (`prestart` builds CSS; `VP_ENV=production` → `.env.production`)
- `npm test` — unit tests (`node --test`)

## Deploy / APP_PREFIX

- Nginx may serve the app under a public prefix (e.g. `https://host/play/`) with **strip** `proxy_pass http://localhost:3000/;` so Express still mounts at `/`.
- Set `APP_PREFIX=/play` so SSR and clients emit public URLs and Socket.IO client `path` `/play/socket.io`. Server Socket.IO stays at `/socket.io`.
- Inject `window.VP_BASE`; do not rely on `<base href>` alone for root-absolute paths.
- Secrets: never commit `.env*` with real tokens (examples only).

## Architecture rules (non-negotiable)

1. **Deep modules**: small interface, hide complexity. Prefer pure functions in `src/modules/<id>/domain/` tested through their public interface.
2. **Seams**: Socket.IO and Express are **adapters**. Game rules and room transitions live outside them. Do not put combo validation only inside socket handlers. Portal hub (`src/sockets/`) owns shared auth; each multiplayer Module owns its event adapter under `src/modules/<id>/`.
3. **One adapter ≠ port**: only introduce a port/interface when two adapters exist (e.g. real JWT verifier + test stub).
4. **No formal FSM library.** Use `phase` enums (`idle | waiting | playing | settling`) and explicit handler guards.
5. **MVP rules only (Classic core):** singles/pairs/triples/quads, straights (≥3, no 2s), 3/4 consecutive pairs (no 2s), same-shape beat, specials (tứ quý / 3 đôi thông vs single 2; 4 đôi thông vs single|pair 2 or tứ quý), **in-turn only**. **Opening lead:** holder of lowest dealt card id must include that card (4 players ⇒ always 3♠). Full finish ranking + simple points.
6. **Explicit non-goals:** tới trắng, đền bài, thối 3 bích, cóng multipliers, AI autoplay, out-of-turn chặt, ELO, spectators, mid-hand DB persistence.
7. **Auth path:** Portal owns Keycloak. With `AUTH_DEV_BYPASS=0`, all portal pages (`/`, `/apps/:id`, `/ranking`) use `login-required` and must succeed `POST /api/auth/sync` before useful UI; access token may be cached in `localStorage` (`vp_access_token`). Display name in header `#auth-slot`. Game iframe receives `{ type: 'vp-auth', token, profile }` via **postMessage** (same origin). Socket uses token; server verifies JWKS. **Do not** init Keycloak inside the iframe.
8. **Portal IA:** home `/` = Module catalog only; multiplayer Room lobby + iframe live on app surface `/apps/:id`. Leaving the app surface (Back / navigate away) must emit `room:leave` when seated. Ranking `/ranking` = global top 10 by raw `totalPoints` (all Modules share one sum via `applyPoints`).
9. **Rooms:** exactly 3 fixed slots (Tiến Lên); Host = first joiner, migrates on leave; host starts at 2–4 players; after hand → waiting + host restarts.
10. **Disconnect / turn timeout:** hold seat ~`RECONNECT_MS` (default 60s). Turn timeout never auto-plays cards: non–free-lead → auto-pass (`ringPassed`); free-lead → free-lead skip (next active keeps free lead; opening must-include only for original opener). Mid-hand leave with seats &lt; 2 → Hand abort (draw, no points), emit `hand:aborted`, phase waiting/idle. Default `TURN_TIMEOUT_MS` 30s. First turn after deal pads **Deal grace** (`DEAL_GRACE_MS`, default 8s) onto `turnDeadline` only; client hides timer while deal/play animating.

11. **Card ids:** `id = rank * 4 + suit`, rank 0=3 … 12=2, suit 0=♠ 1=♣ 2=♦ 3=♥; **3♠ = 0** (see `spec/logic_game.md`).
12. **Module icons:** `public/modules/<id>/icon.png` (or `.svg`); catalog reads path from manifest.
13. **Secrets:** never commit `.env`, `.env.development`, `.env.production`, tokens, or Keycloak secrets. Use `*.example` only for names.
14. **Comments:** no drive-by comments; no narrating code. Update `AGENTS.md` / `CONTEXT.md` / ADR / `DESIGN.md` when decisions change.
15. **Commits:** only when the human asks.

## Coding conventions

- JavaScript (Node), **CommonJS** (`require` / `module.exports`).
- Prefer clear names aligned with `CONTEXT.md` (Player, Room, Host, Hand, Combo, Beat, totalPoints).
- Socket event names: `room:*` and `hand:*`; keep payloads small.
- Errors to client: structured `{ code, message }` on `hand:error` / join rejects; do not leak stack traces.
- SQLite access only via config/services — no ad-hoc DB in socket files.
- UI: keep portal and game separated (EJS/Alpine vs Pixi canvas Module); shared knowledge is card id encoding and socket contract only. Multiplayer clients: full-window Pixi canvas + virtual 1920×1080 stage container (uniform scale, center letterbox, black bars — ADR 0010); vendors Pixi/GSAP/Howler under `public/modules/<id>/js/libs/` (no CDN); Socket.IO client still loads from server path (ADR 0008). Tiến Lên: opponent card counts = card-back stacks (not “N lá” text). Caro client (`public/modules/caro/js/`): split modules — `constants.js`, `letterbox.js`, `boardView.js`, `headerView.js`, `hudView.js`, `socketClient.js`, `sounds.js`, `game.js` (orchestrator); board cell size + mark sprites scale with `CELL`; turn highlight = animated ring on active player name; connects namespace `/caro` (`room:*` / `match:*`, ADR 0012). Portal CSS is Tailwind v3.4 utilities + tokens in `tailwind.config.js` / `DESIGN.md` (ADR 0007); run `npm run build:css` after class changes.
- New mini-app: add `public/modules/<id>/` + `icon.png` + one entry in `src/modules/catalog.js` (`status: 'live'` for playable; placeholders allowed for catalog mock only). Multiplayer Module also gets `src/modules/<id>/{domain,rooms,sockets.js}` and is attached from `src/sockets/index.js`.

## Testing expectations

- Module domain rules (`combination`, `playRules`, `scoring`) and `roomTable` transitions must have unit tests under `tests/modules/<id>/`.
- Do not require full browser E2E for MVP; document manual LAN checks instead.
- When deepening a module, test through its interface; delete obsolete shallow tests if replaced.

## Before you code checklist

1. Read this file + `CONTEXT.md` (if present) + relevant `docs/adr/*`.
2. Confirm the change is not an MVP non-goal.
3. Put Module rules in `src/modules/<id>/domain/` or `rooms/`; put Module transport in `src/modules/<id>/sockets.js`; keep portal JWT attach in `src/sockets/`.
4. Run tests for touched pure modules.
5. If you change stack, layout, or a locked decision, update this `AGENTS.md` and add/adjust an ADR when the decision is hard to reverse.
